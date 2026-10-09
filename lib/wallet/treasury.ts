import { CHAIN_NETWORKS, getChainConfig } from './chain-config'
import type { WalletNetwork } from './types'

export type TreasuryAddress = {
  network: WalletNetwork
  symbol: string
  address: string
  explorerUrl: string
  configured: boolean
}

export function getTreasuryAddresses(): TreasuryAddress[] {
  return CHAIN_NETWORKS.map(network => {
    const chain = getChainConfig(network)
    return {
      network,
      symbol: chain.symbol,
      address: chain.treasuryAddress,
      explorerUrl: chain.treasuryAddress ? `${chain.addressExplorerUrl}${chain.treasuryAddress}` : chain.addressExplorerUrl,
      configured: chain.configured,
    }
  })
}

export function isTreasuryConfigured(): boolean {
  return getTreasuryAddresses().some(entry => entry.configured)
}
