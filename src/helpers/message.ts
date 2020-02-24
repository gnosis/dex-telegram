import BN from 'bn.js'
import BigNumber from 'bignumber.js'
import moment from 'moment-timezone'

import { FEE_DENOMINATOR, formatAmountFull, isOrderUnlimited, isNeverExpiresOrder } from '@gnosis.pm/dex-js'
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

  const amountFmt = formatAmountFull(new BN(amount.toFixed()), token.decimals) as string

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
    return 'Valid until cancelled'
  } else {
    return `\`${moment(validUntil).calendar()} GMT\`, \`${moment(validUntil).fromNow()}\``
  }
}

export function buildUnknownTokenMsg(order: OrderDto): string | null {
  const { buyToken, sellToken } = order

  if (!sellToken.known || !buyToken.known) {
    return (
      '"Maybe" means one or more tokens claim to be called as shown, ' +
      "but it's not currently part of the list of [known tokens](https://github.com/gnosis/dex-js/blob/master/src/tokenList.json). " +
      'Make sure you verify the address yourself before trading against it.'
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

export function buildSellMsg(
  isUnlimited: boolean,
  buyTokenLabel: string,
  sellTokenLabel: string,
  buyAmount: string,
  sellAmount: string,
): string {
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

export function buildFillOrderUrl(
  isUnlimited: boolean,
  order: OrderDto,
  priceFormatted: string,
  baseUrl: string,
  buyTokenParam: string,
  sellTokenParam: string,
): string {
  const { buyToken, priceNumerator } = order

  let fillAmountSell: string
  if (isUnlimited) {
    fillAmountSell = '0'
  } else {
    fillAmountSell = formatAmountFull(
      new BN(priceNumerator.multipliedBy(FACTOR_TO_FILL_ORDER).toFixed()),
      buyToken.decimals,
    ) as string
  }

  return `${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=${fillAmountSell}&price=${priceFormatted}`
}

export function buildPriceMsg(sellTokenLabel: string, buyTokenLabel: string, priceFormatted: string): string {
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
  const sellMsg = buildSellMsg(isUnlimited, buyTokenLabel, sellTokenLabel, buyAmountFmt, sellAmountFmt) + '\n'

  // Partial message: Price of the order
  //    i.e Price:  1 WETH = 282.8854314002828854314 SNX
  const price = calculatePrice(order)
  const maxDecimals = Math.max(sellToken.decimals, buyToken.decimals)
  const priceFormatted = price.toFixed(maxDecimals)
  const priceMsg = '\n  - *Price*:  ' + buildPriceMsg(sellTokenLabel, buyTokenLabel, priceFormatted)

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
    buildFillOrderUrl(isUnlimited, order, priceFormatted, baseUrl, buyTokenParam, sellTokenParam)

  // Compose the final message
  return `${sellMsg}${priceMsg}${notYetActiveOrderMsg}${expirationMsg}${unknownTokenMsg}${fillOrderMsg}`
}
