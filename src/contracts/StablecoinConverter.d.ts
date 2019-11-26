import { Contract, EventOptions, ContractOptions } from 'web3-eth-contract'
import { TransactionObject, ContractEvent, Callback } from './types'
import { EventLog } from 'web3-core'

export interface Order {
  buyToken: string
  sellToken: string
  validFrom: string
  validUntil: string
  priceNumerator: string
  priceDenominator: string
  usedAmount: string
}

export interface SolutionData {
  batchId: string
  solutionSubmitter: string
  feeReward: string
  objectiveValue: string
}

export interface OrderCancelation {
  owner: string
  id: string
}

export interface Deposit {
  user: string
  token: string
  amount: string
  stateIndex: string
}

export interface WithdrawRequest {
  user: string
  token: string
  amount: string
  stateIndex: string
}

export interface Withdraw {
  user: string
  token: string
  amount: string
}

export interface OrderPlacement {
  owner: string
  buyToken: string
  sellToken: string
  validFrom: string
  validUntil: string
  priceNumerator: string
  priceDenominator: string
}

export class StablecoinConverter extends Contract {
  // constructor(jsonInterface: any[], address?: string, options?: ContractOptions)
  constructor(jsonInterface: AbiItem[], address?: string, options?: ContractOptions): StablecoinConverter

  clone(): StablecoinConverter

  methods: {
    getSecondsRemainingInBatch(): TransactionObject<string>

    feeDenominator(): TransactionObject<string>

    getPendingWithdrawAmount(user: string, token: string): TransactionObject<string>

    requestWithdraw(token: string, amount: number | string): TransactionObject<void>

    getPendingDepositAmount(user: string, token: string): TransactionObject<string>

    deposit(token: string, amount: number | string): TransactionObject<void>

    getPendingWithdrawBatchNumber(user: string, token: string): TransactionObject<string>

    TOKEN_ADDITION_FEE_IN_OWL(): TransactionObject<string>

    feeToken(): TransactionObject<string>

    currentPrices(arg0: number | string): TransactionObject<string>

    orders(arg0: string, arg1: number | string): TransactionObject<Order>

    numTokens(): TransactionObject<string>

    lastCreditBatchId(arg0: string, arg1: string): TransactionObject<string>

    latestSolution(): TransactionObject<SolutionData>

    getBalance(user: string, token: string): TransactionObject<string>

    BATCH_TIME(): TransactionObject<string>

    getCurrentBatchId(): TransactionObject<string>

    requestFutureWithdraw(token: string, amount: number | string, batchId: number | string): TransactionObject<void>

    hasValidWithdrawRequest(user: string, token: string): TransactionObject<boolean>

    MAX_TOKENS(): TransactionObject<string>

    getPendingDepositBatchNumber(user: string, token: string): TransactionObject<string>

    withdraw(user: string, token: string): TransactionObject<void>

    MAX_TOUCHED_ORDERS(): TransactionObject<string>

    addToken(token: string): TransactionObject<void>

    placeValidFromOrder(
      buyToken: number | string,
      sellToken: number | string,
      validFrom: number | string,
      validUntil: number | string,
      buyAmount: number | string,
      sellAmount: number | string,
    ): TransactionObject<string>

    placeOrder(
      buyToken: number | string,
      sellToken: number | string,
      validUntil: number | string,
      buyAmount: number | string,
      sellAmount: number | string,
    ): TransactionObject<string>

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

    tokenAddressToIdMap(addr: string): TransactionObject<string>

    tokenIdToAddressMap(id: number | string): TransactionObject<string>

    getEncodedAuctionElements(): TransactionObject<string>

    acceptingSolutions(batchIndex: number | string): TransactionObject<boolean>

    getCurrentObjectiveValue(): TransactionObject<string>
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
