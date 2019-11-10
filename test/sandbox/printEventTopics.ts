import { web3 } from '../../src/helpers/web3'
import Logger from '../../src/helpers/Logger'
import { AbiItem } from 'web3-utils'

require('dotenv').config()

/**
 *  SANDBOX: Get accounts from connected wallet
 *  RUN:     yarn sandbox test/sandbox/printEventTopics.ts
 */
const log = new Logger('sandbox:printEventTopics')

async function exec (): Promise<void> {
  const abi = require('../../src/contracts/StablecoinConverter.json')
  const events = abi.filter((def: AbiItem) => def.type === 'event')

  log.info('Found %d events:', events.length)
  events.forEach((def: AbiItem) => {
    log.info('  - %s: ', def.name, web3.eth.abi.encodeEventSignature(def))
  })
}

exec().catch(log.error)
