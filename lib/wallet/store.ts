import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { WalletNetwork } from './types'

export type WalletRecord = {
  walletId: string
  ownerId: string
  network: WalletNetwork
  address: string
  path: string
  ciphertext: string
  passphraseRequired: boolean
  passphraseHash: string | null
  label: string
  createdAt: number
}

const globalForStore = globalThis as unknown as { __rollbitWallets?: Map<string, WalletRecord> }
const wallets = globalForStore.__rollbitWallets ?? (globalForStore.__rollbitWallets = new Map<string, WalletRecord>())

let loaded = false
let filePath = ''

export function configureStore(storePath: string, persist: boolean): void {
  filePath = persist ? resolve(process.cwd(), storePath, 'wallets.json') : ''
  if (!filePath || loaded) return
  loaded = true
  try {
    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ filePath, 'utf-8')) as WalletRecord[]
    for (const record of parsed) {
      if (record?.walletId) wallets.set(record.walletId, record)
    }
  } catch {
    /* first run or unreadable store: start empty */
  }
}

function flush(): void {
  if (!filePath) return
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify([...wallets.values()], null, 2), { mode: 0o600 })
  } catch {
    /* read-only filesystem (serverless): fall back to in-memory only */
  }
}

export function saveWallet(record: WalletRecord): void {
  wallets.set(record.walletId, record)
  flush()
}

export function getWallet(walletId: string): WalletRecord | undefined {
  return wallets.get(walletId)
}

export function listWallets(ownerId: string): WalletRecord[] {
  return [...wallets.values()].filter(record => record.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt)
}
