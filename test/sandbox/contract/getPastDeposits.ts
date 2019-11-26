import { stableCoinConverterContract } from '../../../src/contracts'
import Logger from '../../../src/helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Prints events topics
 *  RUN:     yarn sandbox test/sandbox/contract/getPastDeposits.ts
 */
const log = new Logger('sandbox:contract/getPastDeposits')

async function exec (): Promise<void> {
  log.info('Get past deposits for contract: %s', stableCoinConverterContract.options.address)
  const events = await stableCoinConverterContract.getPastEvents('Deposit', { fromBlock: 0, toBlock: 'latest' })

  log.info('Found %d deposits', events.length)
  events.forEach(depositEvent => {
    const { user, token, amount, stateIndex } = depositEvent.returnValues
    log.info(
      'New Deposit of user %s\n\tAmount: %s\n\tToken: %s\n\tState index: %s\n\tTransaction: %s',
      user,
      amount,
      token,
      stateIndex,
      depositEvent.transactionHash
    )
  })
}

exec().catch(log.errorHandler)
