import DfusionServiceImpl, { DfusionService } from 'services/DfusionService'
import { batchExchangeContract, erc20Contract } from '@gnosis.pm/dex-js/build/src/contracts/index'
import { web3 } from '@gnosis.pm/dex-js/build/src/helpers/web3'

function createDfusionService (): DfusionService {
  return new DfusionServiceImpl({
    batchExchangeContract,
    erc20Contract,
    web3
  })
}

// Build Repos
export const dfusionService: DfusionService = createDfusionService()

// Reexport all definitions
export * from './DfusionService'
