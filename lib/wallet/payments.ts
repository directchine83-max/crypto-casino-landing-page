import { formatUnits, parseUnits } from './amounts'
import { getChainConfig, getTxTimeoutMs, isBroadcastEnabled } from './chain-config'
import { collectIncomingTransfers } from './deposits'
import { credit, debit, getBalanceRaw, hasDeposit, listBalances, recordDeposit, type DepositRecord } from './ledger'
import { WalletError, createDepositWallet, revealWallet } from './service'
import { broadcastTransaction, buildTransfer, type SignedTransaction } from './tx'
import type { WalletNetwork } from './types'

export type DepositAddress = {
  network: WalletNetwork
  address: string
  walletId: string
  symbol: string
  explorerUrl: string
}

export type Balance = { network: WalletNetwork; amountRaw: string; amount: string; symbol: string }

function toBalance(ownerId: string, network: WalletNetwork): Balance {
  const chain = getChainConfig(network)
  const amountRaw = getBalanceRaw(ownerId, network)
  return { network, amountRaw: amountRaw.toString(), amount: formatUnits(amountRaw, chain.decimals), symbol: chain.symbol }
}

export function getDepositAddress(ownerId: string, network: WalletNetwork): DepositAddress {
  const chain = getChainConfig(network)
  const wallet = createDepositWallet(ownerId, network)
  return { network, address: wallet.address, walletId: wallet.walletId, symbol: chain.symbol, explorerUrl: chain.explorerUrl }
}

export function getBalances(ownerId: string): Balance[] {
  return listBalances(ownerId).map(entry => toBalance(ownerId, entry.network))
}

export async function scanDeposits(ownerId: string, network: WalletNetwork, timeoutMs = getTxTimeoutMs()): Promise<{ credited: DepositRecord[]; balance: Balance }> {
  const wallet = createDepositWallet(ownerId, network)
  const transfers = await collectIncomingTransfers(network, wallet.address, timeoutMs)
  const credited: DepositRecord[] = []
  for (const transfer of transfers) {
    if (hasDeposit(network, transfer.txHash)) continue
    credited.push(recordDeposit(ownerId, network, transfer.txHash, BigInt(transfer.amountRaw)))
  }
  return { credited, balance: toBalance(ownerId, network) }
}

export async function withdraw(input: { ownerId: string; network: WalletNetwork; to: string; amount: string; passphrase?: unknown }): Promise<{ tx: SignedTransaction; broadcast: boolean; remaining: Balance }> {
  const chain = getChainConfig(input.network)
  const amountRaw = parseUnits(input.amount, chain.decimals)
  if (amountRaw <= 0n) throw new WalletError('Amount must be greater than zero.')

  const wallet = createDepositWallet(input.ownerId, input.network)
  const { secret } = revealWallet(wallet.walletId, input.ownerId, input.passphrase)

  const balance = getBalanceRaw(input.ownerId, input.network)
  if (amountRaw > balance) throw new WalletError('Insufficient balance.', 400)
  if (!debit(input.ownerId, input.network, amountRaw)) throw new WalletError('Insufficient balance.', 400)

  const timeoutMs = getTxTimeoutMs()
  let tx: SignedTransaction
  try {
    tx = await buildTransfer(input.network, secret.privateKey, input.to.trim(), amountRaw.toString(), timeoutMs)
  } catch (error) {
    credit(input.ownerId, input.network, amountRaw)
    throw new WalletError(error instanceof Error ? error.message : 'Unable to build transaction.', 502)
  }

  let broadcast = false
  if (isBroadcastEnabled()) {
    try {
      const hash = await broadcastTransaction(input.network, tx.raw, timeoutMs)
      broadcast = true
      tx = { ...tx, hash, explorerUrl: `${chain.explorerUrl}${hash}` }
    } catch (error) {
      credit(input.ownerId, input.network, amountRaw)
      throw new WalletError(error instanceof Error ? error.message : 'Broadcast failed.', 502)
    }
  }

  return { tx, broadcast, remaining: toBalance(input.ownerId, input.network) }
}
