import { web3 } from '@gnosis.pm/dex-js/build/helpers/web3'
import { batchExchangeContract, erc20Contract } from '@gnosis.pm/dex-js/build/contracts'

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
