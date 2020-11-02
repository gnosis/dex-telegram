import Web3 from 'web3'
import NodeCache from 'node-cache'

import {
  Logger,
  ContractEventLog,
  tokenList,
  Erc20Contract,
  BatchExchangeContract,
} from '@gnosis.pm/dex-js'
import { Subscription } from 'web3-core-subscriptions'
import { TcrContract } from '@gnosis.pm/dex-js/build-esm/contracts/TcrContract'

import packageJson from '../../package.json'
import { BigNumber } from 'bignumber.js'
import { version as dexJsVersion } from '@gnosis.pm/dex-js/package.json'
import { version as contractsVersion } from '@gnosis.pm/dex-contracts/package.json'
import { TCR_LIST_ID, TCR_CACHE_TIME, TOKEN_OVERRIDES } from 'config'
import { WebsocketProvider } from 'web3-core'

// declaration merging
// to allow for error callback
declare module 'web3-core' {
  interface WebsocketProvider {
    on(type: string, callback: () => void): void;
    on(type: 'error', callback: (error: Error) => void): void
  }
  interface IpcProvider {
    on(type: string, callback: () => void): void;
    on(type: 'error', callback: (error: Error) => void): void
  }

}

declare module 'web3-core-subscriptions' {
  interface Subscription<T> {
    resubscribe(): void
  }
}

const PEER_COUNT_WARN_THRESHOLD = 3 // Warning if the node has less than X peers
const BLOCK_TIME_ERR_THRESHOLD_MINUTES = 2 // Error if there's no a new block in X min

const log = new Logger('service:dfusion')

export interface Params {
  batchExchangeContract: BatchExchangeContract
  erc20Contract: Erc20Contract
  tcrContract?: TcrContract
  tokenIdsFilter?: string[]
  web3: Web3
}

function _formatTokenForLog(tokenId: string, token: TokenDto): string {
  const optionalSymbol = token.symbol ? ` (${token.symbol})` : ''
  return tokenId + optionalSymbol + ' - ' + token.address
}

export interface OrderPlacement {
  owner: string
  index: string
  buyToken: string
  sellToken: string
  validFrom: string
  validUntil: string
  priceNumerator: string
  priceDenominator: string
}

export interface DfusionService {
  // Watch events
  watchOrderPlacement(params: WatchOrderPlacementParams): void

  // Basic info
  getAbout(): Promise<AboutDto>
  getVersion(): String
  isHealthy(): Promise<boolean>
}

export interface WatchOrderPlacementParams {
  onNewOrder: (order: OrderDto) => void
  onError: (error: Error) => void
}

export interface TokenDto {
  name?: string
  symbol?: string
  decimals: number
  address: string
  known: boolean
  forceAddressDisplay?: boolean
}

interface LocalOverride extends Pick<TokenDto, 'name' | 'symbol' | 'forceAddressDisplay'> {
  decimals?: number
}

export interface AboutDto {
  blockNumber: number
  networkId: number
  nodeInfo: string
  version: string
  contractsVersion: string
  dexJsVersion: string
  batchExchangeAddress: string
  tcrContractAddress?: string
  tcrListId: number
}

export interface OrderDto {
  owner: string
  buyToken: TokenDto
  sellToken: TokenDto
  validFrom: Date
  validUntil: Date
  validFromBatchId: BigNumber
  validUntilBatchId: BigNumber
  priceNumerator: BigNumber
  priceDenominator: BigNumber
  event: ContractEventLog<OrderPlacement>
  networkId: number
}

const TIME_TO_FLUSH_RESPONSES = 1000 // ms
// time to wait before hard disconnecting an open connection

// codes 4000-4999 are available for use by applications
// let's use 4000 for eth_subscribe reason
const ETH_SUBSCRIBE_NOT_SUPPORTED = {
  code: 4000,
  reason: 'Method eth_subscribe not supported when it should be',
}

export class DfusionRepoImpl implements DfusionService {
  private _web3: Web3
  private _contract: BatchExchangeContract
  private _erc20Contract: Erc20Contract
  private _tokenIdsFilter?: string[]

