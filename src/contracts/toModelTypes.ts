import {
  Order as OrderVo,
  SolutionData as SolutionDataVo,
  OrderCancelation as OrderCancelationVo,
  Deposit as DepositVo,
  WithdrawRequest as WithdrawRequestVo,
  Withdraw as WithdrawVo,
  OrderPlacement as OrderPlacementVo,
} from 'contracts/StablecoinConverter'
import BN = require('bn.js')
import { Order, SolutionData, OrderCancelation, Deposit, WithdrawRequest, Withdraw, OrderPlacement } from 'types'
import { ContractEventLog } from './types'

export function toOrder(vo: OrderVo): Order {
  return {
    buyToken: new BN(vo.buyToken),
    sellToken: new BN(vo.sellToken),
    validFrom: new BN(vo.validFrom),
    validUntil: new BN(vo.validUntil),
    priceNumerator: new BN(vo.priceNumerator),
    priceDenominator: new BN(vo.priceDenominator),
    usedAmount: new BN(vo.usedAmount),
  }
}

export function toSolutionData(vo: SolutionDataVo): SolutionData {
  return {
    ...vo,
    batchId: new BN(vo.batchId),
    feeReward: new BN(vo.feeReward),
    objectiveValue: new BN(vo.objectiveValue),
  }
}

export function toOrderCancelation(vo: OrderCancelationVo): OrderCancelation {
  return {
    ...vo,
    id: new BN(vo.id),
  }
}

export function toDeposit(vo: DepositVo): Deposit {
  return {
    ...vo,
    amount: new BN(vo.amount),
    stateIndex: new BN(vo.stateIndex),
  }
}

export function toWithdrawRequest(vo: WithdrawRequestVo): WithdrawRequest {
  return {
    ...vo,
    amount: new BN(vo.amount),
    stateIndex: new BN(vo.stateIndex),
  }
}

export function toWithdraw(vo: WithdrawVo): Withdraw {
  return {
    ...vo,
    amount: new BN(vo.amount),
  }
}

export function toOrderPlacement(vo: OrderPlacementVo): OrderPlacement {
  return {
    ...vo,
    buyToken: new BN(vo.buyToken),
    sellToken: new BN(vo.sellToken),
    validFrom: new BN(vo.validFrom),
    validUntil: new BN(vo.validUntil),
    priceNumerator: new BN(vo.priceNumerator),
    priceDenominator: new BN(vo.priceDenominator),
  }
}

export function toContractEventLog<T, U>(
  event: ContractEventLog<T>,
  transformFromTo: (vo: T) => U,
): ContractEventLog<U> {
  return {
    ...event,
    returnValues: transformFromTo(event.returnValues),
  }
}
