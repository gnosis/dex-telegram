import { web3 } from 'helpers/web3'
import Logger from 'helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Get ethereum node info
 *  RUN:     yarn sandbox test/sandbox/web3/getNodeInfo.ts
 */
const log = new Logger('sandbox:web3:getNodeInfo')

async function exec(): Promise<void> {
  log.debug('web3 version: ', web3.version)
  log.debug('Chain id: ', await web3.eth.getChainId())
  log.debug('Node info: ', await web3.eth.getNodeInfo())
  log.debug('Protocol version: ', await web3.eth.getProtocolVersion())
  log.debug('Transaction confirmation blocks: ', web3.eth.transactionConfirmationBlocks)
  log.debug('Transaction polling timeout (HTTP connection): ', web3.eth.transactionPollingTimeout)
  log.debug('Transaction block timeout (socket based connection): ', web3.eth.transactionBlockTimeout)
  log.debug('Default block: ', web3.eth.defaultBlock)
  log.debug('Current block: ', await web3.eth.getBlockNumber())
  log.debug('Get latest block: %o', await web3.eth.getBlock('latest'))
}

exec().catch(log.errorHandler)
