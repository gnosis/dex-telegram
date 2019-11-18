import BN from 'bn.js'

import { Contract, EventOptions, ContractOptions } from 'web3-eth-contract'
import { TransactionObject, ContractEvent, Callback } from './types'
import { EventLog } from 'web3-core'

export interface Order {
  buyToken: BN
  sellToken: BN
  validFrom: BN
  validUntil: BN
  priceNumerator: BN
  priceDenominator: BN
  usedAmount: BN
}

export interface SolutionData {
  batchId: BN
  solutionSubmitter: string
  feeReward: BN
  objectiveValue: BN
}

export interface OrderCancelation {
  owner: string
  id: BN
}

export interface Deposit {
  user: string
  token: string
  amount: BN
  stateIndex: BN
}

export interface WithdrawRequest {
  user: string
  token: string
  amount: BN
  stateIndex: BN
}

export interface Withdraw {
  user: string
  token: string
  amount: BN
}

export interface OrderPlacement {
  owner: string
  buyToken: BN
  sellToken: BN
  validFrom: BN
  validUntil: BN
  priceNumerator: BN
  priceDenominator: BN
}

export class StablecoinConverter extends Contract {
  // constructor(jsonInterface: any[], address?: string, options?: ContractOptions)
  constructor(jsonInterface: AbiItem[], address?: string, options?: ContractOptions): StablecoinConverter

  clone(): StablecoinConverter

  methods: {
    getSecondsRemainingInBatch(): TransactionObject<BN>

    feeDenominator(): TransactionObject<BN>

    getPendingWithdrawAmount(user: string, token: string): TransactionObject<BN>

    requestWithdraw(token: string, amount: number | string): TransactionObject<void>

    getPendingDepositAmount(user: string, token: string): TransactionObject<BN>

    deposit(token: string, amount: number | string): TransactionObject<void>

    getPendingWithdrawBatchNumber(user: string, token: string): TransactionObject<BN>

    TOKEN_ADDITION_FEE_IN_OWL(): TransactionObject<BN>

    feeToken(): TransactionObject<string>

    currentPrices(arg0: number | string): TransactionObject<BN>

    orders(arg0: string, arg1: number | string): TransactionObject<Order>

    numTokens(): TransactionObject<BN>

    lastCreditBatchId(arg0: string, arg1: string): TransactionObject<BN>

    latestSolution(): TransactionObject<SolutionData>

    getBalance(user: string, token: string): TransactionObject<BN>

    BATCH_TIME(): TransactionObject<BN>

    getCurrentBatchId(): TransactionObject<BN>

    requestFutureWithdraw(token: string, amount: number | string, batchId: number | string): TransactionObject<void>

    hasValidWithdrawRequest(user: string, token: string): TransactionObject<boolean>

    MAX_TOKENS(): TransactionObject<BN>

    getPendingDepositBatchNumber(user: string, token: string): TransactionObject<BN>

    withdraw(user: string, token: string): TransactionObject<void>

    MAX_TOUCHED_ORDERS(): TransactionObject<BN>

    addToken(token: string): TransactionObject<void>

    placeValidFromOrder(
      buyToken: number | string,
      sellToken: number | string,
      validFrom: number | string,
      validUntil: number | string,
      buyAmount: number | string,
      sellAmount: number | string,
    ): TransactionObject<BN>

    placeOrder(
      buyToken: number | string,
      sellToken: number | string,
      validUntil: number | string,
      buyAmount: number | string,
      sellAmount: number | string,
    ): TransactionObject<BN>

    cancelOrder(id: number | string): TransactionObject<void>

    freeStorageOfOrder(ids: (number | string)[]): TransactionObject<void>

    submitSolution(
      batchIndex: number | string,
      owners: string[],
      orderIds: (number | string)[],
      volumes: (number | string)[],
      prices: (number | string)[],
      tokenIdsForPrice: (number | string)[],
    ): TransactionObject<void>

    tokenAddressToIdMap(addr: string): TransactionObject<BN>

    tokenIdToAddressMap(id: number | string): TransactionObject<string>

    getEncodedAuctionElements(): TransactionObject<string>

    acceptingSolutions(batchIndex: number | string): TransactionObject<boolean>

    getCurrentObjectiveValue(): TransactionObject<BN>
  }
  events: {
    OrderPlacement: ContractEvent<OrderPlacement>
    OrderCancelation: ContractEvent<OrderCancelation>
    Deposit: ContractEvent<Deposit>
    WithdrawRequest: ContractEvent<WithdrawRequest>
    Withdraw: ContractEvent<Withdraw>

    allEvents: (options?: EventOptions, cb?: Callback<EventLog>) => ContractEvent<AnyEvent>
  }
}

type AnyEvent = OrderPlacement | OrderCancelation | Deposit | WithdrawRequest | Withdraw
