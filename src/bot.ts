import moment from 'moment-timezone'
import { Message, User } from 'node-telegram-bot-api'

import Server from 'Server'
import { Logger, logUnhandledErrors, onShutdown, assert } from '@gnosis.pm/dex-js'

import { dfusionService } from 'services'
import { newOrderMessage } from 'helpers'
import { BufferedBot } from 'bufferedBot'

const WEB_BASE_URL = process.env.WEB_BASE_URL
assert(WEB_BASE_URL, 'WEB_BASE_URL is required')
const port = parseInt(process.env.API_PORT || '3000')

moment.tz.setDefault('Etc/GMT')

logUnhandledErrors()

const log = new Logger('bot')
const token = process.env.TELEGRAM_TOKEN as string
const channelId = process.env.TELEGRAM_CHANNEL_ID as string

assert(token, 'TELEGRAM_TOKEN env var is required')
assert(channelId, 'TELEGRAM_CHANNEL_ID env var is required')

// Private channels are identified by numbers
const isPublicChannel = isNaN(channelId as any)
const channelHandle = isPublicChannel ? channelId : '**private chat**'

const bot = new BufferedBot(token, {
  polling: true,
})

bot.onText(/\/(\w+) ?(.+)?/, (msg: Message, match: RegExpExecArray | null) => {
  log.debug('New command: %o', msg)

  _runCommand(msg, match).catch(error => {
    log.error('Error running command for message: %o', msg)
    log.error(error)
  })
})

// Listen to any message
bot.on('message', (msg: Message) => {
  const isCommand = msg.text && msg.text.startsWith('/')
  if (!isCommand) {
    log.debug('Received msg: %o', msg)
    _helpCommand(msg)
  }
})

async function _runCommand(msg: Message, match: RegExpExecArray | null) {
  const command = match ? match[1] : ''
  switch (command) {
    case 'start':
    case 'help':
      return _helpCommand(msg)

    case 'about':
      return _aboutCommand(msg)

    default:
      return bot.sendMessage(msg.chat.id, "I don't recognize that command! You can use this other one instead: /help")
  }
}
async function _helpCommand(msg: Message) {
  const fromUser: User | undefined = msg.from
  return bot.sendMessage(
    msg.chat.id,
    `${fromUser ? 'Hi ' + fromUser.first_name : 'Hi there'}!
    
I don't talk much for now. I just notify every new order in the Gnosis Protocol channel.
Please, head to ${channelHandle} to get notified on every new order.

Also, you can find out more about me by using the command: /about`,
  )
}

async function _aboutCommand(msg: Message) {
  const {
    blockNumber,
    networkId,
    nodeInfo,
    version,
    dexJsVersion,
    contractsVersion,
    batchExchangeAddress,
    tcrContractAddress,
    tcrListId,
  } = await dfusionService.getAbout()

  return bot.sendMessage(
    msg.chat.id,
    `I'm just a bot watching the Gnosis Protocol smart contract.

If you want to know more about me, check out my code in https://github.com/gnosis/dex-telegram

In that repo you'll be able to fork me, open issues, or even better, give me additional functionality (Pull Requests are extremely welcomed 😀).

Some interesting facts are:
- Contract Address: ${batchExchangeAddress}
- Ethereum Network: ${networkId}
- Ethereum Node: ${nodeInfo}
- Last minted block: ${blockNumber}
- Bot version: ${version}
- Contract version: ${contractsVersion}
- dex-js version: ${dexJsVersion}
- TCR Contract Address: ${tcrContractAddress}
- TCR list id: ${tcrListId}

Also, here are some links you may find useful:
- https://github.com/gnosis/dex-contracts: Gnosis Protocol Smart Contracts
- https://github.com/gnosis/dex-research: Gnosis Protocol Research
- https://github.com/gnosis/dex-services: Gnosis Protocol services`,
  )
}

dfusionService.watchOrderPlacement({
  onNewOrder(order) {
    const message = newOrderMessage(order, WEB_BASE_URL)
    // Send message
    bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
  },
  onError(error: Error) {
    log.error('Error watching order placements: ', error)
  },
})

onShutdown(() => {
  log.info('Stopping bot v%s. Bye!', dfusionService.getVersion())
})

log.info('The bot v%s is up :)', dfusionService.getVersion())
dfusionService
  .getAbout()
  .then(({ batchExchangeAddress, nodeInfo, networkId, blockNumber }) => {
    log.info(
      `'Using contract ${batchExchangeAddress} on network ${networkId} (${nodeInfo}). Last block: ${blockNumber}'`,
    )
  })
  .catch(log.errorHandler)

// Run server
const server = new Server({ port, dfusionService })
server
  .start()
  .then(() => log.info('Server is ready on port %d', port))
  .catch(log.errorHandler)

onShutdown(async() => {
  // Stop server
  await server
    .stop()
    .then(() => log.info('Server has been stopped'))
    .catch(log.errorHandler)
    .finally(() => log.info('Bye!'))
})
