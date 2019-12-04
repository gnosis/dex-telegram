import { sayHi, DfusionContract } from '@gnosis.pm/dex-js'
import Logger from 'helpers/Logger'

/**
 *  SANDBOX: Watch the placement of orders
 *  RUN:     yarn sandbox test/sandbox/dex-js/sayHi.ts
 */

const log = new Logger('sandbox:dex-js:sayHi')

async function exec (): Promise<void> {
  log.info('sayHi. DfusionContract: ', DfusionContract)
  sayHi()
}

exec().catch(log.errorHandler)
