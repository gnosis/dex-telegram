import { web3 } from 'helpers/web3'
import Logger from 'helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Get accounts from connected wallet
 *  RUN:     yarn sandbox test/sandbox/web3/getAccounts.ts
 */
const log = new Logger('sandbox:web3:getAccounts')

async function exec(): Promise<void> {
  log.debug('Default account: ', web3.eth.defaultAccount)
  log.debug('All accounts: %o', await web3.eth.getAccounts())
}

exec().catch(log.errorHandler)
