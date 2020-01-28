import BigNumber from 'bignumber.js'

import { OrderDto } from 'services'
import {
  calculatePrice,
  buildExpirationMsg,
  buildUnknownTokenMsg,
  buildNotYetActiveOrderMsg,
  buildSellMsg,
  buildFillOrderMsg,
  calculateUnlimitedBuyTokenFillAmount,
} from 'helpers'
import { MAX_BATCH_ID } from '@gnosis.pm/dex-js'

const MockEvent = jest.fn()

const baseBuyToken = { decimals: 18, address: '0x', known: true }
const baseSellToken = { decimals: 18, address: '0x', known: true }
const baseOrder: OrderDto = {
  owner: '0x',
  buyToken: baseBuyToken,
  sellToken: baseSellToken,
  priceNumerator: new BigNumber(10),
  priceDenominator: new BigNumber(10),
  validFrom: new Date(),
  validUntil: new Date(),
  validFromBatchId: new BigNumber(0),
  validUntilBatchId: new BigNumber(1),
  event: new MockEvent(),
}

describe('calculatePrice', () => {
  test('buy token with same or higher precision', () => {
    const actual = calculatePrice(baseOrder)

    expect(actual.toString(10)).toBe('1')
  })

  test('sell token with higher precision', () => {
    const order = { ...baseOrder, buyToken: { ...baseBuyToken, decimals: 17 } }

    const actual = calculatePrice(order)

    expect(actual.toString(10)).toBe('10')
  })
})

describe('buildExpirationMsg', () => {
  test('With expiration', () => {
    const actual = buildExpirationMsg(baseOrder)

    expect(actual).toMatch(/\*Expires\*: `.+ GMT`, `.+`/)
  })

  test('Without expiration', () => {
    const order = { ...baseOrder, validUntilBatchId: new BigNumber(MAX_BATCH_ID) }

    const actual = buildExpirationMsg(order)

    expect(actual).toMatch(/\*Expires\*: Valid until cancelled/)
  })
})

describe('buildUnknownTokenMsg', () => {
  test('No unknown tokens', () => {
    const actual = buildUnknownTokenMsg(baseOrder)

    expect(actual).toBe('')
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

    expect(actual).toBe('')
  })

  test('Not yet active order', () => {
    const validFrom = new Date(new Date().getTime() + 10000)

    const active = buildNotYetActiveOrderMsg(validFrom)

    expect(active).toMatch(/\*Tradable\*: `.+ GMT`, `.+`/)
  })
})

describe('buildSellMsg', () => {
  const buyTokenLabel = 'SCM'
  const sellTokenLabel = 'PMD'

  test('unlimited order', () => {
    const actual = buildSellMsg(true, buyTokenLabel, sellTokenLabel, '', '')

    expect(actual).toMatch(new RegExp(`Sell \`${sellTokenLabel}\` for \`${buyTokenLabel}\``))
  })

  test('limit order', () => {
    const buyAmount = '1'
    const sellAmount = '2'

    const actual = buildSellMsg(false, buyTokenLabel, sellTokenLabel, buyAmount, sellAmount)

    expect(actual).toMatch(
      new RegExp(`Sell \\*${sellAmount}\\* \`${sellTokenLabel}\` for \\*${buyAmount}\\* \`${buyTokenLabel}\``),
    )
  })
})

describe('calculateUnlimitedBuyTokenFillAmount', () => {
  const price = new BigNumber('1.001')

  test('high precision token', () => {
    const actual = calculateUnlimitedBuyTokenFillAmount(price, baseSellToken)

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
  const price = new BigNumber(1.1)
  const baseUrl = 'http://dex.gnosis.io/'
  const buyTokenParam = 'SCM'
  const sellTokenParam = 'PMD'

  test('unlimited order', () => {
    const actual = buildFillOrderMsg(true, baseOrder, price, baseUrl, buyTokenParam, sellTokenParam)

    expect(actual).toMatch(
      new RegExp(
        `Fill the order here: ${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}\\?sell=10\\&buy=9.0727272727272727`,
      ),
    )
  })

  test('limited order', () => {
    const actual = buildFillOrderMsg(false, baseOrder, price, baseUrl, buyTokenParam, sellTokenParam)

    expect(actual).toMatch(
      new RegExp(
        `Fill the order here: ${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}\\?sell=0\\.000000000000009802\\&buy=0\\.00000000000000001`,
      ),
    )
  })
})