  private _tcrContract?: TcrContract
  private _networkId: number
  private _batchTime: BigNumber
  private _cache: NodeCache

  private _reconnecting = false

  constructor(params: Params) {
    const { web3, batchExchangeContract, erc20Contract, tcrContract, tokenIdsFilter } = params
    log.debug('Setup dfusionRepo with contract address %s', batchExchangeContract.options.address)

    this._contract = batchExchangeContract
    this._erc20Contract = erc20Contract
    this._tcrContract = tcrContract
    this._tokenIdsFilter = tokenIdsFilter
    this._web3 = web3

    const provider = web3.currentProvider
    if (provider && typeof provider === 'object' && 'on' in provider) {
      provider.on('error', (error: Error): void => {
        log.error('Web3 Provider error: ', error)
        // for now triggers `connection not open on send()`
        // but we can aniticipate `on request()`
        if (error.message.includes('connection not open on ') || error.message.includes('connection got closed')) {
          const intervalId = setInterval(() => {
            log.error('Connection failure. Reconnecting...')
            provider.reconnect()

            provider.once('connect', () => {
              log.info('Reconnection successfull')
              clearInterval(intervalId)
            })
          }, 5000)
        }
      })
    }

    this._cache = new NodeCache({ useClones: false })
  }

  public async isHealthy(): Promise<boolean> {
    try {
      // Perform some health checks
      await this._web3.eth.getNodeInfo()
      const peerCount = await this._web3.eth.net.getPeerCount()
      const block = await this._web3.eth.getBlock('latest')
      const isListening = await this._web3.eth.net.isListening()
      const lastMinedBlockDate = new Date(+block.timestamp * 1000)

      // Verify the peer count, last mined block, amd that we are still listening the node
      const someTimeAgo = new Date(Date.now() - BLOCK_TIME_ERR_THRESHOLD_MINUTES * 60 * 1000)
      log.debug('Peer count=%d, Block: %d, Last mined block: %s', peerCount, block.number, lastMinedBlockDate)
      if (peerCount === 0) {
        log.error(
          "Health check error. There aren't any Ethereum peer nodes. Last mined block is %d at %s",
          block.number,
          lastMinedBlockDate,
        )
        return false
      } else if (lastMinedBlockDate < someTimeAgo) {
        log.error(
          'Health check error. No block has been mined in the last %d minutes. Last mined block is %d at %s',
          BLOCK_TIME_ERR_THRESHOLD_MINUTES,
          block.number,
          lastMinedBlockDate,
        )
        return false
      } else if (!isListening) {
        log.error(
          'Health check error. It is not listening. Last mined block is %d at %s',
          BLOCK_TIME_ERR_THRESHOLD_MINUTES,
          block.number,
          lastMinedBlockDate,
        )
        return false
      } else if (peerCount < PEER_COUNT_WARN_THRESHOLD) {
        log.warn("There're too little Ethereum peers nodes: " + peerCount)
      }

      // All good
      return true
    } catch (error) {
      log.error('Health check error', error)
      return false
    }
  }

  public watchOrderPlacement(params: WatchOrderPlacementParams) {
    const OrderPlacement = this._contract.events.OrderPlacement
    const subscriptions: Map<string, Subscription<ContractEventLog<OrderPlacement>>> = new Map()

    if (this._tokenIdsFilter) {
      const tokenListDescription = this._tokenIdsFilter.join(', ')
      subscriptions.set(
        'Orders whose Buy Token is ' + tokenListDescription,
        OrderPlacement({
          filter: { buyToken: this._tokenIdsFilter },
        }),
      )

      subscriptions.set(
        'Orders whose Sell Token is ' + tokenListDescription,
        OrderPlacement({
          filter: { sellToken: this._tokenIdsFilter },
        }),
      )
    } else {
      subscriptions.set('Any Order', OrderPlacement())
    }

    for (const [subscriptionName, subscription] of subscriptions) {
      this.subscribeOrderPlacement(subscriptionName, subscription, params)
    }
  }

