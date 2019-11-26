import { EventEmitter } from 'events'
import { PromiEvent, TransactionConfig, TransactionReceipt, EventLog } from 'web3-core'
import { EventOptions, SendOptions, EstimateGasOptions } from 'web3-eth-contract'

type CallTxOptions = Pick<TransactionConfig, 'from' | 'gas' | 'gasPrice'>

type CallTxCallback = <T>(error: Error | null, result: T) => void
type SendTxCallback = (error: Error | null, transactionHash: string) => void
type EstimateGasTxCallback = (error: Error | null, gasAmount: number) => void

export type Callback<T> = (error: Error, result: T) => void

export interface TransactionObject<T, U extends any[] = []> {
  arguments: U

  call(callback: CallTxCallback): Promise<T>
  call(options?: CallTxOptions, callback?: CallTxCallback): Promise<T>

  send(callback: SendTxCallback): PromiEvent<TransactionReceipt>
  send(options?: SendOptions, callback?: SendTxCallback): PromiEvent<TransactionReceipt>

  estimateGas(callback: EstimateGasTxCallback): Promise<number>
  estimateGas(options?: EstimateGasOptions, callback?: EstimateGasTxCallback): Promise<number>

  encodeABI(): string
}

export interface ContractEventLog<T> extends EventLog {
  returnValues: T
}

export interface ContractEventEmitter<T> extends EventEmitter {
  on(event: 'connected', listener: (subscriptionId: string) => void): this
  on(event: 'data' | 'changed', listener: (event: ContractEventLog<T>) => void): this
  on(event: 'error', listener: (error: Error) => void): this
}

export type ContractEvent<T> = (options?: EventOptions, cb?: Callback<ContractEventLog<T>>) => ContractEventEmitter<T>
