import { PublicKey } from '@solana/web3.js'

export function isValidSolanaAddress(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const key = new PublicKey(trimmed)
    return key.toBase58() === trimmed
  } catch {
    return false
  }
}

export function toPublicKey(value: string): PublicKey {
  return new PublicKey(value.trim())
}
