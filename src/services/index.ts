import DfusionServiceImpl, { DfusionService } from 'services/DfusionService'
import { stableCoinConverterContract } from 'contracts'
import { web3 } from 'helpers/web3'

function createDfusionService (): DfusionService {
  return new DfusionServiceImpl({
    stableCoinConverterContract,
    web3
  })
}

// Build Repos
export const dfusionService: DfusionService = createDfusionService()
