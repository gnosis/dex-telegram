import Logger from 'util/Logger'
import { Command } from 'types'

const log = new Logger('helpers:shutdown')
type QuitSignal = 'SIGINT' | 'SIGTERM' | 'SIGQUIT'
const POSIX_SIGNALS: QuitSignal[] = ['SIGINT', 'SIGTERM', 'SIGQUIT']
const listeners: Command[] = []
let isRunning = true

POSIX_SIGNALS.forEach(signal => {
  process.on(signal, () => {
    _doShutDown(`I've gotten a ${signal} signal`)
  })
})

export function onShutdown (listener: Command) {
  log.debug('Registering a new listener')
  listeners.push(listener)
}

export async function shutDown (reason: string) {
  if (!isRunning) {
    return
  }

  isRunning = false
  const reasonPrefix = reason ? reason + ': ' : ''
  log.debug(reasonPrefix + 'Closing gracefully...')

  // Wait for all shutdown listeners
  await Promise.all(
    listeners.map(listener => {
      return listener()
    })
  )
}

function _doShutDown (reason: string) {
  function _doExit (returnCode: number | undefined) {
    log.debug('The app is ready to shutdown! Good bye! :)')
    process.exit(returnCode)
  }

  shutDown(reason)
    .then(() => {
      _doExit(0)
    })
    .catch(error => {
      log.error({
        msg: 'Error while shut down the app: ' + error.toString(),
        error
      })
      _doExit(2)
    })
}
