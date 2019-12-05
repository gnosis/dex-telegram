export type Command = () => void
export type AsyncCommand = () => Promise<void>

export interface TokenDetails {
  name?: string
  symbol?: string
  decimals?: number
  address: string
  addressMainnet?: string
  image?: string
}
