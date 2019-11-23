import Web3 from 'web3'

import Logger from 'helpers/Logger'
import { ContractEventLog } from 'contracts/types'
import { OrderPlacement, StablecoinConverter } from 'contracts/StablecoinConverter'
import BN = require('bn.js')

const log = new Logger('service:dfusion')

interface Params {
  stableCoinConverterContract: StablecoinConverter
  web3: Web3
}

export interface DfusionService {
  // Watch events
  watchOrderPlacement(params: WatchOrderPlacementParams): void

  // Basic info
  getNetworkId(): Promise<number>
  getNodeInfo(): Promise<String>
  getBlockNumber(): Promise<number>
}

export interface WatchOrderPlacementParams {
  onNewOrder: (order: OrderDto) => void
  onError: (error: Error) => void
}

export interface OrderDto {
  owner: string
  buyToken: string
  sellToken: string
  validFrom: Date
  validUntil: Date
  validFromBatchId: BN
  validUntilBatchId: BN
  priceNumerator: BN
  priceDenominator: BN
  event: ContractEventLog<OrderPlacement>
}

export class DfusionRepoImpl implements DfusionService {
  private _web3: Web3
  private _contract: StablecoinConverter

  constructor (params: Params) {
    const { web3, stableCoinConverterContract } = params
    log.debug('Setup dfusionRepo with contract address %s', stableCoinConverterContract.options.address)

    this._contract = stableCoinConverterContract
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

        const [sellToken, buyToken] = await Promise.all([
          this._getTokenAddress(sellTokenId),
          this._getTokenAddress(buyTokenId)
        ])
        const priceNumerator = new BN(priceNumeratorString)
        const priceDenominator = new BN(priceDenominatorString)
        const validFromBatchId = new BN(validFromBatchIdString)
        const validUntilBatchId = new BN(validUntilBatchIdString)
        const validFrom = new Date()
        const validUntil = new Date()

        log.info(`New order in tx ${event.blockHash}:
    - Owner: ${owner}
    - Sell token: ${sellToken}
    - Buy token: ${buyToken}
    - Price: ${priceNumerator}/${priceDenominator} = ${priceNumerator.div(priceDenominator).toNumber()}
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
          validFrom,
          validUntil,
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

  private _getTokenAddress (id: string | number): Promise<string> {
    return this._contract.methods.tokenIdToAddressMap(id).call()
  }

  public getNetworkId (): Promise<number> {
    return this._web3.eth.getChainId()
  }

  public getNodeInfo (): Promise<String> {
    return this._web3.eth.getNodeInfo()
  }

  public getBlockNumber (): Promise<number> {
    return this._web3.eth.getBlockNumber()
  }
}

export default DfusionRepoImpl
