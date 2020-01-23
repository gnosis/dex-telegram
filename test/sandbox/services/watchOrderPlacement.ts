import { dfusionService } from 'services'
import { Logger } from '@gnosis.pm/dex-js'

require('dotenv').config()

/**
 *  SANDBOX: Watch the placement of orders
 *  RUN:     yarn sandbox test/sandbox/services/watchOrderPlacement.ts
 */
const log = new Logger('sandbox:repos:watchOrderPlacement')

async function exec(): Promise<void> {
  dfusionService.watchOrderPlacement({
    onNewOrder(order) {
      log.info('New order: %O', order)
    },
    onError(error: Error) {
      log.error('Error watching order placements: ', error)
    },
  })
}

exec().catch(log.errorHandler)
