import Web3 from 'web3'

import Logger from '../../helpers/Logger'
import { DfusionRepo, WatchOrderPlacementParams } from 'types'
import { StablecoinConverter } from '../../contracts/StablecoinConverter'
// import BN = require('bn.js')

const log = new Logger('repos:dfusion')

interface Params {
  stableCoinConverterContract: StablecoinConverter
  web3: Web3
}

export class DfusionRepoImpl implements DfusionRepo {
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
      .OrderPlacement({}, error => params.onError(error))
      .on('connected', subscriptionId => {
        log.debug('Starting to listen for new orders. SubscriptionId: %s', subscriptionId)
      })
      .on('data', data => {
        log.info('New order: %o', data)
        params.onNewOrder(data)
      })
      .on('changed', data => {
        log.warn('Changed/Removed order: %o', data)
      })
      .on('error', (error: Error) => {
        params.onError(error)
      })
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
