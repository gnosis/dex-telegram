import { strict as assert } from 'assert'
import Web3 from 'web3'

import Logger from './Logger'
const log = new Logger('helpers:web3')
const nodeUrl = process.env.NODE_URL

log.info('Connecting to ethereum using web3: %s', nodeUrl)
assert(nodeUrl, 'NODE_URL env var is required')
export const provider = 'ws://localhost:8545'
export const web3: Web3 = new Web3(provider)
