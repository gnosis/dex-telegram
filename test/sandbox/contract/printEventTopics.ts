import { web3 } from 'helpers/web3'
import Logger from 'helpers/Logger'
import { AbiItem } from 'web3-utils'

require('dotenv').config()

/**
 *  SANDBOX: Prints events topics
 *  RUN:     yarn sandbox test/sandbox/contract/printEventTopics.ts
 */
const log = new Logger('sandbox:contract/printEventTopics')

async function exec (): Promise<void> {
  const abi = require('contracts/StablecoinConverter.json')
  const events = abi.filter((def: AbiItem) => def.type === 'event')

  log.info('Found %d events:', events.length)
  events.forEach((def: AbiItem) => {
    log.info('  - %s: ', def.name, web3.eth.abi.encodeEventSignature(def))
  })
}

exec().catch(log.errorHandler)
