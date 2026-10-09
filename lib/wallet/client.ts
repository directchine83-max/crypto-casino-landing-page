import type { PublicWallet, Secret, WalletNetwork, WalletSecretType } from './types'

export type { PublicWallet, Secret, WalletNetwork, WalletSecretType } from './types'

export class WalletApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type CreateWalletInput = {
  network: WalletNetwork
  ownerId: string
  passphrase?: string
  label?: string
}

export type ImportWalletInput = CreateWalletInput & {
  secret: string
  type: WalletSecretType
}

export type RevealWalletInput = {
  walletId: string
  ownerId: string
  passphrase?: string
}

export type WalletResult = { wallet: PublicWallet; secret: Secret; warning?: string }
export type WalletListResult = { wallets: PublicWallet[]; configured: boolean }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/wallets${path}`, init)
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new WalletApiError(data.error ?? 'Wallet request failed.', response.status)
  return data as T
}

const jsonInit = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function createWallet(input: CreateWalletInput): Promise<WalletResult> {
  return request<WalletResult>('/create', jsonInit(input))
}

export function importWallet(input: ImportWalletInput): Promise<WalletResult> {
  return request<WalletResult>('/import', jsonInit(input))
}

export function revealWallet(input: RevealWalletInput): Promise<WalletResult> {
  return request<WalletResult>('/reveal', jsonInit(input))
}

export function listWallets(ownerId: string): Promise<WalletListResult> {
  return request<WalletListResult>(`/list?ownerId=${encodeURIComponent(ownerId)}`)
}