  private handleSubscriptionError<T>(error: Error, subscriptionParams: { subscription: Subscription<T>, name?: string }) {
    const provider = this._web3.currentProvider
    if (
      // error that shouldn't happen with websocket connection
      // if it happens, then consider the connection faulty and try to reconnect
      error.message.includes('Method eth_subscribe is not supported') &&
      provider && typeof provider === 'object' && 'disconnect' in provider && 'on' in provider
    ) {
      // at this point we know provider is WebsocketProvider
      this.reconnectAndResubscribe(provider, subscriptionParams)
    }
  }

  private reconnectAndResubscribe<T>(provider: WebsocketProvider, { subscription, name }: { subscription: Subscription<T>, name?: string }) {
    // retry subscription when connection is established
    // expect several `eth_subscribe not supported` errors in a row
    provider.once('connect', () => {
      log.info('Retrying subscription to %s', name)
      subscription.resubscribe()
    })

    setTimeout(() => {
      // don't reconnect while connection is in progress
      if (this._reconnecting) return

      this._reconnecting = true

      log.info('Dropping current WebSocket connection')
      // should not use 1000 (Normal Closure) and 1001 (Going Away) codes to trigger auto reconnect
      provider.disconnect(ETH_SUBSCRIBE_NOT_SUPPORTED.code, ETH_SUBSCRIBE_NOT_SUPPORTED.reason)

      provider.once('connect', () => {
        log.info('Reconnection successfull')
        // allow reconnecting again if subscription still errors
        this._reconnecting = false
      })
    }, TIME_TO_FLUSH_RESPONSES)
  }

  private subscribeOrderPlacement(
    subscriptionName: string,
    subscription: Subscription<ContractEventLog<OrderPlacement>>,
    params: WatchOrderPlacementParams,
  ) {
    subscription
      .on('connected', subscriptionId => {
        log.debug('Subscribe to %s. SubscriptionId: %s', subscriptionName, subscriptionId)
      })
      .on('data', async event => {
        log.debug('New order: %o', event)
        const {
          owner,
          sellToken: sellTokenId,
          buyToken: buyTokenId,
          priceNumerator: priceNumeratorString,
          priceDenominator: priceDenominatorString,
          validFrom: validFromBatchIdString,
          validUntil: validUntilBatchIdString,
        } = event.returnValues

        const priceNumerator = new BigNumber(priceNumeratorString)
        const priceDenominator = new BigNumber(priceDenominatorString)
        const validFromBatchId = new BigNumber(validFromBatchIdString)
        const validUntilBatchId = new BigNumber(validUntilBatchIdString)

        const [sellTokenAddress, buyTokenAddress] = await Promise.all([
          this._getTokenAddress(sellTokenId),
          this._getTokenAddress(buyTokenId),
        ])
        const [sellToken, buyToken, validFrom, validUntil] = await Promise.all([
          this._getToken(sellTokenAddress),
          this._getToken(buyTokenAddress),
          this._batchIdToDate(validFromBatchId),
          this._batchIdToDate(validUntilBatchId.plus(1)), // adding 1 since validUntillBatchId is inclusive. https://github.com/gnosis/dex-telegram/issues/183
        ])

        log.info(`New order in tx ${event.transactionHash}:
  - Owner: ${owner}
  - Sell token: ${_formatTokenForLog(sellTokenId, sellToken)}
  - Buy token: ${_formatTokenForLog(buyTokenId, buyToken)}
  - Price: ${priceNumerator}/${priceDenominator} = ${priceNumerator.dividedBy(priceDenominator).toNumber()}
  - Valid from: ${validFromBatchId}
  - Valid until: ${validUntilBatchId}
  - Block number: ${event.blockNumber}`)

        params.onNewOrder({
          owner,
          sellToken,
          buyToken,
          priceNumerator,
          priceDenominator,
          validFromBatchId,
          validUntilBatchId,
          validFrom: validFrom as Date,
          validUntil: validUntil as Date,
          event,
          networkId: await this._getNetworkId(),
        })
      })
      .on('changed', data => {
        log.warn('Changed/Removed order: %o', data)
      })
      .on('error', (error: Error) => {
        params.onError(error)
        this.handleSubscriptionError(error, { subscription, name: subscriptionName })
      })
  }

