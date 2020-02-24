import BigNumber from 'bignumber.js'

import { TOKEN_1, TOKEN_2, USER_1 } from '../data'

import { OrderDto, TokenDto } from 'services'
import {
  calculatePrice,
  buildExpirationMsg,
  buildUnknownTokenMsg,
  buildNotYetActiveOrderMsg,
  buildSellMsg,
  buildFillOrderUrl,
  calculateUnlimitedBuyTokenFillAmount,
  newOrderMessage,
} from 'helpers'
import { MAX_BATCH_ID } from '@gnosis.pm/dex-js'

const MockEvent = jest.fn()
const BUY_TOKEN_SYMBOL = 'COOL'
const BUY_TOKEN_NAME = 'Cool token'

const baseBuyToken: TokenDto = {
  decimals: 18,
  address: TOKEN_1,
  known: true,
  symbol: BUY_TOKEN_SYMBOL,
  name: BUY_TOKEN_NAME,
}
const baseSellToken: TokenDto = { decimals: 9, address: TOKEN_2, known: true }
const baseOrder: OrderDto = {
  owner: USER_1,
  buyToken: baseBuyToken,
  sellToken: baseSellToken,
  priceNumerator: new BigNumber(10),
  priceDenominator: new BigNumber(10),
  validFrom: new Date('2020-02-24T00:00:00.000'),
  validUntil: new Date('2020-02-25T00:00:00.000'),
  validFromBatchId: new BigNumber(0),
  validUntilBatchId: new BigNumber(1),
  event: new MockEvent(),
}

describe('calculatePrice', () => {
  test('buy token with same or higher precision', () => {
    const order = {
      ...baseOrder,
      sellToken: { ...baseSellToken, decimals: 18 },
    }

    const actual = calculatePrice(order)

    expect(actual.toString(10)).toBe('1')
  })

  test('sell token with higher precision', () => {
    const order = {
      ...baseOrder,
      buyToken: { ...baseBuyToken, decimals: 17 },
      sellToken: { ...baseSellToken, decimals: 18 },
    }

    const actual = calculatePrice(order)

    expect(actual.toString(10)).toBe('10')
  })
})

describe('buildExpirationMsg', () => {
  test('With expiration', () => {
    // GIVEN: An order that will expire in 6 hours
    Date.now = jest.fn().mockReturnValue(new Date('2020-02-24T00:02:10.000'))

    // WHEN: Build expiration message
    const actual = buildExpirationMsg(baseOrder)

    // THEN: The message reads as follows
    expect(actual).toEqual('`Tomorrow at 12:00 AM GMT`, `in a day`')
  })

  test('Without expiration', () => {
    const order = { ...baseOrder, validUntilBatchId: new BigNumber(MAX_BATCH_ID) }

    const actual = buildExpirationMsg(order)

    expect(actual).toEqual('Valid until cancelled')
  })
})

describe('buildUnknownTokenMsg', () => {
  test('No unknown tokens', () => {
    const actual = buildUnknownTokenMsg(baseOrder)

    expect(actual).toBe(null)
  })

  test('With unknown tokens', () => {
    const order = { ...baseOrder, sellToken: { ...baseSellToken, known: false } }

    const actual = buildUnknownTokenMsg(order)

    // No need to check the whole message
    expect(actual).toMatch(/"Maybe" means one or more tokens/)
  })
})

describe('buildNotYetActiveOrderMsg', () => {
  test('Active order', () => {
    const actual = buildNotYetActiveOrderMsg(new Date(0))

    expect(actual).toBe(null)
  })

  test('Not yet active order', () => {
    // GIVEN: Order scheduled for the future
    Date.now = jest.fn().mockReturnValue(new Date('2020-02-24T00:02:10.000'))
    const validFrom = new Date('2020-02-24T03:10:30.000')

    const active = buildNotYetActiveOrderMsg(validFrom)

    expect(active).toEqual('`Today at 3:10 AM GMT`, `in 3 hours`')
  })
})

