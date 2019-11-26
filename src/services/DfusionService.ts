import Web3 from 'web3'

import Logger from 'helpers/Logger'
import { ContractEventLog } from 'contracts/types'
import { OrderPlacement, StablecoinConverter } from 'contracts/StablecoinConverter'
import packageJson from '../../package.json'
import { BigNumber } from 'bignumber.js'
import { Erc20Contract } from 'contracts/Erc20Contract'

// TODO: Create common lib with the API/repo
import tokenList = require('@gnosis.pm/dex-react/src/api/tokenList/tokenList.json')

const log = new Logger('service:dfusion')

export interface Params {
  stableCoinConverterContract: StablecoinConverter
  erc20Contract: Erc20Contract
  web3: Web3
}

export interface DfusionService {
  // Watch events
  watchOrderPlacement(params: WatchOrderPlacementParams): void

  // Basic info
  getAbout(): Promise<AboutDto>
}

export interface WatchOrderPlacementParams {
  onNewOrder: (order: OrderDto) => void
  onError: (error: Error) => void
}

interface TokenDto {
  name?: string
  symbol?: string
  decimals: number
  address: string
}

interface AboutDto {
  blockNumber: number
  networkId: number
  nodeInfo: string
  version: string
  stablecoinConverterAddress: string
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
  private _contract: StablecoinConverter
  private _erc20Contract: Erc20Contract
  private _networkId: number
  private _batchTime: BigNumber
  private _tokenCache: { [tokenAddress: string]: TokenDto } = {}

  constructor (params: Params) {
    const { web3, stableCoinConverterContract, erc20Contract } = params
    log.debug('Setup dfusionRepo with contract address %s', stableCoinConverterContract.options.address)

    this._contract = stableCoinConverterContract
    this._erc20Contract = erc20Contract
    this._web3 = web3
  }

  public watchOrderPlacement (params: WatchOrderPlacementParams) {
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
          validUntil: validUntilBatchIdString
        } = event.returnValues
        const priceNumerator = new BigNumber(priceNumeratorString)
        const priceDenominator = new BigNumber(priceDenominatorString)
        const validFromBatchId = new BigNumber(validFromBatchIdString)
        const validUntilBatchId = new BigNumber(validUntilBatchIdString)

        const [sellTokenAddress, buyTokenAddress] = await Promise.all([
          this._getTokenAddress(sellTokenId),
          this._getTokenAddress(buyTokenId)
        ])
        const [sellToken, buyToken, validFrom, validUntil] = await Promise.all([
          this._getToken(sellTokenAddress),
          this._getToken(buyTokenAddress),
          this._batchIdToDate(validFromBatchId),
          this._batchIdToDate(validUntilBatchId)
        ])

        log.info(`New order in tx ${event.blockHash}:
    - Owner: ${owner}
    - Sell token: ${sellToken}
    - Buy token: ${buyToken}
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
          event
        })
      })
      .on('changed', data => {
        log.warn('Changed/Removed order: %o', data)
      })
      .on('error', (error: Error) => {
        params.onError(error)
      })
  }

  public async getAbout (): Promise<AboutDto> {
    const [blockNumber, networkId, nodeInfo] = await Promise.all([
      this._web3.eth.getBlockNumber(),
      this._getNetworkId(),
      this._web3.eth.getNodeInfo()
    ])

    return {
      blockNumber,
      networkId,
      nodeInfo,
      version: packageJson.version,
      stablecoinConverterAddress: this._contract.options.address
    }
  }

  private async _getNetworkId (): Promise<number> {
    if (!this._networkId) {
      this._networkId = await this._web3.eth.getChainId()
    }

    return this._networkId
  }

  private _getTokenAddress (id: string | number): Promise<string> {
    return this._contract.methods.tokenIdToAddressMap(id).call()
  }

  private async _getToken (tokenAddress: string): Promise<TokenDto> {
    let token = this._tokenCache[tokenAddress]

    if (!token) {
      const networkId = await this._getNetworkId()

      const tokenContract = this._erc20Contract.clone()
      tokenContract.options.address = tokenAddress

      // Get basic data from the contract
      const [symbol, decimals, name] = await Promise.all([
        tokenContract.methods
          .symbol()
          .call()
          .then(symbol => 'Maybe ' + symbol)
          .catch(() => undefined),
        tokenContract.methods
          .decimals()
          .call()
          .then(parseInt)
          .catch(() => 18),
        tokenContract.methods
          .name()
          .call()
          .then(name => 'Maybe ' + name)
          .catch(() => undefined)
      ])

      const tokenJson = tokenList.find(token => token.addressByNetwork[networkId] === tokenAddress)
      token = {
        symbol,
        name,
        ...tokenJson,
        decimals: decimals as number,
        address: tokenAddress
      }

      // Cache token if it's found, or null if is not
      this._tokenCache[tokenAddress] = token
    }

    return token
  }

  private async _getBatchTime (): Promise<BigNumber> {
    if (!this._batchTime) {
      this._batchTime = new BigNumber(await this._contract.methods.BATCH_TIME().call())
    }
    return this._batchTime
  }

  // TODO: Move to utils project
  private async _batchIdToDate (batchId: BigNumber): Promise<Date> {
    const batchTime = await this._getBatchTime()

    return new Date(
      batchId
        .multipliedBy(batchTime)
        .multipliedBy(new BigNumber(1000))
        .toNumber()
    )
  }
}

export default DfusionRepoImpl
