import BN from 'bn.js'
import BigNumber from 'bignumber.js'
import moment from 'moment-timezone'

import {
  FEE_DENOMINATOR,
  formatAmountFull,
  isOrderUnlimited,
  isNeverExpiresOrder,
  calculatePrice,
  formatPrice,
  invertPrice,
  encodeTokenSymbol,
  getNetworkFromId,
} from '@gnosis.pm/dex-js'
import { TokenDto, OrderDto } from 'services'
import TelegramBot from 'node-telegram-bot-api'
import { TCR_CONTRACT_ADDRESS, TCR_LIST_ID } from 'config'

const PRICE_PRECISION = 19

// To fill an order, no solver will match the trades if there's not 2*FEE spread between the trades
const FACTOR_TO_FILL_ORDER = 1 + 2 / FEE_DENOMINATOR
const FILL_INVERSE_TRADE_PRICE_BASE = new BigNumber(1 - 2 / FEE_DENOMINATOR)

function _getTokenFmt(amount: BigNumber, token: TokenDto) {
  let tokenLabel, tokenParam

  if (token.forceAddressDisplay) {
    tokenParam = token.address
    tokenLabel = token.address
  } else if (token.known) {
    tokenLabel = token.symbol || token.name || token.address
    tokenParam = encodeTokenSymbol(token)
  } else {
    // The token is unknown, so it can't be trusted.
    // We use it's address and we add the "Maybe " prefix ot it's symbol/name
    const tokenLabelAux = token.symbol || token.name
    tokenLabel = tokenLabelAux ? 'Maybe ' + tokenLabelAux : token.address
    // always use the address and on the interface you'll be able to your token list
    tokenParam = token.address
  }

  const amountFmt = formatAmountFull({ amount: new BN(amount.toFixed()), precision: token.decimals }) as string

  return { tokenLabel, tokenParam, amountFmt }
}

export function buildExpirationMsg(order: OrderDto): string {
  const { validUntilBatchId, validUntil } = order

  if (isNeverExpiresOrder(validUntilBatchId.toNumber())) {
    return 'Valid until cancelled'
  } else {
    return `\`${moment(validUntil).calendar()} GMT\`, \`${moment(validUntil).fromNow()}\``
  }
}

function buildEtherscanLink(networkId: number): string {
  return `https://${
    networkId === 1 ? '' : `${getNetworkFromId(networkId).toLowerCase()}.`
  }etherscan.io/address/${TCR_CONTRACT_ADDRESS}#readContract`
}

export function buildUnknownTokenMsg(order: OrderDto): string | null {
  const { buyToken, sellToken, networkId } = order

  if (!sellToken.known || !buyToken.known) {
    return (
      '"Maybe" means one or more tokens claim to be called as shown, but it\'s not part of list ' +
      TCR_LIST_ID +
      ' in the [Tokens-Curated Registry](' +
      buildEtherscanLink(networkId) +
      '). Make sure you verify the address yourself before trading against it.'
    )
  } else {
    return null
  }
}

export function buildNotYetActiveOrderMsg(validFrom: Date): string | null {
  const now = Date.now()
  if (validFrom.getTime() > now) {
    // The order is not active yet
    return `\`${moment(validFrom).calendar()} GMT\`, \`${moment(validFrom).fromNow()}\``
  } else {
    return null
  }
}

export function buildSellMsg(params: {
  isUnlimited: boolean
  buyTokenLabel: string
  sellTokenLabel: string
  buyAmount: string
  sellAmount: string
}): string {
  const { isUnlimited, buyTokenLabel, sellTokenLabel, buyAmount, sellAmount } = params
  if (isUnlimited) {
    // doesn't make sense to display amounts when the order is unlimited
    return `Sell \`${sellTokenLabel}\` for \`${buyTokenLabel}\``
  } else {
    return `Sell *${sellAmount}* \`${sellTokenLabel}\` for *${buyAmount}* \`${buyTokenLabel}\``
  }
}

const ONE = new BigNumber(1)

