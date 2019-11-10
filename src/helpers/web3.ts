import { strict as assert } from 'assert'
import Web3 from 'web3'

assert(process.env.NODE_URL, 'NODE_URL env var is required')

export const provider = new Web3.providers.HttpProvider(process.env.NODE_URL as string)
export const web3 = new Web3(provider)
