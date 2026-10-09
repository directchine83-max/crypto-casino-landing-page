import { randomUUID } from 'node:crypto'
import { getWalletConfig, type WalletConfig } from './config'
import { decrypt, deriveWalletKey, encrypt, hashPassphrase, verifyPassphrase } from './crypto'
import { createMnemonic, deriveFromMnemonic, deriveFromPrivateKey, isValidMnemonic, isSupportedNetwork, type DerivedWallet, type WalletNetwork } from './derive'
import { configureStore, getWallet, listWallets, saveWallet, type WalletRecord } from './store'
import type { PublicWallet, Secret } from './types'

export type { PublicWallet, Secret } from './types'

export class WalletError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

type WalletBase = Pick<WalletRecord, 'network' | 'address' | 'path' | 'label'>

export type CreateInput = {
  network: string
  ownerId?: unknown
  passphrase?: unknown
  label?: unknown
}

function requireConfig(): WalletConfig {
  const config = getWalletConfig()
  if (!config.configured) {
    throw new WalletError('Wallet service is not configured: set MASTER_ENCRYPTION_KEY (64 hex chars).', 503)
  }
  return config
}

function normalizeOwner(ownerId: unknown): string {
  const owner = typeof ownerId === 'string' ? ownerId.trim() : ''
  if (owner.length < 8 || owner.length > 128) throw new WalletError('A valid ownerId (8-128 chars) is required.')
  return owner
}

function normalizePassphrase(value: unknown, config: WalletConfig, required: boolean): string {
  const passphrase = typeof value === 'string' ? value : ''
  if (required && passphrase.length === 0) throw new WalletError('A passphrase is required for this wallet service.')
  if (passphrase.length > 0 && passphrase.length < config.minPassphraseLength) {
    throw new WalletError(`Passphrase must be at least ${config.minPassphraseLength} characters.`)
  }
  return passphrase
}

function toPublic(record: WalletRecord): PublicWallet {
  return {
    walletId: record.walletId,
    network: record.network,
    address: record.address,
    path: record.path,
    label: record.label,
    passphraseRequired: record.passphraseRequired,
    createdAt: record.createdAt,
  }
}

function persistSecret(config: WalletConfig, ownerId: string, passphrase: string, secret: Secret, base: WalletBase): { record: WalletRecord; secret: Secret } {
  const passphraseRequired = config.requirePassphrase || passphrase.length > 0
  const key = deriveWalletKey(config.masterKey, ownerId, passphraseRequired ? passphrase : undefined, config.salt)
  const ciphertext = encrypt(JSON.stringify(secret), key)
  const record: WalletRecord = {
    walletId: randomUUID(),
    ownerId,
    ciphertext,
    passphraseRequired,
    passphraseHash: passphraseRequired ? hashPassphrase(passphrase) : null,
    createdAt: Date.now(),
    ...base,
  }
  saveWallet(record)
  return { record, secret }
}

export function createWallet(input: CreateInput): { wallet: PublicWallet; secret: Secret } {
  const config = requireConfig()
  const ownerId = normalizeOwner(input.ownerId)
  if (!isSupportedNetwork(input.network)) throw new WalletError('Unsupported network.')
  const passphrase = normalizePassphrase(input.passphrase, config, config.requirePassphrase)
  const label = typeof input.label === 'string' ? input.label.slice(0, 40) : ''
  configureStore(config.storePath, config.persist)
  if (listWallets(ownerId).length >= config.maxPerOwner) {
    throw new WalletError(`Wallet limit reached (${config.maxPerOwner}).`, 429)
  }

  const mnemonic = createMnemonic()
  let derived: DerivedWallet
  try {
    derived = deriveFromMnemonic(mnemonic, input.network)
  } catch {
    throw new WalletError('Wallet generation failed.', 500)
  }
  const secret: Secret = { mnemonic, privateKey: derived.privateKey }
  const { record } = persistSecret(config, ownerId, passphrase, secret, { network: input.network, address: derived.address, path: derived.path, label })
  return { wallet: toPublic(record), secret }
}

