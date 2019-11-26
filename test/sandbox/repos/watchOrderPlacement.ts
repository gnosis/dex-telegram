import { dfusionRepo } from 'repos'
import Logger from 'helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Watch the placement of orders
 *  RUN:     yarn sandbox test/sandbox/repos/watchOrderPlacement.ts
 */
const log = new Logger('sandbox:repos:watchOrderPlacement')

async function exec (): Promise<void> {
  dfusionRepo.watchOrderPlacement({
    onNewOrder (event) {
      log.info('New order: %o in block %d, transaction %s', event, event.blockNumber, event.transactionHash)
    },
    onError (error: Error) {
      log.error('Error watching order placements: ', error)
    }
  })
}

exec().catch(log.errorHandler)
