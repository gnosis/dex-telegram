import { createBatchExchangeContract, createErc20Contract } from '@gnosis.pm/dex-js'
import { web3 } from './web3'

export const batchExchangeContract = createBatchExchangeContract(web3)
export const erc20Contract = createErc20Contract(web3)
