const assert = require('assert')
const TelegramBot = require('node-telegram-bot-api')

require('dotenv').config()

const token = process.env.TELEGRAM_TOKEN
assert(token, "TELEGRAM_TOKEN env var is required")

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

  bot.sendMessage(chatId, 'Received your message')
})
