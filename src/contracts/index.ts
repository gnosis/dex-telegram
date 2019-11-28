import assert from 'assert'
import { web3 } from 'helpers/web3'
import { StablecoinConverter } from './StablecoinConverter.d'
import { Erc20Contract } from './Erc20Contract'
import Erc20ABI from './Erc20ABI'

function getStableConverterContract(): StablecoinConverter {
  const { STABLE_COIN_CONTRACT_ADDRESS } = process.env
  assert(STABLE_COIN_CONTRACT_ADDRESS, 'STABLE_COIN_CONTRACT_ADDRESS env is required')

  const stableCoinContractAddress = STABLE_COIN_CONTRACT_ADDRESS as string

  const abi = require('./StablecoinConverter.json')

  // FIXME: There's an issue with this conversion
  const unknownContract = new web3.eth.Contract(abi, stableCoinContractAddress) as unknown
  return unknownContract as StablecoinConverter
}

function getErc20Contract(): Erc20Contract {
  // FIXME: There's an issue with this conversion
  const unknownContract = new web3.eth.Contract(Erc20ABI) as any
  return unknownContract as Erc20Contract
}

// Create contracts
export const stableCoinConverterContract: StablecoinConverter = getStableConverterContract()
export const erc20Contract: Erc20Contract = getErc20Contract()
