import Web3 from 'web3'
import { getProvider } from './provider'

import Logger from './Logger'

const log = new Logger('web3')
log.debug('Init')

export const web3 = new Web3(getProvider())
