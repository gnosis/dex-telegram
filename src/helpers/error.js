import Logger from 'util/Logger'
const log = new Logger('error')

process.on('unhandledRejection', error => {
  log.error('Uncaught promise rejection: ', error)
})
