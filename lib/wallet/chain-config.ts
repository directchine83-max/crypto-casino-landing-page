import type { WalletNetwork } from './types'

export type ChainConfig = {
  network: WalletNetwork
  rpcUrl: string
  treasuryAddress: string
  explorerUrl: string
  addressExplorerUrl: string
  symbol: string
  decimals: number
  configured: boolean
}

type ChainDefaults = { rpcUrl: string; explorerUrl: string; addressExplorerUrl: string; symbol: string; decimals: number; rpcEnv: string; treasuryEnv: string }

const DEFAULTS: Record<WalletNetwork, ChainDefaults> = {
  ethereum: { rpcUrl: 'https://ethereum-rpc.publicnode.com', explorerUrl: 'https://etherscan.io/tx/', addressExplorerUrl: 'https://etherscan.io/address/', symbol: 'ETH', decimals: 18, rpcEnv: 'ETHEREUM_RPC_URL', treasuryEnv: 'ETHEREUM_TREASURY_ADDRESS' },
  solana: { rpcUrl: 'https://api.mainnet-beta.solana.com', explorerUrl: 'https://solscan.io/tx/', addressExplorerUrl: 'https://solscan.io/account/', symbol: 'SOL', decimals: 9, rpcEnv: 'SOLANA_RPC_URL', treasuryEnv: 'SOLANA_TREASURY_ADDRESS' },
  bitcoin: { rpcUrl: 'https://mempool.space/api', explorerUrl: 'https://mempool.space/tx/', addressExplorerUrl: 'https://mempool.space/address/', symbol: 'BTC', decimals: 8, rpcEnv: 'BITCOIN_API_URL', treasuryEnv: 'BITCOIN_TREASURY_ADDRESS' },
}

export function getChainConfig(network: WalletNetwork): ChainConfig {
  const defaults = DEFAULTS[network]
  const treasuryAddress = process.env[defaults.treasuryEnv]?.trim() ?? ''
  return {
    network,
    rpcUrl: process.env[defaults.rpcEnv]?.trim() || defaults.rpcUrl,
    treasuryAddress,
    explorerUrl: defaults.explorerUrl,
    addressExplorerUrl: defaults.addressExplorerUrl,
    symbol: defaults.symbol,
    decimals: defaults.decimals,
    configured: treasuryAddress.length > 0,
  }
}

export function isBroadcastEnabled(): boolean {
  return process.env.WALLET_BROADCAST === 'true'
}

export function getTxTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.WALLET_TX_TIMEOUT_MS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000
}

export function getBitcoinFeeRate(): number | undefined {
  const parsed = Number.parseFloat(process.env.BITCOIN_FEE_RATE ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const CHAIN_NETWORKS: WalletNetwork[] = ['ethereum', 'solana', 'bitcoin']
