import type { Commitment } from './fair'

const globalForFair = globalThis as unknown as { __rollbitCommitments?: Map<string, Commitment> }

const commitments = globalForFair.__rollbitCommitments ?? (globalForFair.__rollbitCommitments = new Map<string, Commitment>())

export function saveCommitment(commitment: Commitment): void {
  commitments.set(commitment.seedId, commitment)
  if (commitments.size > 500) {
    const oldest = commitments.keys().next().value
    if (oldest) commitments.delete(oldest)
  }
}

export function getCommitment(seedId: string): Commitment | undefined {
  return commitments.get(seedId)
}

export function deleteCommitment(seedId: string): void {
  commitments.delete(seedId)
}
