import assert from 'assert'
import { web3 } from 'helpers/web3'
import Logger from 'helpers/Logger'

require('dotenv').config()

/**
 *  SANDBOX: Get accounts from connected wallet
 *  RUN:     yarn sandbox test/sandbox/web3/getAccounts.ts
 */
const log = new Logger('sandbox:web3:getAccounts')

async function exec (): Promise<void> {
  const contractAddress = process.env.STABLE_COIN_CONTRACT_ADDRESS
  assert(contractAddress, 'STABLE_COIN_CONTRACT_ADDRESS is required env var')
  const topics = [
    // OrderPlacement
    // '0x951b66125eb3ef23450a52bb65cf4786c423cc944abb7de8a749a7d05642060e',

    // OrderCancelation
    // '0x36adb26c9fa7b5219b043ac78b698e6e539a937ff88758ab51b04d331e7111ed'

    // Deposit
    '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'

    // WithdrawRequest
    // '0x10067fd172dd3ef9b7819d1d8add346f7eb58f4d57b92610d15e964125443a89',

    // Withdraw
    // '0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb'
  ]

  const options = {
    fromBlock: 0,
    toBlock: 'latest',
    address: contractAddress,
    topics
  }
  log.info('Get past events with:\n%O', options)
  await web3.eth.getPastLogs(options).then(logs => log.info('RESULT: Past logs: %O', logs))
}

exec().catch(log.errorHandler)
