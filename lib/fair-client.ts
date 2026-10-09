function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? `0${hex}` : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export function randomClientSeed(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

export async function deriveRoll(serverSeed: string, clientSeed: string, nonce: number): Promise<number> {
  const key = await crypto.subtle.importKey('raw', hexToBytes(serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${clientSeed}:${nonce}`))
  const digest = bytesToHex(new Uint8Array(signature))
  return (Number.parseInt(digest.slice(0, 8), 16) % 6) + 1
}
