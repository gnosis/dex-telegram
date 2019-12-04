import assert from 'assert'
import express, { Express } from 'express'
import * as http from 'http'

import Logger from 'helpers/Logger'
import { Request, ParamsDictionary, Response, NextFunction } from 'express-serve-static-core'

const log = new Logger('server')
export interface Params {
  port: number
}

export class Server {
  private _port: number
  private _server: http.Server | null = null

  constructor (params: Params) {
    const { port } = params
    this._port = port
  }

  public start (): Promise<void> {
    assert(this._server === null, 'Server was already started')
    const app = express()

    // Register endpoints
    this._registerEndpoint(app)

    // Register middleware
    this._registerMiddleware(app)

    // Create server
    this._server = http.createServer(app)
    const server = this._server as http.Server

    // Start to listen on port
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(this._port, () => {
        log.debug(`Listening on port ${this._port}!`)
        log.debug(`Ping URL: http://localhost:${this._port}/v1/health/ping`)
        log.debug(`Alive URL: http://localhost:${this._port}/v1/health/alive`)
        resolve()
      })
    })
  }

  private _registerEndpoint (app: Express) {
    app.get('/v1/health/ping', (_req, res) => res.status(204).send())
    app.get('/v1/health/alive', (_req, res) => res.status(204).send())
  }

  private _registerMiddleware (app: Express) {
    app.use((err: Error, req: Request<ParamsDictionary, any, any>, res: Response<any>, _next: NextFunction) => {
      log.error(`Error ${req.method} ${req.url}`, err)
      res.status(500).send({ error: true, message: err.message, stack: err.stack })
    })
  }

  public stop () {
    this._server = null
  }
}

export default Server