export function calculateUnlimitedBuyTokenFillAmount(price: BigNumber, sellToken: TokenDto): string {
  // 1/fee denominator == fee %
  // fee % * 2 == minimum amount to have a match (both orders paying the fee)
  const feeToDeduce = ONE.dividedBy(FEE_DENOMINATOR).multipliedBy(2)

  // Since we are inverting the sell/buy to create the 'counter' offer,
  // we need to invert the price, thus 1/price
  return (
    ONE.dividedBy(price)
      // deduct from the value the fee by multiplying by 1 - FEE
      .multipliedBy(ONE.minus(feeToDeduce))
      // scale up the order to have a baseline of selling 10 units of sellToken
      .multipliedBy(10)
      // Base 10 to force BigNumber NOT returning value in exponential notation
      .toString(10)
      // `rounding` down if needed because the token might not have enough precision.
      // E.g.: GUSD has only 2 decimal places, thus it makes no sense to send an amount of 9.009
      .replace(new RegExp(`\\.(\\d{1,${sellToken.decimals}})\\d*`), '.$1')
  )
}

export function buildFillOrderUrl(params: {
  isUnlimited: boolean
  order: OrderDto
  baseUrl: string
  buyTokenParam: string
  sellTokenParam: string
  price: BigNumber
}): string {
  const { isUnlimited, order, baseUrl, buyTokenParam, sellTokenParam, price } = params
  const { sellToken, buyToken, priceNumerator } = order

  // Calculate the maker theoretic price (theoretic because it needs adjustments because of precision errors)
  const takerTheoreticalPrice = FILL_INVERSE_TRADE_PRICE_BASE.div(price)

  // Calculate the sell amount and price
  let takerSellAmount: string
  let takerPrice: string
  if (isUnlimited) {
    // For unlimited orders, the user can enter any amount he wants
    takerSellAmount = '0'

    // Calculate the inverse price taking the fee into account
    //  (1 - 2*fee) / price
    takerPrice = formatPrice({ price: takerTheoreticalPrice, decimals: PRICE_PRECISION, zeroPadding: false })
  } else {
    // The taker needs to sell slightly more "buy tokens" than what the maker is expecting and at a slightly better price
    //    * The taker expects at least "priceNumerator buyTokens"
    //    * We need take the fees into account (the taker needs to sell more tokens than the ones the maker receives)
    const takerSellAmountWeis = priceNumerator.multipliedBy(FACTOR_TO_FILL_ORDER).decimalPlaces(0, BigNumber.ROUND_CEIL)
    takerSellAmount = formatAmountFull({
      amount: new BN(takerSellAmountWeis.toFixed()),
      precision: buyToken.decimals,
      thousandSeparator: false,
    })

    // Calculate the taker buy tokens
    const takerBuyAmountWeis = takerSellAmountWeis
      .multipliedBy(takerTheoreticalPrice)
      .dividedBy(10 ** (buyToken.decimals - sellToken.decimals))
      .decimalPlaces(0, BigNumber.ROUND_FLOOR)

    // Calculate the price
    const price = calculatePrice({
      numerator: { amount: takerBuyAmountWeis, decimals: sellToken.decimals },
      denominator: { amount: takerSellAmountWeis, decimals: buyToken.decimals },
    })
    takerPrice = formatPrice({ price, decimals: PRICE_PRECISION, zeroPadding: false })
  }

  // Calculate the fill price
  return `${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=${takerSellAmount}&price=${takerPrice}`
}

export function buildPriceMsg(params: {
  sellTokenLabel: string
  buyTokenLabel: string
  sellTokenDecimals: number
  buyTokenDecimals: number
  price: BigNumber
}): string {
  const { sellTokenLabel, buyTokenLabel, price } = params
  const priceFormatted = formatPrice({ price, decimals: PRICE_PRECISION, zeroPadding: false })

  return `1 \`${sellTokenLabel}\` = ${priceFormatted} \`${buyTokenLabel}\``
}

