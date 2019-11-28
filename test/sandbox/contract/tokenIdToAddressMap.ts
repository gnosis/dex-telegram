import { stableCoinConverterContract } from '../../../src/contracts'
import Logger from '../../../src/helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Get token address from token id
 *  RUN:     yarn sandbox test/sandbox/contract/tokenIdToAddressMap.ts
 */
const log = new Logger('sandbox:contract/tokenIdToAddressMap')

async function exec (): Promise<void> {
  const tokenId = 1
  log.info('Get token address for token: %d', tokenId)
  const tokenAddress = await stableCoinConverterContract.methods.tokenIdToAddressMap(tokenId).call()
  log.info('Address: %s', tokenAddress)
}

exec().catch(log.errorHandler)