  public async getAbout(): Promise<AboutDto> {
    const [blockNumber, networkId, nodeInfo] = await Promise.all([
      this._web3.eth.getBlockNumber(),
      this._getNetworkId(),
      this._web3.eth.getNodeInfo(),
    ])

    return {
      blockNumber,
      networkId,
      nodeInfo,
      contractsVersion,
      dexJsVersion,
      version: packageJson.version,
      batchExchangeAddress: this._contract.options.address,
      tcrContractAddress: this._tcrContract?.options.address,
      tcrListId: TCR_LIST_ID,
    }
  }

  public getVersion(): String {
    return packageJson.version
  }

  private async _getNetworkId(): Promise<number> {
    if (!this._networkId) {
      this._networkId = await this._web3.eth.getChainId()
    }

    return this._networkId
  }

  private _getTokenAddress(id: string | number): Promise<string> {
    return this._contract.methods.tokenIdToAddressMap(id).call()
  }

  private async _getToken(tokenAddress: string): Promise<TokenDto> {
    let token = this._cache.get<TokenDto>(tokenAddress)

    if (!token) {
      const tokenContract = this._erc20Contract.clone()
      tokenContract.options.address = tokenAddress

      const [networkId, { symbol, decimals, name }, tcr] = await Promise.all([
        this._getNetworkId(),
        // Get basic data from the contract
        _getDataFromErc20(tokenContract),
        // Get addresses from TCR
        this._getTcr(),
      ])

      let localOverride: LocalOverride = TOKEN_OVERRIDES[networkId][tokenAddress.toLowerCase()]
      if (localOverride) {
        log.info(`Local override found for token address ${tokenAddress} on network ${networkId}:`, localOverride)
      } else {
        localOverride = {}
      }

      const tokenJson = tokenList.find(token => token.addressByNetwork[networkId] === tokenAddress)
      token = {
        symbol,
        name,
        decimals: decimals as number,
        ...tokenJson,
        ...localOverride,
        address: tokenAddress,
        known: !!tokenJson || (tcr.size > 0 && tcr.has(tokenAddress)),
      }

      // Cache token if it's found, or null if is not
      this._cache.set(tokenAddress, token)
    }

    return token
  }

  private async _getBatchTime(): Promise<BigNumber> {
    if (!this._batchTime) {
      this._batchTime = new BigNumber(await this._contract.methods.BATCH_TIME().call())
    }
    return this._batchTime
  }

  // TODO: Move to utils project
  private async _batchIdToDate(batchId: BigNumber): Promise<Date> {
    const batchTime = await this._getBatchTime()

    return new Date(
      batchId
        .multipliedBy(batchTime)
        .multipliedBy(new BigNumber(1000))
        .toNumber(),
    )
  }

  private async _getTcr(): Promise<Set<string>> {
    const tcrCacheKey = 'tcr'
    const cachedAddresses = this._cache.get<Set<string>>(tcrCacheKey)

    if (cachedAddresses) {
      return cachedAddresses
    }

    const tcrList = await this._tcrContract?.methods
      .getTokens(TCR_LIST_ID)
      .call()
      .catch(() => [])

    const addresses = new Set<string>(tcrList)

    this._cache.set(tcrCacheKey, addresses, TCR_CACHE_TIME)

    return addresses
  }
}

async function _getDataFromErc20(tokenContract: Erc20Contract) {
  const symbolPromise = tokenContract.methods
    .symbol()
    .call()
    .catch(() => undefined)

  const decimalsPromise = tokenContract.methods
    .decimals()
    .call()
    .then(parseInt)
    .catch(() => 18)

  const namePromise = tokenContract.methods
    .name()
    .call()
    .catch(() => undefined)

  // Get basic data from the contract
  const [symbol, decimals, name] = await Promise.all([symbolPromise, decimalsPromise, namePromise])
  return { symbol, decimals, name }
}

export default DfusionRepoImpl
