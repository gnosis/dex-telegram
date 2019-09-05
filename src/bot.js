const assert = require('assert')
const TelegramBot = require('node-telegram-bot-api')

const debug = require('debug')('DEBUG-bot')
const info = require('debug')('INFO-bot')

require('dotenv').config()

const token = process.env.TELEGRAM_TOKEN
const channelId = process.env.TELEGRAM_CHANNEL_ID

assert(token, "TELEGRAM_TOKEN env var is required")
assert(channelId, "TELEGRAM_CHANNEL_ID env var is required")

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
bot.onText(/\/echo (.+)/, (msg, match) => {
  // const chatId = msg.chat.id
  const resp = match[1] // the captured "whatever"

  debug("Received an echo message: %s, answering in 3s. %s, %o", resp, msg, match)
  const text = 'This is a new order: ' + resp
  debug("Writing into the channel", text)
  bot.sendMessage(channelId, text)
})


// Listen to any message
bot.on('message', (msg) => {
  const chatId = msg.chat.id
  debug("Received msg: %o", msg)

  bot.sendMessage(chatId, MESSAGE_GO_TO_CHANNEL)
})

info("The bot is up :)")