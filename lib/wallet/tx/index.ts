import { getBitcoinFeeRate, getChainConfig } from '../chain-config'
import { jsonRpc } from '../rpc'
import type { WalletNetwork } from '../types'
import { buildBitcoinTransfer } from './bitcoin'
import { buildEthereumTransfer } from './ethereum'
import { buildSolanaTransfer } from './solana'
import type { SignedTransaction } from './types'

export type { SignedTransaction } from './types'

export async function buildTransfer(network: WalletNetwork, privateKeyHex: string, to: string, amountRaw: string, timeoutMs: number): Promise<SignedTransaction> {
  const chain = getChainConfig(network)
  const base = { privateKeyHex, to, amount: amountRaw, rpcUrl: chain.rpcUrl, explorerUrl: chain.explorerUrl, timeoutMs }
  if (network === 'ethereum') return buildEthereumTransfer(base)
  if (network === 'solana') return buildSolanaTransfer(base)
  return buildBitcoinTransfer({ ...base, feeRate: getBitcoinFeeRate() })
}

export async function broadcastTransaction(network: WalletNetwork, raw: string, timeoutMs: number): Promise<string> {
  const chain = getChainConfig(network)
  if (network === 'ethereum') return jsonRpc<string>(chain.rpcUrl, 'eth_sendRawTransaction', [raw], timeoutMs)
  if (network === 'solana') return jsonRpc<string>(chain.rpcUrl, 'sendTransaction', [raw, { encoding: 'base64', preflightCommitment: 'confirmed' }], timeoutMs)
  const response = await fetch(`${chain.rpcUrl}/tx`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: raw, signal: AbortSignal.timeout(timeoutMs) })
  const text = (await response.text()).trim()
  if (!response.ok) throw new Error(text || `Broadcast failed (HTTP ${response.status})`)
  return text
}