describe('buildSellMsg', () => {
  const buyTokenLabel = 'SCM'
  const sellTokenLabel = 'PMD'

  test('unlimited order', () => {
    // GIVEN: an unlimited order
    const isUnlimited = true

    // WHEN: Build the sell message
    const actual = buildSellMsg(isUnlimited, buyTokenLabel, sellTokenLabel, '', '')

    // THEN: It reads as follows
    expect(actual).toEqual(`Sell \`${sellTokenLabel}\` for \`${buyTokenLabel}\``)
  })

  test('limit order', () => {
    // GIVEN: a limited order
    const isUnlimited = false
    const buyAmount = '1'
    const sellAmount = '2'

    // WHEN: Build the sell message
    const actual = buildSellMsg(isUnlimited, buyTokenLabel, sellTokenLabel, buyAmount, sellAmount)

    // THEN: It reads as follows
    expect(actual).toEqual(`Sell *${sellAmount}* \`${sellTokenLabel}\` for *${buyAmount}* \`${buyTokenLabel}\``)
  })
})

describe('calculateUnlimitedBuyTokenFillAmount', () => {
  const price = new BigNumber('1.001')

  test('high precision token', () => {
    const actual = calculateUnlimitedBuyTokenFillAmount(price, {
      ...baseSellToken,
      decimals: 18,
    })

    expect(actual).toBe('9.970029970029970029')
  })

  test('lower precision token', () => {
    const actual = calculateUnlimitedBuyTokenFillAmount(price, { ...baseSellToken, decimals: 2 })

    expect(actual).toBe('9.97')
  })

  test('price is an integer', () => {
    const price = new BigNumber(2)

    const actual = calculateUnlimitedBuyTokenFillAmount(price, baseSellToken)

    expect(actual).toBe('4.99')
  })
})

describe('buildFillOrderMsg', () => {
  const price = '1.1000000000000000000'
  const baseUrl = 'http://dex.gnosis.io/'
  const buyTokenParam = 'SCM'
  const sellTokenParam = 'PMD'

  test('unlimited order', () => {
    // GIVEN: An unlimited order
    const isUnlimited = true

    // WHEN: Build fill order url
    const actual = buildFillOrderUrl(isUnlimited, baseOrder, price, baseUrl, buyTokenParam, sellTokenParam)

    // THEN: The url has the correct price and a sell amount of 0
    expect(actual).toEqual(`${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=0&price=${price}`)
  })

  test('limited order', () => {
    // GIVEN: A limited order
    const isUnlimited = false

    // WHEN: Build fill order url
    const actual = buildFillOrderUrl(isUnlimited, baseOrder, price, baseUrl, buyTokenParam, sellTokenParam)

    // THEN: The url has the correct price and a sell amount of 0
    expect(actual).toEqual(
      `${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=0.000000000000009802&price=${price}`,
    )
  })
})

describe('newOrderMessage', () => {
  const baseUrl = 'http://dex.gnosis.io/'

  test('unlimited order', () => {
    // GIVEN: An order staring 2min 10 seg ago. With expiring date on next date 12am GMT
    Date.now = jest.fn().mockReturnValue(new Date('2020-02-24T00:02:10.000'))

    // WHEN: Formatting message for new order
    const actual = newOrderMessage(
      {
        ...baseOrder,
        priceNumerator: new BigNumber('10000000000000000000'),
        priceDenominator: new BigNumber('3000000000'),
      },
      baseUrl,
    )

    // THEN: The message is as follows
    expect(actual).toEqual(`Sell *3* \`${TOKEN_2}\` for *10* \`${BUY_TOKEN_SYMBOL}\`

  - *Price*:  1 \`${TOKEN_2}\` = 3.333333333333333333 \`${BUY_TOKEN_SYMBOL}\`
  - *Expires*: \`Tomorrow at 12:00 AM GMT\`, \`in a day\`

Fill the order here: http://dex.gnosis.io//trade/COOL-${TOKEN_2}?sell=10.02&price=3.333333333333333333`)
  })
})
