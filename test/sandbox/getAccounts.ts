import { web3 } from '../../src/helpers/web3'
import Logger from '../../src/helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Get accounts from connected wallet
 *  RUN:     yarn sandbox test/sandbox/getAccounts.ts
 */
const log = new Logger('sandbox:getAccounts')

async function exec (): Promise<void> {
  log.debug('Default account: ', web3.eth.defaultAccount)
  log.debug('All accounts: %o', await web3.eth.getAccounts())
}

exec().catch(log.error)