export function newOrderMessage(order: OrderDto, baseUrl: string): string {
  const { buyToken, sellToken, validFrom, priceNumerator, priceDenominator } = order

  // Label for token
  // TODO: to use the shared utils function when available safeTokenName
  const { tokenLabel: sellTokenLabel, tokenParam: sellTokenParam, amountFmt: sellAmountFmt } = _getTokenFmt(
    priceDenominator,
    sellToken,
  )
  const { tokenLabel: buyTokenLabel, tokenParam: buyTokenParam, amountFmt: buyAmountFmt } = _getTokenFmt(
    priceNumerator,
    buyToken,
  )

  // unlimited?

  // TODO: Should we publish even if the user doesn't have balance. Should we include the balance of the user? he can change it...
  //  https://github.com/gnosis/dex-telegram/issues/45

  // Partial message: Order description
  //    i.e Sell 3.535 WETH for 1,000 SNX
  const isUnlimited = isOrderUnlimited(priceNumerator, priceDenominator)
  const sellMsg =
    buildSellMsg({
      isUnlimited,
      buyTokenLabel,
      sellTokenLabel,
      buyAmount: buyAmountFmt,
      sellAmount: sellAmountFmt,
    }) + '\n'

  // Partial message: Price of the order
  //    i.e Price:  1 WETH = 282.8854314002828854314 SNX
  const price = calculatePrice({
    numerator: { amount: order.priceNumerator, decimals: buyToken.decimals },
    denominator: { amount: order.priceDenominator, decimals: sellToken.decimals },
  })
  const priceMsg =
    '\n  - *Price*:  ' +
    buildPriceMsg({
      sellTokenLabel,
      buyTokenLabel,
      sellTokenDecimals: sellToken.decimals,
      buyTokenDecimals: buyToken.decimals,
      price,
    })
  // Partial message: Price of the order
  //    i.e Price:  1 WETH = 282.8854314002828854314 SNX
  const priceInverse = invertPrice(price)
  const priceInverseMsg =
    '\n  - *Price*:  ' +
    buildPriceMsg({
      sellTokenLabel: buyTokenLabel,
      buyTokenLabel: sellTokenLabel,
      sellTokenDecimals: buyToken.decimals,
      buyTokenDecimals: sellToken.decimals,
      price: priceInverse,
    })

  // Partial message: Only display the valid from if the period hasn't started
  //    i.e. Tradable: Today at 4:55 PM GMT, in 4 minutes
  const tradebleMessage = buildNotYetActiveOrderMsg(validFrom)
  const notYetActiveOrderMsg = tradebleMessage ? '\n  - *Tradable*: ' + tradebleMessage : ''

  // Partial message: Does it expire?
  //    i.e. Expires: Today at 9:00 PM GMT, in 4 hours
  const expirationMsg = '\n  - *Expires*: ' + buildExpirationMsg(order)

  // Partial message: Any tokens not whitelisted?
  //    i.e. "Maybe" means one or more tokens claim to be....
  const unknownTokensMsgAux = buildUnknownTokenMsg(order)
  const unknownTokenMsg = unknownTokensMsgAux ? '\n  - ' + unknownTokensMsgAux : ''

  // Partial message: Create link for filling this order
  //    i.e. Fill the order here: https://app?sell=0.0001002&price=10
  const fillOrderMsg =
    '\n\nFill the order here: ' +
    buildFillOrderUrl({
      isUnlimited,
      order,
      baseUrl,
      price,
      buyTokenParam,
      sellTokenParam,
    })

  // Compose the final message
  return `${sellMsg}${priceMsg}${priceInverseMsg}${notYetActiveOrderMsg}${expirationMsg}${unknownTokenMsg}${fillOrderMsg}`
}

export interface SendMessageInput {
  chatId: number | string
  text: string
  options?: TelegramBot.SendMessageOptions
}

export const MESSAGE_DELIMITER = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
const MAX_MESSAGE_LENGTH = 4096 // avoids Error: Message is too long

export function concatMessages(
  messageInputs: SendMessageInput[],
  { maxLength = MAX_MESSAGE_LENGTH, delimeter = MESSAGE_DELIMITER } = {},
): SendMessageInput[] {
  if (messageInputs.length <= 1) return messageInputs

  const defaultMessage = {
    ...messageInputs[0],
    text: '',
  }

  return messageInputs.reduce(
    (accum, message) => {
      const lastMessage = accum[accum.length - 1]
      const concatText = (lastMessage.text ? lastMessage.text + delimeter : '') + message.text
      if (concatText.length > maxLength) {
        const nextMessage = { ...defaultMessage, text: message.text }
        accum.push(nextMessage)
      } else {
        lastMessage.text = concatText
      }

      return accum
    },
    [defaultMessage],
  )
}
