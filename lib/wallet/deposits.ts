import type { WalletNetwork } from './types'
import { getChainConfig } from './chain-config'
import { jsonRpc, restGet } from './rpc'
import { WalletError } from './service'

export type IncomingTransfer = { txHash: string; amountRaw: string }

const MAX_SOLANA_SIGNATURES = 10

async function ethereumTransfers(address: string, timeoutMs: number): Promise<IncomingTransfer[]> {
  const base = process.env.ETHEREUM_INDEXER_URL?.trim() || 'https://api.etherscan.io/api'
  const apiKey = process.env.ETHERSCAN_API_KEY?.trim() || ''
  if (!apiKey && base.includes('etherscan.io')) {
    throw new WalletError('Ethereum deposit scanning requires ETHERSCAN_API_KEY (or ETHEREUM_INDEXER_URL).', 503)
  }
  const url = `${base}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=100&apikey=${apiKey}`
  const data = await restGet<{ status: string; result: { hash: string; to?: string; value: string; isError?: string }[] | string }>(url, timeoutMs)
  if (!Array.isArray(data.result)) return []
  return data.result
    .filter(tx => tx.to?.toLowerCase() === address.toLowerCase() && tx.isError !== '1' && BigInt(tx.value) > 0n)
    .map(tx => ({ txHash: tx.hash, amountRaw: tx.value }))
}

async function bitcoinTransfers(address: string, timeoutMs: number): Promise<IncomingTransfer[]> {
  const chain = getChainConfig('bitcoin')
  type BitcoinTx = { txid: string; vout: { scriptpubkey_address?: string; value: number }[] }
  const [confirmed, unconfirmed] = await Promise.all([
    restGet<BitcoinTx[]>(`${chain.rpcUrl}/address/${address}/txs`, timeoutMs).catch(() => []),
    restGet<BitcoinTx[]>(`${chain.rpcUrl}/address/${address}/txs/mempool`, timeoutMs).catch(() => []),
  ])
  return [...confirmed, ...unconfirmed]
    .map(tx => ({ txHash: tx.txid, amountRaw: tx.vout.filter(out => out.scriptpubkey_address === address).reduce((sum, out) => sum + BigInt(out.value), 0n) }))
    .filter(tx => tx.amountRaw > 0n)
    .map(tx => ({ txHash: tx.txHash, amountRaw: tx.amountRaw.toString() }))
}

async function solanaTransfers(address: string, timeoutMs: number): Promise<IncomingTransfer[]> {
  const chain = getChainConfig('solana')
  const signatures = await jsonRpc<{ signature: string; err: unknown }[]>(chain.rpcUrl, 'getSignaturesForAddress', [address, { limit: MAX_SOLANA_SIGNATURES, commitment: 'finalized' }], timeoutMs)
  const transfers: IncomingTransfer[] = []
  for (const entry of signatures) {
    if (entry.err) continue
    const tx = await jsonRpc<{ meta?: { err: unknown; preBalances: number[]; postBalances: number[] }; transaction: { message: { accountKeys: { pubkey: string }[] } } } | null>(
      chain.rpcUrl,
      'getTransaction',
      [entry.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      timeoutMs,
    ).catch(() => null)
    if (!tx?.meta || tx.meta.err) continue
    const index = tx.transaction.message.accountKeys.findIndex(key => key.pubkey === address)
    if (index < 0) continue
    const delta = BigInt(tx.meta.postBalances[index]) - BigInt(tx.meta.preBalances[index])
    if (delta > 0n) transfers.push({ txHash: entry.signature, amountRaw: delta.toString() })
  }
  return transfers
}

export async function collectIncomingTransfers(network: WalletNetwork, address: string, timeoutMs: number): Promise<IncomingTransfer[]> {
  if (network === 'ethereum') return ethereumTransfers(address, timeoutMs)
  if (network === 'solana') return solanaTransfers(address, timeoutMs)
  return bitcoinTransfers(address, timeoutMs)
}
