export const TCR_CONTRACT_ADDRESS = process.env.TCR_CONTRACT_ADDRESS
export const TCR_LIST_ID = Number(process.env.TCR_LIST_ID) || 0
export const TCR_CACHE_TIME = 5 * 60 * 1000
export const TOKEN_OVERRIDES = {
  1: {
    // Deprecated sUSD proxy contract
    '0x57ab1e02fee23774580c119740129eac7081e9d3': {
      forceAddressDisplay: true,
    },
    // Deprecated SNX proxy contract
    '0xc011a72400e58ecd99ee497cf89e3775d4bd732f': {
      forceAddressDisplay: true,
    },
  },
  4: {
    // Just for testing, this is not really deprecated
    '0x1b642a124cdfa1e5835276a6ddaa6cfc4b35d52c': {
      // Override any token detail
      // name: 'Synthetics sUSD (deprecated) (this is rinkeby, so not really)',
      // symbol: 'sUSD-old',
      // decimals: 18,
      forceAddressDisplay: true, // name and symbol are ignored when `forceAddressDisplay` is set
    },
  },
  100: {},
}
