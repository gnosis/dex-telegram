import BN from 'bn.js'

import { TransactionObject } from 'contracts/types'
import { Contract } from 'web3-eth-contract'

export interface Erc20Contract extends Contract {
  clone(): Erc20Contract

  methods: {
    totalSupply(): TransactionObject<string>
    decimals(): TransactionObject<string>
    symbol(): TransactionObject<string>
    name(): TransactionObject<string>

    balanceOf(owner: string): TransactionObject<string, [string]>

    allowance(owner: string, spender: string): TransactionObject<string, [string, string]>

    approve(spender: string, value: number | string | BN): TransactionObject<boolean, [string, string | number | BN]>

    transfer(to: string, value: number | string | BN): TransactionObject<boolean, [string, string | number | BN]>

    transferFrom(
      from: string,
      to: string,
      value: number | string | BN,
    ): TransactionObject<boolean, [string, string, string | number | BN]>
  }
}
