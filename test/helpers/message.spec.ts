import BigNumber from 'bignumber.js'

import { TOKEN_1, TOKEN_2, USER_1 } from '../data'

import { OrderDto, TokenDto } from 'services'
import {
  buildExpirationMsg,
  buildUnknownTokenMsg,
  buildNotYetActiveOrderMsg,
  buildSellMsg,
  buildFillOrderUrl,
  calculateUnlimitedBuyTokenFillAmount,
  newOrderMessage,
  concatMessages,
  SendMessageInput,
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
  priceNumerator: new BigNumber(10000000000000000000),
  priceDenominator: new BigNumber(11000000000),
  validFrom: new Date('2020-02-24T00:00:00.000'),
  validUntil: new Date('2020-02-25T00:00:00.000'),
  validFromBatchId: new BigNumber(0),
  validUntilBatchId: new BigNumber(1),
  event: new MockEvent(),
  networkId: 1,
}

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
    const actual = buildSellMsg({
      isUnlimited,
      buyTokenLabel,
      sellTokenLabel,
      buyAmount: '',
      sellAmount: '',
    })

    // THEN: It reads as follows
    expect(actual).toEqual(`Sell \`${sellTokenLabel}\` for \`${buyTokenLabel}\``)
  })

  test('limit order', () => {
    // GIVEN: a limited order
    const isUnlimited = false
    const buyAmount = '1'
    const sellAmount = '2'

    // WHEN: Build the sell message
    const actual = buildSellMsg({ isUnlimited, buyTokenLabel, sellTokenLabel, buyAmount, sellAmount })

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

describe('buildFillOrderUrl', () => {
  const price = new BigNumber('1.1')
  const baseUrl = 'http://dex.gnosis.io/'
  const buyTokenParam = 'SCM'
  const sellTokenParam = 'PMD'

  test('unlimited order', () => {
    // GIVEN: An unlimited order
    const isUnlimited = true

    // WHEN: Build fill order url
    const actual = buildFillOrderUrl({
      isUnlimited,
      order: baseOrder,
      price,
      baseUrl,
      buyTokenParam,
      sellTokenParam,
    })

    // THEN: The url has the correct price and a sell amount of 0
    expect(actual).toEqual(`${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=0&price=0.9072727272727272727`)
  })

  test('limited order', () => {
    // GIVEN: A limited order
    const isUnlimited = false

    // WHEN: Build fill order url
    const actual = buildFillOrderUrl({
      isUnlimited,
      order: baseOrder,
      price,
      baseUrl,
      buyTokenParam,
      sellTokenParam,
    })

    // THEN: The url has the correct price and a sell amount of 0
    expect(actual).toEqual(`${baseUrl}/trade/${buyTokenParam}-${sellTokenParam}?sell=10.02&price=0.907272727245508982`)
  })
})

describe('newOrderMessage', () => {
  const baseUrl = 'http://dex.gnosis.io/'

  test('basic example', () => {
    // GIVEN: A maker that sells 1.23 token2 for 12.1 token1
    // GIVEN: token1 has 2 decimals and token2 has 1 decimal
    // GIVEN: Price of the maker is 0.1016528925619834...
    const order = {
      ...baseOrder,
      sellToken: { ...baseSellToken, decimals: 2 }, // token2
      buyToken: { ...baseBuyToken, decimals: 1 }, // token1
      priceNumerator: new BigNumber(121), // 12.1 token1 (buy)
      priceDenominator: new BigNumber(123), // 1.23 token2 (sell)
    }
    Date.now = jest.fn().mockReturnValue(new Date('2020-02-24T00:02:10.000'))

    // WHEN: Build fill order url
    const actual = newOrderMessage(order, baseUrl)

    // THEN: The price in the URL (price for the taker) allows the maker trade to execute fully
    // THEN: Price for maker is 9.837398373983739837
    // THEN: Sell amount is 12.2 token1
    // THEN: Price for taker is 0.100819672131147540
    // Some intermediate steps to explain previous numbers:
    //    * Calculate the maker price:
    //        * Since he sells 1.23 token2 for 12.1 token1
    //        => Price: 12.1 / 1.23  = 9.8373983739837398374
    //    * Get taker theoretic price
    //        * We need to apply to the price the 2 fees:   0.998 * 1 / 9.837398373983739837 = 0.1014495867768595041...
    //    * Calculate sell amount for taker:
    //        * The maker wants 12.1 token1 and the taker needs to include the two fees in the trade
    //        * Then the taker needs to sell:   12.1 / 0.998 = 12.124248497 token1
    //        * Since token1 has 1 decimal. The taker will round and ceil this value
    //        => He will sell 12.2 token1
    //    * Calculate the buy tokens for the taker
    //        * Using the "theoretic taker price":  12.2 * 0.101449586776859504 = 1.2376849586776859488 token2
    //        * token2 have 2 decimal, we adjust precision flooring the value --->  1.23 token2
    //    * Calculate final price for taker:
    //        * 1.23 / 12.2 = 0.1008196721311475409836065574
    expect(actual).toEqual(`Sell *1.23* \`${TOKEN_2}\` for *12.1* \`${BUY_TOKEN_SYMBOL}\`

  - *Price*:  1 \`${TOKEN_2}\` = 9.8373983739837398374 \`${BUY_TOKEN_SYMBOL}\`
  - *Price*:  1 \`${BUY_TOKEN_SYMBOL}\` = 0.1016528925619834711 \`${TOKEN_2}\`
  - *Expires*: \`Tomorrow at 12:00 AM GMT\`, \`in a day\`

Fill the order here: http://dex.gnosis.io//trade/COOL-${TOKEN_2}?sell=12.2&price=0.100819672131147541`)
  })

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

  - *Price*:  1 \`${TOKEN_2}\` = 3.3333333333333333333 \`${BUY_TOKEN_SYMBOL}\`
  - *Price*:  1 \`${BUY_TOKEN_SYMBOL}\` = 0.3 \`${TOKEN_2}\`
  - *Expires*: \`Tomorrow at 12:00 AM GMT\`, \`in a day\`

Fill the order here: http://dex.gnosis.io//trade/COOL-${TOKEN_2}?sell=10.02&price=0.2994`)
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

  - *Price*:  1 \`${TOKEN_2}\` = 3.3333333333333333333 \`${BUY_TOKEN_SYMBOL}\`
  - *Price*:  1 \`${BUY_TOKEN_SYMBOL}\` = 0.3 \`${TOKEN_2}\`
  - *Expires*: \`Tomorrow at 12:00 AM GMT\`, \`in a day\`

Fill the order here: http://dex.gnosis.io//trade/COOL-${TOKEN_2}?sell=10.02&price=0.2994`)
  })
})

