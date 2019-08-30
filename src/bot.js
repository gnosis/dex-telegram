const assert = require('assert')
const TelegramBot = require('node-telegram-bot-api')

require('dotenv').config()

const token = process.env.TELEGRAM_TOKEN
assert(token, "TELEGRAM_TOKEN env var is required")

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
  const chatId = msg.chat.id
  const resp = match[1] // the captured "whatever"

  bot.sendMessage(chatId, resp)
})

// Listen to any message
bot.on('message', (msg) => {
  const chatId = msg.chat.id

  bot.sendMessage(chatId, MESSAGE_GO_TO_CHANNEL)
})
