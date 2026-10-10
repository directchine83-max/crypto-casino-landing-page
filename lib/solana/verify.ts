import { ed25519 } from '@noble/curves/ed25519.js'
import { base58 } from '@scure/base'
import { toPublicKey } from './address'
import { SolanaError } from './errors'

function decodeSignature(value: string): Uint8Array {
  const trimmed = value.trim()
  if (!trimmed) throw new SolanaError('Missing signature.', 400)

  try {
    const bytes = new Uint8Array(Buffer.from(trimmed, 'base64'))
    if (bytes.length === 64) return bytes
  } catch { /* try next encoding */ }

  try {
    const bytes = base58.decode(trimmed)
    if (bytes.length === 64) return bytes
  } catch { /* try next encoding */ }

  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return Uint8Array.from(trimmed.match(/.{2}/g)!.map(byte => Number.parseInt(byte, 16)))
  }

  throw new SolanaError('Invalid signature encoding (expected base64, base58 or hex).', 400)
}

export function verifyMessageSignature(address: string, message: string, signature: string): boolean {
  let publicKey: Uint8Array
  try {
    publicKey = toPublicKey(address).toBytes()
  } catch {
    throw new SolanaError('Invalid wallet address.', 400)
  }
  const sig = decodeSignature(signature)
  return ed25519.verify(sig, new TextEncoder().encode(message), publicKey)
}
