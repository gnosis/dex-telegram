import { strict as assert } from 'assert'
import TelegramBot, { Message } from 'node-telegram-bot-api'
import Logger from './helpers/Logger'
import { logUnhandledErrors, onShutdown } from './helpers'

require('dotenv').config()
logUnhandledErrors()

const log = new Logger('bot')
const token = process.env.TELEGRAM_TOKEN as string
const channelId = process.env.TELEGRAM_CHANNEL_ID as string

assert(token, 'TELEGRAM_TOKEN env var is required')
assert(channelId, 'TELEGRAM_CHANNEL_ID env var is required')

const MESSAGE_GO_TO_CHANNEL = `Hey, for now I prefer to talk in dFusion channel.

Please, go to t.me/dFusionPoC to get notified when there's a new standing order.

Also, here are some links you might find useful:
- https://github.com/gnosis/dex-contracts: dFusion Smart Contracts
- https://github.com/gnosis/dex-research: dFusion Research
- https://github.com/gnosis/dex-services: dFusion services`

const bot = new TelegramBot(token, {
  polling: true
})

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg: Message, match: RegExpExecArray | null) => {
  const resp = match ? match[1] : 'N/A'

  log.debug('Received an echo message: %s, answering in 3s. %s, %o', resp, msg, match)
  const text = 'This is a new order: ' + resp
  log.debug('Writing into the channel', text)
  bot.sendMessage(channelId, text)
})

// Listen to any message
bot.on('message', (msg: Message) => {
  const chatId = msg.chat.id
  log.debug('Received msg: %o', msg)

  bot.sendMessage(chatId, MESSAGE_GO_TO_CHANNEL)
})

onShutdown(() => {
  log.info('Bye!')
})

log.info('The bot is up :)')
