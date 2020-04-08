import Web3 from 'web3'

import { Logger, ContractEventLog, tokenList, Erc20Contract, BatchExchangeContract } from '@gnosis.pm/dex-js'

import packageJson from '../../package.json'
import { BigNumber } from 'bignumber.js'
import { version as dexJsVersion } from '@gnosis.pm/dex-js/package.json'
import { version as contractsVersion } from '@gnosis.pm/dex-contracts/package.json'

const PEER_COUNT_WARN_THRESHOLD = 3 // Warning if the node has less than X peers
const BLOCK_TIME_ERR_THRESHOLD_MINUTES = 2 // Error if there's no a new block in X min

const log = new Logger('service:dfusion')

export interface Params {
  batchExchangeContract: BatchExchangeContract
  erc20Contract: Erc20Contract
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
}

export interface AboutDto {
  blockNumber: number
  networkId: number
  nodeInfo: string
  version: string
  contractsVersion: string
  dexJsVersion: string
  batchExchangeAddress: string
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
}

export class DfusionRepoImpl implements DfusionService {
  private _web3: Web3
  private _contract: BatchExchangeContract
  private _erc20Contract: Erc20Contract
  private _networkId: number
  private _batchTime: BigNumber
  private _tokenCache: { [tokenAddress: string]: TokenDto } = {}

  constructor(params: Params) {
    const { web3, batchExchangeContract, erc20Contract } = params
    log.debug('Setup dfusionRepo with contract address %s', batchExchangeContract.options.address)

    this._contract = batchExchangeContract
    this._erc20Contract = erc20Contract
    this._web3 = web3
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
    this._contract.events
      .OrderPlacement()
      .on('connected', subscriptionId => {
        log.debug('Starting to listen for new orders. SubscriptionId: %s', subscriptionId)
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
          this._batchIdToDate(validUntilBatchId + 1),
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
        })
      })
      .on('changed', data => {
        log.warn('Changed/Removed order: %o', data)
      })
      .on('error', (error: Error) => {
        params.onError(error)
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
    let token = this._tokenCache[tokenAddress]

    if (!token) {
      const networkId = await this._getNetworkId()

      const tokenContract = this._erc20Contract.clone()
      tokenContract.options.address = tokenAddress

      // Get basic data from the contract
      const { symbol, decimals, name } = await _getDataFromErc20(tokenContract)

      const tokenJson = tokenList.find(token => token.addressByNetwork[networkId] === tokenAddress)
      token = {
        symbol,
        name,
        ...tokenJson,
        decimals: decimals as number,
        address: tokenAddress,
        known: !!tokenJson,
      }

      // Cache token if it's found, or null if is not
      this._tokenCache[tokenAddress] = token
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
