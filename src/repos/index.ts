import { DfusionRepo } from 'types'
import DfusionRepoImpl from './dfusion/DfusionRepoImpl'
import { stableCoinConverterContract } from '../contracts'
import { web3 } from '../helpers/web3'

function createDfusionRepo (): DfusionRepo {
  return new DfusionRepoImpl({
    stableCoinConverterContract,
    web3
  })
}

// Build Repos
export const dfusionRepo: DfusionRepo = createDfusionRepo()
