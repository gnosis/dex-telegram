import { strict as assert } from 'assert'
import TelegramBot, { Message, User } from 'node-telegram-bot-api'
import Logger from './helpers/Logger'
import { logUnhandledErrors, onShutdown } from './helpers'
import packageJson from '../package.json'
// import { dfusionRepo } from './repos'

require('dotenv').config()
logUnhandledErrors()

const log = new Logger('bot')
const token = process.env.TELEGRAM_TOKEN as string
const channelId = process.env.TELEGRAM_CHANNEL_ID as string

assert(token, 'TELEGRAM_TOKEN env var is required')
assert(channelId, 'TELEGRAM_CHANNEL_ID env var is required')

const bot = new TelegramBot(token, {
  polling: true
})

bot.onText(/\/(\w+) ?(.+)?/, (msg: Message, match: RegExpExecArray | null) => {
  log.debug('New command: %o', msg)
  const command = match ? match[1] : ''
  switch (command) {
    case 'start':
    case 'help':
      _helpCommand(msg)
      break

    case 'about':
      _aboutCommand(msg)
      break

    default:
      bot.sendMessage(msg.chat.id, "I don't recognize that command! You can use this other one instead: /help")
  }
})

// Listen to any message
bot.on('message', (msg: Message) => {
  const isCommand = msg.text && msg.text.startsWith('/')
  if (!isCommand) {
    log.debug('Received msg: %o', msg)
    _helpCommand(msg)
  }
})

onShutdown(() => {
  log.info('Bye!')
})

function _helpCommand (msg: Message) {
  const fromUser: User | undefined = msg.from
  bot.sendMessage(
    msg.chat.id,
    `${fromUser ? 'Hi ' + fromUser.first_name : 'Hi there'}!
    
I don't talk much for now. I just notify every new order in dFusion channel.
Please, go to t.me/dFusionPoC to get notified on every new order.

Also, you can ask about me by using the command: /about`
  )
}

function _aboutCommand (msg: Message) {
  bot.sendMessage(
    msg.chat.id,
    `I'm just a bot watching dFusion smart contract.

If you want to know more about me, checkout my code in https://github.com/gnosis/dex-telegram

In that github you'll be able to fork me, open issues, or even better, give me some additional functionality (Pull Requests are really welcomed 😀).

I'm running on version ${packageJson.version}

Also, here are some links you might find useful:
- https://github.com/gnosis/dex-contracts: dFusion Smart Contracts
- https://github.com/gnosis/dex-research: dFusion Research
- https://github.com/gnosis/dex-services: dFusion services`
  )
}

log.info('The bot is up :)')
