import { ContractEventLog } from 'contracts/types'
import Logger from '../helpers/Logger'
import { OrderPlacement } from 'contracts/StablecoinConverter'
import { BigNumber } from 'bignumber.js'
import { fromWei } from 'web3-utils'

const log = new Logger('util:formatNewOrders')

export function formatNewOrders (event: ContractEventLog<OrderPlacement>) {
  const { owner, sellToken, buyToken, priceNumerator, priceDenominator, validFrom, validUntil } = event.returnValues
  const priceNumeratorBn = new BigNumber(priceNumerator)
  const priceDenominatorBn = new BigNumber(priceDenominator)
  const price = priceNumeratorBn.div(priceDenominatorBn)

  log.info(`New order in tx ${event.blockHash}:
    - Owner: ${owner}
    - Sell token: ${sellToken}
    - Buy token: ${buyToken}
    - Price: ${priceNumerator}/${priceDenominator} = ${price.toNumber()}
    - Valid from: ${validFrom}
    - Valid until: ${validUntil}
    - Block number: ${event.blockNumber}`)

  // TODO: Format amounts in the message: https://github.com/gnosis/dex-telegram/issues/23
  // TODO: Resolve names of known tokens: https://github.com/gnosis/dex-telegram/issues/24
  // TODO: Format better the date for the end time of the order: https://github.com/gnosis/dex-telegram/issues/25
  // TODO: Provide the link to the front end: https://github.com/gnosis/dex-telegram/issues/3
  // TODO: Add some style to the bot message: https://github.com/gnosis/dex-telegram/issues/27
  const message = `Sell ${fromWei(priceDenominator)} ${sellToken} for ${fromWei(priceNumerator)} ${buyToken}:
    Price:  1 ${sellToken} = ${price} ${buyToken}
    Valid from: ${validFrom}
    Valid until: ${validUntil}`

  return message
}
