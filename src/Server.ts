import assert from 'assert'
import express, { Express } from 'express'
import * as http from 'http'

import { Logger } from '@gnosis.pm/dex-js'
import { Request, ParamsDictionary, Response, NextFunction } from 'express-serve-static-core'
import { addCache, noCache } from 'helpers'
import { DfusionService } from 'services/DfusionService'

const log = new Logger('server')
export interface Params {
  port: number
  dfusionService: DfusionService
}

export class Server {
  private _port: number
  private _server: http.Server | null = null
  private _dfusionService: DfusionService

  constructor(params: Params) {
    const { port, dfusionService } = params
    this._port = port
    this._dfusionService = dfusionService
  }

  public start(): Promise<void> {
    log.debug(`Starting server on port ${this._port}...`)
    assert(this._server === null, 'Server was already started')
    const app = express()

    // Register endpoints
    this._registerEndpoint(app)

    // Register middleware
    this._registerMiddleware(app)

    // Create server
    this._server = http.createServer(app)
    const server = this._server as http.Server

    // Error handling
    server.on('error', log.errorHandler)

    // Start to listen on port
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(this._port, () => {
        log.debug(`Server started on port ${this._port}!`)
        log.debug(`Ping URL: http://localhost:${this._port}/v1/health/ping`)
        log.debug(`Alive URL: http://localhost:${this._port}/v1/health/healthy`)
        resolve()
      })
    })
  }

  private _registerEndpoint(app: Express) {
    app.get('/v1/version', (_req, res) => {
      addCache(res, 120)
      res.status(200).send(this._dfusionService.getVersion())
    })

    app.get('/v1/health/ping', (_req, res) => {
      noCache(res)
      res.status(204).send()
    })

    app.get('/v1/health/healthy', (_req, res, next) => {
      noCache(res)
      this._dfusionService
        .isHealthy()
        .then(isHealthy => {
          if (isHealthy) {
            res.status(204).send()
          } else {
            res.status(500).send({ error: true, message: 'Not healthy' })
          }
        })
        .catch(next)
    })
  }

  private _registerMiddleware(app: Express) {
    // Handle errors
    app.use((error: Error, req: Request<ParamsDictionary, any, any>, res: Response<any>, _next: NextFunction) => {
      log.error(`Error ${req.method} ${req.url}`, error)
      res.status(500).send({ error: true, message: error.message, stack: error.stack })
    })
  }

  public async stop(): Promise<void> {
    if (this._server !== null) {
      const server = this._server
      log.debug(`Stopping server on port ${this._port}...`)
      return new Promise((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
          } else {
            log.debug('Server has been stopped')
            resolve()
          }
        })
        this._server = null
      })
    } else {
      log.warn('Server was already stopped')
    }
  }
}

export default Server
