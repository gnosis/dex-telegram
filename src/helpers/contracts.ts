import { createBatchExchangeContract, createErc20Contract, createTcrContract } from '@gnosis.pm/dex-js'
import { web3 } from './web3'
import { TCR_CONTRACT_ADDRESS } from 'config'

export const batchExchangeContract = createBatchExchangeContract(web3)
export const erc20Contract = createErc20Contract(web3)
export const tcrContract = TCR_CONTRACT_ADDRESS ? createTcrContract(web3, TCR_CONTRACT_ADDRESS) : undefined
