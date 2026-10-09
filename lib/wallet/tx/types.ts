import type { WalletNetwork } from '../types'

export type SignedTransaction = {
  network: WalletNetwork
  from: string
  to: string
  amount: string
  amountRaw: string
  raw: string
  encoding: 'hex' | 'base64'
  hash: string
  explorerUrl: string
}

export type TransferInput = {
  privateKeyHex: string
  to: string
  amount: string
  rpcUrl: string
  explorerUrl: string
  timeoutMs: number
}
