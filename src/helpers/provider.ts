import { provider } from 'web3-core'
import { strict as assert } from 'assert'
import Web3 from 'web3'
const HDWalletProvider = require('truffle-hdwallet-provider')

let _provider: provider | undefined
interface CustomProviderParams {
  url: string
  mnemonic?: string
  pk?: string
  addressIndex?: number
  numAddresses?: number
  shareNonce?: boolean
}

class CustomProvider extends HDWalletProvider {
  constructor (params: CustomProviderParams) {
    const { mnemonic, url, pk, addressIndex = 0, numAddresses = 1, shareNonce = true } = params
    if (mnemonic) {
      super(mnemonic || pk, url, addressIndex, numAddresses, shareNonce)
    } else {
      assert(numAddresses === 1, 'numAddresses must be 1 for a wallet setup with PK. Use MNEMONIC instead')
      super(pk, url, addressIndex, 1, shareNonce)
    }
  }
}

export function getProvider (): provider {
  if (!_provider) {
    const { PK, MNEMONIC, NODE_URL } = process.env
    if (!NODE_URL) {
    }
    assert(NODE_URL, 'NODE_URL env var is required')

    if (MNEMONIC) {
      _provider = new CustomProvider({
        mnemonic: MNEMONIC as string,
        url: NODE_URL as string
      }) as provider
    } else if (PK) {
      _provider = new CustomProvider({
        pk: PK as string,
        url: NODE_URL as string
      }) as provider
    } else {
      // Read-only provider
      return new Web3.providers.HttpProvider(NODE_URL as string)
    }
  }

  return _provider
}