export function createDepositWallet(ownerId: string, network: WalletNetwork): PublicWallet {
  const config = requireConfig()
  const owner = normalizeOwner(ownerId)
  if (!isSupportedNetwork(network)) throw new WalletError('Unsupported network.')
  configureStore(config.storePath, config.persist)
  const existing = listWallets(owner).find(record => record.network === network)
  if (existing) return toPublic(existing)

  const mnemonic = createMnemonic()
  let derived: DerivedWallet
  try {
    derived = deriveFromMnemonic(mnemonic, network)
  } catch {
    throw new WalletError('Wallet generation failed.', 500)
  }
  const secret: Secret = { mnemonic, privateKey: derived.privateKey }
  const { record } = persistSecret(config, owner, '', secret, { network, address: derived.address, path: derived.path, label: 'Deposit' })
  return toPublic(record)
}

export function importWallet(input: CreateInput & { secret?: unknown; type?: unknown }): { wallet: PublicWallet; secret: Secret } {
  const config = requireConfig()
  const ownerId = normalizeOwner(input.ownerId)
  if (!isSupportedNetwork(input.network)) throw new WalletError('Unsupported network.')
  const passphrase = normalizePassphrase(input.passphrase, config, config.requirePassphrase)
  const label = typeof input.label === 'string' ? input.label.slice(0, 40) : ''
  configureStore(config.storePath, config.persist)
  if (listWallets(ownerId).length >= config.maxPerOwner) {
    throw new WalletError(`Wallet limit reached (${config.maxPerOwner}).`, 429)
  }

  const secretType = input.type === 'privateKey' ? 'privateKey' : 'mnemonic'
  const provided = typeof input.secret === 'string' ? input.secret.trim() : ''
  if (!provided) throw new WalletError('A mnemonic or private key is required.')

  let derived: DerivedWallet
  let secret: Secret
  if (secretType === 'privateKey') {
    try {
      derived = deriveFromPrivateKey(provided, input.network)
    } catch {
      throw new WalletError('Invalid private key.')
    }
    secret = { mnemonic: null, privateKey: derived.privateKey }
  } else {
    if (!isValidMnemonic(provided)) throw new WalletError('Invalid recovery phrase.')
    try {
      derived = deriveFromMnemonic(provided, input.network)
    } catch {
      throw new WalletError('Invalid recovery phrase.')
    }
    secret = { mnemonic: provided, privateKey: derived.privateKey }
  }

  const { record } = persistSecret(config, ownerId, passphrase, secret, { network: input.network, address: derived.address, path: derived.path, label })
  return { wallet: toPublic(record), secret }
}

export function revealWallet(walletId: string, ownerId: unknown, passphraseValue: unknown): { wallet: PublicWallet; secret: Secret } {
  const config = requireConfig()
  const owner = normalizeOwner(ownerId)
  configureStore(config.storePath, config.persist)
  const record = typeof walletId === 'string' ? getWallet(walletId) : undefined
  if (!record || record.ownerId !== owner) throw new WalletError('Wallet not found.', 404)

  const passphrase = typeof passphraseValue === 'string' ? passphraseValue : ''
  if (record.passphraseRequired) {
    if (!passphrase) throw new WalletError('A passphrase is required to reveal this wallet.', 401)
    if (!record.passphraseHash || !verifyPassphrase(passphrase, record.passphraseHash)) {
      throw new WalletError('Invalid passphrase.', 401)
    }
  }

  const key = deriveWalletKey(config.masterKey, owner, record.passphraseRequired ? passphrase : undefined, config.salt)
  let secret: Secret
  try {
    secret = JSON.parse(decrypt(record.ciphertext, key)) as Secret
  } catch {
    throw new WalletError('Unable to decrypt this wallet.', 500)
  }
  return { wallet: toPublic(record), secret }
}

export function listOwnerWallets(ownerId: unknown): PublicWallet[] {
  const config = getWalletConfig()
  const owner = normalizeOwner(ownerId)
  configureStore(config.storePath, config.persist)
  return listWallets(owner).map(toPublic)
}

export function isConfigured(): boolean {
  return getWalletConfig().configured
}
