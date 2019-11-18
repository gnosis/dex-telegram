import { web3 } from '../../../src/helpers/web3'
import Logger from '../../../src/helpers/Logger'
import { AbiItem } from 'web3-utils'

require('dotenv').config()

/**
 *  SANDBOX: Print the encoded version for the functions
 *  RUN:     yarn sandbox test/sandbox/contract/printEncodedFunctions.ts
 */
const log = new Logger('sandbox:printEncodedFunctions')

async function exec (): Promise<void> {
  const abi = require('../../../src/contracts/StablecoinConverter.json')
  const functions = abi.filter((def: AbiItem) => def.type === 'function')

  log.info('Found %d functions:', functions.length)
  functions.forEach((def: AbiItem) => {
    log.info('  - %s: ', def.name, web3.eth.abi.encodeFunctionSignature(def))
  })
}

exec().catch(log.errorHandler)
