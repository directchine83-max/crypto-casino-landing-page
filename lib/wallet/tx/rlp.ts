import { concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export type RlpInput = Uint8Array | string | number | bigint | null | undefined | RlpInput[]

function toBytes(input: RlpInput): Uint8Array {
  if (input instanceof Uint8Array) return input
  if (typeof input === 'string') return utf8ToBytes(input)
  if (typeof input === 'bigint' || typeof input === 'number') {
    const value = typeof input === 'bigint' ? input : BigInt(input)
    if (value === 0n) return new Uint8Array()
    let hex = value.toString(16)
    if (hex.length % 2) hex = `0${hex}`
    return hexToBytes(hex)
  }
  return new Uint8Array()
}

function encodeLength(length: number, offset: number): Uint8Array {
  if (length < 56) return Uint8Array.of(offset + length)
  let hex = length.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  const lengthBytes = hexToBytes(hex)
  return concatBytes(Uint8Array.of(offset + 55 + lengthBytes.length), lengthBytes)
}

export function rlpEncode(input: RlpInput): Uint8Array {
  if (Array.isArray(input)) {
    const body = concatBytes(...input.map(item => rlpEncode(item)))
    return concatBytes(encodeLength(body.length, 0xc0), body)
  }
  const bytes = toBytes(input)
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes
  return concatBytes(encodeLength(bytes.length, 0x80), bytes)
}
