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
    onNewOrder (order: any) {
      log.info('New order: %o', order)
    },
    onError (error: Error) {
      log.error('Error watching order placements: ', error)
    }
  })
}

exec().catch(log.errorHandler)
