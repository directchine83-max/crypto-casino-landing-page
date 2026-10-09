import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'

export type Commitment = {
  seedId: string
  serverSeed: string
  serverSeedHash: string
  createdAt: number
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function newServerSeed(): string {
  return randomBytes(32).toString('hex')
}

export function createCommitment(): Commitment {
  const serverSeed = newServerSeed()
  return { seedId: randomUUID(), serverSeed, serverSeedHash: sha256Hex(serverSeed), createdAt: Date.now() }
}

export function deriveRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const digest = createHmac('sha256', Buffer.from(serverSeed, 'hex')).update(`${clientSeed}:${nonce}`).digest('hex')
  return (Number.parseInt(digest.slice(0, 8), 16) % 6) + 1
}
