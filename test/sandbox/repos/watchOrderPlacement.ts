import { DfusionRepo } from '../../../src/types'
import { dfusionRepo as dfusionRepoAny } from '../../../src/repos'
import Logger from '../../../src/helpers/Logger'

require('dotenv').config()

// FIXME: It's not gessing the right type of dfusionRepo
const dfusionRepo = dfusionRepoAny as DfusionRepo

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
