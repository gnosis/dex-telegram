import { ContractEventLog } from 'contracts/types'
import { OrderPlacement } from 'contracts/StablecoinConverter'

export type Command = () => void
export interface WatchOrderPlacementParams {
  onNewOrder: (event: ContractEventLog<OrderPlacement>) => void
  onError: (error: Error) => void
}

export interface DfusionRepo {
  // Watch events
  watchOrderPlacement(params: WatchOrderPlacementParams): void

  // Basic info
  getNetworkId(): Promise<number>
  getNodeInfo(): Promise<String>
  getBlockNumber(): Promise<number>
}
