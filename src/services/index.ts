import { batchExchangeContract, erc20Contract } from 'helpers/contracts'
import { web3 } from 'helpers/web3'

import DfusionServiceImpl, { DfusionService } from 'services/DfusionService'

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
