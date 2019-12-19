import assert from 'assert'
import moment from 'moment-timezone'
import TelegramBot, { Message, User } from 'node-telegram-bot-api'
import BigNumber from 'bignumber.js'
import BN from 'bn.js'

import Server from 'Server'
import {
  Logger,
  logUnhandledErrors,
  onShutdown,
  formatAmount,
  formatAmountFull,
  FEE_DENOMINATOR
} from '@gnosis.pm/dex-js'

import { dfusionService, TokenDto } from 'services'

const WEB_BASE_URL = process.env.WEB_BASE_URL
assert(WEB_BASE_URL, 'WEB_BASE_URL is required')
const port = parseInt(process.env.API_PORT || '3000')

// To fill an order, no solver will match the trades if there's not 2*FEE spread between the trades
const FACTOR_TO_FILL_ORDER = 1 + 2 / FEE_DENOMINATOR

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

const bot = new TelegramBot(token, {
  polling: true
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

async function _runCommand (msg: Message, match: RegExpExecArray | null) {
  const command = match ? match[1] : ''
  switch (command) {
    case 'start':
    case 'help':
      await _helpCommand(msg)
      break

    case 'about':
      await _aboutCommand(msg)
      break

    default:
      await bot.sendMessage(msg.chat.id, "I don't recognize that command! You can use this other one instead: /help")
  }
}
async function _helpCommand (msg: Message) {
  const fromUser: User | undefined = msg.from
  bot.sendMessage(
    msg.chat.id,
    `${fromUser ? 'Hi ' + fromUser.first_name : 'Hi there'}!
    
I don't talk much for now. I just notify every new order in dFusion channel.
Please, go to ${channelHandle} to get notified on every new order.

Also, you can ask about me by using the command: /about`
  )
}

async function _aboutCommand (msg: Message) {
  const { blockNumber, networkId, nodeInfo, version, batchExchangeAddress } = await dfusionService.getAbout()

  bot.sendMessage(
    msg.chat.id,
    `I'm just a bot watching dFusion smart contract.

If you want to know more about me, checkout my code in https://github.com/gnosis/dex-telegram

In that github you'll be able to fork me, open issues, or even better, give me some additional functionality (Pull Requests are really welcomed 😀).

Some interesting facts are:
- Bot version: ${version}
- Contract Address: ${batchExchangeAddress}
- Ethereum Network: ${networkId}
- Ethereum Node: ${nodeInfo}
- Last minted block: ${blockNumber}

Also, here are some links you might find useful:
- https://github.com/gnosis/dex-contracts: dFusion Smart Contracts
- https://github.com/gnosis/dex-research: dFusion Research
- https://github.com/gnosis/dex-services: dFusion services`
  )
}

function _getTokenFmt (amount: BigNumber, token: TokenDto) {
  let tokenLabel, tokenParam
  if (token.known) {
    tokenLabel = token.symbol || token.name || token.address
    tokenParam = token.symbol || token.address
  } else {
    // The token is unknown, so it can't be trusted.
    // We use it's address and we add the "Maybe " prefix ot it's symbol/name
    const tokenLabelAux = token.symbol || token.name
    tokenLabel = tokenLabelAux ? 'Maybe ' + tokenLabelAux : token.address
    tokenParam = token.address
  }

  const amountFmt = formatAmount(new BN(amount.toString()), token.decimals)

  return { tokenLabel, tokenParam, amountFmt }
}

dfusionService.watchOrderPlacement({
  onNewOrder (order) {
    const {
      // owner,
      buyToken,
      sellToken,
      validFrom,
      validUntil,
      // validFromBatchId,
      // validUntilBatchId,
      priceNumerator,
      priceDenominator
      // event
    } = order

    // Calculate the price
    let price
    if (buyToken.decimals >= sellToken.decimals) {
      const precisionFactor = 10 ** (buyToken.decimals - sellToken.decimals)
      price = priceNumerator.dividedBy(priceDenominator.multipliedBy(precisionFactor))
    } else {
      const precisionFactor = 10 ** (sellToken.decimals - buyToken.decimals)
      price = priceNumerator.multipliedBy(precisionFactor).dividedBy(priceDenominator)
    }

    // Label for token
    // TODO: to use the shared utils function when available safeTokenName
    const { tokenLabel: sellTokenLabel, tokenParam: sellTokenParam, amountFmt: sellAmountFmt } = _getTokenFmt(
      priceDenominator,
      sellToken
    )
    const { tokenLabel: buyTokenLabel, tokenParam: buyTokenParam, amountFmt: buyAmountFmt } = _getTokenFmt(
      priceNumerator,
      buyToken
    )

    // Format the amounts
    // TODO: Allow to use BN, string or BigNumber or all three in the format. Review in dex-js
    const fillSellAmountFmt = formatAmountFull(
      new BN(priceNumerator.multipliedBy(FACTOR_TO_FILL_ORDER).toString()),
      buyToken.decimals
    )
    const buyAmountFullFmt = formatAmountFull(new BN(priceDenominator.toString()), sellToken.decimals)

    // TODO: Should we publish even if the user doesn't have balance. Should we include the balance of the user? he can change it...
    //  https://github.com/gnosis/dex-telegram/issues/45
    let message = `Sell *${sellAmountFmt}* \`${sellTokenLabel}\` for *${buyAmountFmt}* \`${buyTokenLabel}\`\n`
    message += `\n  - *Price*:  1 \`${sellTokenLabel}\` = ${price} \`${buyTokenLabel}\``

    // Only display the valid from if the period hasn't started
    const now = new Date()
    if (validFrom > now) {
      // The order is not active yet
      message += `\n  - *Tradable*: \`${moment(validFrom).calendar()} GMT\`, \`${moment(validFrom).fromNow()}\``
    }
    message += `\n  - *Expires*: \`${moment(validUntil).calendar()} GMT\`, \`${moment(validUntil).fromNow()}\``
    if (!sellToken.known || !buyToken.known) {
      message +=
        '\n  - "Maybe" means one or more tokens claim to be called as shown, but it\'s not currently part of the list of [known tokens](https://github.com/gnosis/dex-js/blob/master/src/tokenList.json). Make sure you verify the address yourself before trading against it.'
    }
    message += `\n\nFill the order here: ${WEB_BASE_URL}/trade/${sellTokenParam}-${buyTokenParam}?sell=${fillSellAmountFmt}&buy=${buyAmountFullFmt}`

    // Send message
    bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
  },
  onError (error: Error) {
    log.error('Error watching order placements: ', error)
  }
})

onShutdown(() => {
  log.info('Stopping bot v%s. Bye!', dfusionService.getVersion())
})

log.info('The bot v%s is up :)', dfusionService.getVersion())
dfusionService
  .getAbout()
  .then(({ batchExchangeAddress, nodeInfo, networkId, blockNumber }) => {
    log.info(
      `'Using contract ${batchExchangeAddress} in network ${networkId} (${nodeInfo}). Last block: ${blockNumber}'`
    )
  })
  .catch(log.errorHandler)

// Run server
const server = new Server({ port, dfusionService })
server
  .start()
  .then(() => log.info('Server is ready on port %d', port))
  .catch(log.errorHandler)

onShutdown(async () => {
  // Stop server
  await server
    .stop()
    .then(() => log.info('Server has been stopped'))
    .catch(log.errorHandler)
    .finally(() => log.info('Bye!'))
})
