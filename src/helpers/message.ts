import BN from 'bn.js'
import moment from 'moment-timezone'

import { FEE_DENOMINATOR, formatAmountFull, formatAmount } from '@gnosis.pm/dex-js'
import BigNumber from 'bignumber.js'
import { TokenDto } from 'services'

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

  const amountFmt = formatAmount(new BN(amount.toString()), token.decimals)

  return { tokenLabel, tokenParam, amountFmt }
}

export function newOrderMessage(order: any, baseUrl: string): string {
  const {
    // owner,
    buyToken,
    sellToken,
    validFrom,
    validUntil,
    // validFromBatchId,
    // validUntilBatchId,
    priceNumerator,
    priceDenominator,
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
    sellToken,
  )
  const { tokenLabel: buyTokenLabel, tokenParam: buyTokenParam, amountFmt: buyAmountFmt } = _getTokenFmt(
    priceNumerator,
    buyToken,
  )

  // Format the amounts
  // TODO: Allow to use BN, string or BigNumber or all three in the format. Review in dex-js
  const fillSellAmountFmt = formatAmountFull(
    new BN(priceNumerator.multipliedBy(FACTOR_TO_FILL_ORDER).toString()),
    buyToken.decimals,
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
  message += `\n\nFill the order here: ${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=${fillSellAmountFmt}&buy=${buyAmountFullFmt}`

  return message
}
