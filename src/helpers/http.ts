import { Response } from 'express-serve-static-core'

export function addCache(res: Response<any>, maxAge: number) {
  res.set('Cache-Control', 'public, max-age=' + maxAge)
}

export function noCache(res: Response<any>) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
}
