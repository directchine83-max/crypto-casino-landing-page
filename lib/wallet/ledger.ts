import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { WalletNetwork } from './types'

export type DepositRecord = {
  id: string
  ownerId: string
  network: WalletNetwork
  txHash: string
  amountRaw: string
  feeRaw: string
  creditedRaw: string
  seenAt: number
}

export type PublicBalance = { network: WalletNetwork; amountRaw: string }

type LedgerState = {
  balances: Record<string, string>
  fees: Partial<Record<WalletNetwork, string>>
  deposits: DepositRecord[]
}

const globalForLedger = globalThis as unknown as { __rollbitLedger?: LedgerState }
const state: LedgerState = globalForLedger.__rollbitLedger ?? (globalForLedger.__rollbitLedger = { balances: {}, fees: {}, deposits: [] })

let loaded = false
let filePath = ''

function storePath(): string {
  return process.env.WALLET_LEDGER_PATH?.trim() || process.env.WALLET_STORE_PATH?.trim() || './data'
}

function persistEnabled(): boolean {
  return process.env.WALLET_PERSIST !== 'false'
}

function configure(): void {
  filePath = persistEnabled() ? resolve(process.cwd(), storePath(), 'ledger.json') : ''
  if (!filePath || loaded) return
  loaded = true
  try {
    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ filePath, 'utf-8')) as LedgerState
    state.balances = parsed.balances ?? {}
    state.fees = parsed.fees ?? {}
    state.deposits = Array.isArray(parsed.deposits) ? parsed.deposits : []
  } catch {
    /* first run */
  }
}

function flush(): void {
  if (!filePath) return
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(state, null, 2), { mode: 0o600 })
  } catch {
    /* read-only filesystem: keep in memory */
  }
}

function key(ownerId: string, network: WalletNetwork): string {
  return `${ownerId}:${network}`
}

export function getServiceFeeBps(): number {
  const parsed = Number.parseInt(process.env.SERVICE_FEE_BPS ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 100
  return Math.min(parsed, 5000)
}

export function splitFee(grossRaw: bigint, bps = getServiceFeeBps()): { feeRaw: bigint; creditedRaw: bigint } {
  const feeRaw = (grossRaw * BigInt(bps)) / 10_000n
  return { feeRaw, creditedRaw: grossRaw - feeRaw }
}

export function getBalanceRaw(ownerId: string, network: WalletNetwork): bigint {
  configure()
  return BigInt(state.balances[key(ownerId, network)] ?? '0')
}

export function listBalances(ownerId: string): PublicBalance[] {
  configure()
  const prefix = `${ownerId}:`
  return Object.entries(state.balances)
    .filter(([entryKey, value]) => entryKey.startsWith(prefix) && BigInt(value) > 0n)
    .map(([entryKey, value]) => ({ network: entryKey.slice(prefix.length) as WalletNetwork, amountRaw: value }))
}

export function getFeesCollected(network: WalletNetwork): bigint {
  configure()
  return BigInt(state.fees[network] ?? '0')
}

export function hasDeposit(network: WalletNetwork, txHash: string): boolean {
  configure()
  return state.deposits.some(deposit => deposit.network === network && deposit.txHash === txHash)
}

export function recordDeposit(ownerId: string, network: WalletNetwork, txHash: string, grossRaw: bigint): DepositRecord {
  configure()
  const existing = state.deposits.find(deposit => deposit.network === network && deposit.txHash === txHash)
  if (existing) return existing

  const { feeRaw, creditedRaw } = splitFee(grossRaw)
  const record: DepositRecord = {
    id: `${network}:${txHash}`,
    ownerId,
    network,
    txHash,
    amountRaw: grossRaw.toString(),
    feeRaw: feeRaw.toString(),
    creditedRaw: creditedRaw.toString(),
    seenAt: Date.now(),
  }
  state.deposits.push(record)
  const balanceKey = key(ownerId, network)
  state.balances[balanceKey] = (BigInt(state.balances[balanceKey] ?? '0') + creditedRaw).toString()
  state.fees[network] = (BigInt(state.fees[network] ?? '0') + feeRaw).toString()
  flush()
  return record
}

export function countDeposits(): number {
  configure()
  return state.deposits.length
}

export function listDeposits(ownerId: string): DepositRecord[] {
  configure()
  return state.deposits.filter(deposit => deposit.ownerId === ownerId).sort((a, b) => b.seenAt - a.seenAt)
}

export function credit(ownerId: string, network: WalletNetwork, amountRaw: bigint): void {
  configure()
  const balanceKey = key(ownerId, network)
  state.balances[balanceKey] = (BigInt(state.balances[balanceKey] ?? '0') + amountRaw).toString()
  flush()
}

export function debit(ownerId: string, network: WalletNetwork, amountRaw: bigint): boolean {
  configure()
  const balanceKey = key(ownerId, network)
  const current = BigInt(state.balances[balanceKey] ?? '0')
  if (amountRaw <= 0n || amountRaw > current) return false
  state.balances[balanceKey] = (current - amountRaw).toString()
  flush()
  return true
}
