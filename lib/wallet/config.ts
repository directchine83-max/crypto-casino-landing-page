import { DEFAULT_KEY_SALT, isValidMasterKey } from './crypto'

export type WalletConfig = {
  masterKey: string
  configured: boolean
  salt: string
  storePath: string
  persist: boolean
  requirePassphrase: boolean
  minPassphraseLength: number
  maxPerOwner: number
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getWalletConfig(): WalletConfig {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY?.trim() ?? ''
  return {
    masterKey,
    configured: isValidMasterKey(masterKey),
    salt: process.env.WALLET_KEY_SALT?.trim() || DEFAULT_KEY_SALT,
    storePath: process.env.WALLET_STORE_PATH?.trim() || './data',
    persist: process.env.WALLET_PERSIST !== 'false',
    requirePassphrase: process.env.WALLET_REQUIRE_PASSPHRASE === 'true',
    minPassphraseLength: positiveInt(process.env.WALLET_MIN_PASSPHRASE_LENGTH, 8),
    maxPerOwner: positiveInt(process.env.WALLET_MAX_PER_OWNER, 20),
  }
}
