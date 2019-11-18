import { Debugger, debug } from 'debug'

export class Logger {
  private _loggers: { [namespace: string]: Debugger } = {}
  private _namespace: string
  public errorHandler: (formatter: any, ...args: any[]) => any

  constructor (namespace: string) {
    this._namespace = namespace
    this.errorHandler = this.error.bind(this)
  }

  public info (formatter: any, ...args: any[]) {
    this._log('INFO', formatter, ...args)
  }

  public trace (formatter: any, ...args: any[]) {
    this._log('TRACE', formatter, ...args)
  }

  public debug (formatter: any, ...args: any[]) {
    this._log('DEBUG', formatter, ...args)
  }

  public warn (formatter: any, ...args: any[]) {
    this._log('WARN', formatter, ...args)
  }

  public error (formatter: any, ...args: any[]) {
    this._log('ERROR', formatter, ...args)
  }

  public _log (level: string, formatter: any, ...args: any[]) {
    const logger = this._getLogger(level, this._namespace)
    logger(formatter, ...args)
  }

  private _getLogger (logLevel: string, namespace: string) {
    const loggerName = logLevel + '-' + namespace

    let logger: Debugger = this._loggers[loggerName]
    if (!logger) {
      logger = debug(loggerName)

      // Use STDOUT for non error messages
      let consoleFn
      if (logLevel === 'DEBUG') {
        consoleFn = 'debug'
      } else if (logLevel === 'INFO') {
        consoleFn = 'info'
      } else if (logLevel === 'WARN') {
        consoleFn = 'warn'
      }

      if (consoleFn) {
        // Set the console logger function (to use STDOUT)
        // Note that by default is console.error
        logger.log = console[consoleFn].bind(console)
      }

      this._loggers[namespace] = logger
    }

    return logger
  }
}

export default Logger
