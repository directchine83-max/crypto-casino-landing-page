import { sha256 } from '@noble/hashes/sha2.js'
import { concatBytes } from '@noble/hashes/utils.js'

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) result = (result << 8n) | BigInt(byte)
  return result
}

export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length)
  let rest = value
  for (let index = length - 1; index >= 0; index -= 1) {
    out[index] = Number(rest & 0xffn)
    rest >>= 8n
  }
  return out
}

export function u32le(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

export function u64le(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value, true)
  return bytes
}

/** Bitcoin CompactSize (varint) encoding. */
export function varint(value: number): Uint8Array {
  if (value < 0xfd) return Uint8Array.of(value)
  if (value <= 0xffff) return concatBytes(Uint8Array.of(0xfd), u32le(value).subarray(0, 2))
  if (value <= 0xffffffff) return concatBytes(Uint8Array.of(0xfe), u32le(value))
  return concatBytes(Uint8Array.of(0xff), u64le(BigInt(value)))
}

/** Solana compact-u16 ("shortvec") encoding. */
export function shortVec(value: number): Uint8Array {
  const out: number[] = []
  let rest = value
  do {
    let byte = rest & 0x7f
    rest >>= 7
    if (rest > 0) byte |= 0x80
    out.push(byte)
  } while (rest > 0)
  return Uint8Array.from(out)
}

export function doubleSha256(bytes: Uint8Array): Uint8Array {
  return sha256(sha256(bytes))
}
