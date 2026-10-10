export const SOLANA_DECIMALS = 9
export const LAMPORTS_PER_SOL = 1_000_000_000
export const BASE_SIGNATURE_FEE_LAMPORTS = 5_000
export const DEFAULT_COMPUTE_UNITS = 200
export const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com'

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet'

export type SolanaConfig = {
  rpcUrl: string
  cluster: SolanaCluster
  commitment: 'processed' | 'confirmed' | 'finalized'
  treasuryAddress: string
  symbol: string
  decimals: number
  explorerTxUrl: string
  explorerAddressUrl: string
  explorerQuery: string
  configured: boolean
  sendEnabled: boolean
}

function normalizeCluster(value: string | undefined, rpcUrl: string): SolanaCluster {
  const candidate = (value ?? '').trim().toLowerCase()
  if (candidate === 'devnet' || candidate === 'testnet' || candidate === 'localnet' || candidate === 'mainnet-beta') {
    return candidate
  }
  if (rpcUrl.includes('devnet')) return 'devnet'
  if (rpcUrl.includes('testnet')) return 'testnet'
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) return 'localnet'
  return 'mainnet-beta'
}

function explorerSuffix(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return ''
  return `?cluster=${cluster}`
}

export function getSolanaConfig(): SolanaConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC_URL
  const cluster = normalizeCluster(process.env.SOLANA_NETWORK, rpcUrl)
  const treasuryAddress = process.env.SOLANA_TREASURY_ADDRESS?.trim() ?? ''
  const suffix = explorerSuffix(cluster)
  return {
    rpcUrl,
    cluster,
    commitment: 'confirmed',
    treasuryAddress,
    symbol: 'SOL',
    decimals: SOLANA_DECIMALS,
    explorerTxUrl: 'https://solscan.io/tx/',
    explorerAddressUrl: 'https://solscan.io/account/',
    explorerQuery: suffix,
    configured: treasuryAddress.length > 0,
    sendEnabled: process.env.SOLANA_SEND_ENABLED !== 'false',
  }
}

export function getSolanaTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.SOLANA_RPC_TIMEOUT_MS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20_000
}

export function getPriorityFeeMicroLamports(): number {
  const parsed = Number.parseInt(process.env.SOLANA_PRIORITY_FEE_MICROLAMPORTS ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(parsed, 5_000_000)
}
