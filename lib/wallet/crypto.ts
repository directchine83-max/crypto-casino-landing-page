import { createCipheriv, createDecipheriv, hkdfSync, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const VERSION_BYTE = 0x02
const PBKDF2_ITERATIONS = 210_000

export const DEFAULT_KEY_SALT = 'rollbit-wallet-v1'

export function isValidMasterKey(key: string | undefined | null): key is string {
  return typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key)
}

function hkdf32(inputKeyMaterial: Uint8Array, salt: string, info: string): Buffer {
  const derived = hkdfSync('sha256', Buffer.from(inputKeyMaterial), Buffer.from(salt, 'utf-8'), Buffer.from(info, 'utf-8'), KEY_LENGTH)
  return Buffer.from(derived)
}

export function deriveOwnerKey(masterKey: string, ownerId: string, salt: string = DEFAULT_KEY_SALT): Buffer {
  return hkdf32(Buffer.from(masterKey, 'hex'), salt, `owner:${ownerId}`)
}

export function deriveWalletKey(masterKey: string, ownerId: string, passphrase: string | undefined, salt: string = DEFAULT_KEY_SALT): Buffer {
  const ownerKey = deriveOwnerKey(masterKey, ownerId, salt)
  if (!passphrase) return ownerKey
  return hkdf32(ownerKey, salt, `passphrase:${ownerId}:${passphrase}`)
}

export function encrypt(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from([VERSION_BYTE]), iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string, key: Uint8Array): string {
  const data = Buffer.from(ciphertext, 'base64')
  if (data.length === 0 || data[0] !== VERSION_BYTE) throw new Error('Unsupported ciphertext format')
  const iv = data.subarray(1, 1 + IV_LENGTH)
  const tag = data.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(1 + IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha512')
  return Buffer.concat([salt, hash]).toString('base64')
}

export function verifyPassphrase(passphrase: string, stored: string): boolean {
  try {
    const data = Buffer.from(stored, 'base64')
    const salt = data.subarray(0, 16)
    const expected = data.subarray(16)
    const hash = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha512')
    return hash.length === expected.length && timingSafeEqual(hash, expected)
  } catch {
    return false
  }
}
