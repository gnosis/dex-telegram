import BN from 'bn.js'
import BigNumber from 'bignumber.js'
import moment from 'moment-timezone'

import {
  FEE_DENOMINATOR,
  formatAmountFull,
  formatAmount,
  isOrderUnlimited,
  isNeverExpiresOrder,
} from '@gnosis.pm/dex-js'
import { TokenDto, OrderDto } from 'services'

// To fill an order, no solver will match the trades if there's not 2*FEE spread between the trades
const FACTOR_TO_FILL_ORDER = 1 + 2 / FEE_DENOMINATOR

function _getTokenFmt(amount: BigNumber, token: TokenDto) {
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

  const amountFmt = formatAmount(new BN(amount.toFixed()), token.decimals) as string

  return { tokenLabel, tokenParam, amountFmt }
}

// TODO: probably there is (or there should be) a function shared on dex-js for this
export function calculatePrice(order: OrderDto): BigNumber {
  const { buyToken, sellToken, priceNumerator, priceDenominator } = order

  if (buyToken.decimals >= sellToken.decimals) {
    const precisionFactor = 10 ** (buyToken.decimals - sellToken.decimals)
    return priceNumerator.dividedBy(priceDenominator.multipliedBy(precisionFactor))
  } else {
    const precisionFactor = 10 ** (sellToken.decimals - buyToken.decimals)
    return priceNumerator.multipliedBy(precisionFactor).dividedBy(priceDenominator)
  }
}

export function buildExpirationMsg(order: OrderDto): string {
  const { validUntilBatchId, validUntil } = order

  if (isNeverExpiresOrder(validUntilBatchId.toNumber())) {
    return '\n  - *Expires*: Valid until cancelled'
  } else {
    return `\n  - *Expires*: \`${moment(validUntil).calendar()} GMT\`, \`${moment(validUntil).fromNow()}\``
  }
}

export function buildUnknownTokenMsg(order: OrderDto): string {
  const { buyToken, sellToken } = order

  if (!sellToken.known || !buyToken.known) {
    return (
      '\n  - "Maybe" means one or more tokens claim to be called as shown, ' +
      "but it's not currently part of the list of [known tokens](https://github.com/gnosis/dex-js/blob/master/src/tokenList.json). " +
      'Make sure you verify the address yourself before trading against it.'
    )
  } else {
    return ''
  }
}

export function buildNotYetActiveOrderMsg(validFrom: Date): string {
  const now = new Date()

  if (validFrom > now) {
    // The order is not active yet
    return `\n  - *Tradable*: \`${moment(validFrom).calendar()} GMT\`, \`${moment(validFrom).fromNow()}\``
  } else {
    return ''
  }
}

export function buildSellMsg(
  isUnlimited: boolean,
  buyTokenLabel: string,
  sellTokenLabel: string,
  buyAmount: string,
  sellAmount: string,
): string {
  if (isUnlimited) {
    // doesn't make sense to display amounts when the order is unlimited
    return `Sell \`${sellTokenLabel}\` for \`${buyTokenLabel}\`\n`
  } else {
    return `Sell *${sellAmount}* \`${sellTokenLabel}\` for *${buyAmount}* \`${buyTokenLabel}\`\n`
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

export function buildFillOrderMsg(
  isUnlimited: boolean,
  order: OrderDto,
  price: BigNumber,
  baseUrl: string,
  buyTokenParam: string,
  sellTokenParam: string,
): string {
  const { buyToken, priceDenominator, sellToken, priceNumerator } = order

  let fillAmountBuy: string
  let fillAmountSell: string
  if (isUnlimited) {
    // This is tricky. how much should we offer to fill for a unlimited order?
    // Going for 10 units
    fillAmountBuy = calculateUnlimitedBuyTokenFillAmount(price, sellToken)
    fillAmountSell = '10'
  } else {
    // Format the amounts
    // TODO: Allow to use BN, string or BigNumber or all three in the format. Review in dex-js
    fillAmountBuy = formatAmountFull(new BN(priceDenominator.toFixed()), sellToken.decimals) as string
    fillAmountSell = formatAmountFull(
      new BN(priceNumerator.multipliedBy(FACTOR_TO_FILL_ORDER).toFixed()),
      buyToken.decimals,
    ) as string
  }

  return `\n\nFill the order here: ${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=${fillAmountSell}&buy=${fillAmountBuy}`
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
  const isUnlimited = isOrderUnlimited(priceNumerator, priceDenominator)

  // TODO: Should we publish even if the user doesn't have balance. Should we include the balance of the user? he can change it...
  //  https://github.com/gnosis/dex-telegram/issues/45

  const sellMsg = buildSellMsg(isUnlimited, buyTokenLabel, sellTokenLabel, buyAmountFmt, sellAmountFmt)
  // Calculate the price
  const price = calculatePrice(order)
  const priceMsg = `\n  - *Price*:  1 \`${sellTokenLabel}\` = ${price} \`${buyTokenLabel}\``
  // Only display the valid from if the period hasn't started
  const notYetActiveOrderMsg = buildNotYetActiveOrderMsg(validFrom)
  // Does it expire?
  const expirationMsg = buildExpirationMsg(order)
  // In case one of the tokens is not in our list
  const unknownTokenMsg = buildUnknownTokenMsg(order)
  // Create link for filling this order
  const fillOrderMsg = buildFillOrderMsg(isUnlimited, order, price, baseUrl, buyTokenParam, sellTokenParam)

  const message = `${sellMsg}${priceMsg}${notYetActiveOrderMsg}${expirationMsg}${unknownTokenMsg}${fillOrderMsg}`

  return message
}