describe('concatMessages', () => {
  const defaultMessage: SendMessageInput = {
    chatId: 1,
    options: { parse_mode: 'Markdown' },
    text: '',
  }

  const delimeter = '---DELIMETER---'

  const message1 = {
    ...defaultMessage,
    text: 'ABC',
  }
  const message2 = {
    ...defaultMessage,
    text: 'DEF',
  }
  const message3 = {
    ...defaultMessage,
    text: 'GHI',
  }

  test('concatenates message text', () => {
    const compoundMessage = concatMessages([message1, message2, message3], { delimeter })

    expect(compoundMessage).toEqual([{
      ...defaultMessage,
      text: 'ABC' + delimeter + 'DEF' + delimeter + 'GHI',
    }])
  })
  test('concatenates message text up to maxLength', () => {
    // slightly more than two messages + delimeter
    // so that third message doesn't fit
    const maxLength = 3 + 2 * delimeter.length + 1
    const compoundMessage = concatMessages([message1, message2, message3], { delimeter, maxLength })

    expect(compoundMessage).toEqual([{
      ...defaultMessage,
      text: 'ABC' + delimeter + 'DEF',
    }, message3])
  })
  test('does not change single message', () => {
    const compoundMessage = concatMessages([message1])

    expect(compoundMessage).toEqual([message1])
  })
  test('does not change empty array', () => {
    const compoundMessage = concatMessages([])

    expect(compoundMessage).toEqual([])
  })
})
