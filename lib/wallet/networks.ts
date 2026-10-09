import type { WalletNetwork } from './types'

export type WalletNetworkOption = { id: WalletNetwork; label: string; symbol: string }

export const WALLET_NETWORKS: WalletNetworkOption[] = [
  { id: 'ethereum', label: 'Ethereum', symbol: 'ETH' },
  { id: 'solana', label: 'Solana', symbol: 'SOL' },
  { id: 'bitcoin', label: 'Bitcoin', symbol: 'BTC' },
]

export const NETWORK_SYMBOL: Record<WalletNetwork, string> = {
  ethereum: 'ETH',
  solana: 'SOL',
  bitcoin: 'BTC',
}
