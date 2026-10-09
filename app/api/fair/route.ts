import { NextResponse } from 'next/server'
import { createCommitment, deriveRoll, sha256Hex } from '@/lib/fair'
import { deleteCommitment, getCommitment, saveCommitment } from '@/lib/fair-store'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'commit') {
    const commitment = createCommitment()
    saveCommitment(commitment)
    return NextResponse.json({ seedId: commitment.seedId, serverSeedHash: commitment.serverSeedHash }, { status: 201 })
  }

  if (action === 'roll') {
    const seedId = typeof body?.seedId === 'string' ? body.seedId : ''
    const clientSeed = typeof body?.clientSeed === 'string' ? body.clientSeed : ''
    const nonce = Number(body?.nonce)
    const commitment = seedId ? getCommitment(seedId) : undefined
    if (!commitment || !clientSeed || !Number.isInteger(nonce) || nonce < 0) {
      return NextResponse.json({ error: 'Invalid roll request.' }, { status: 400 })
    }
    const value = deriveRoll(commitment.serverSeed, clientSeed, nonce)
    return NextResponse.json({ value, seedId, serverSeedHash: commitment.serverSeedHash, clientSeed, nonce })
  }

  if (action === 'reveal') {
    const seedId = typeof body?.seedId === 'string' ? body.seedId : ''
    const commitment = seedId ? getCommitment(seedId) : undefined
    if (!commitment) {
      return NextResponse.json({ error: 'Unknown commitment.' }, { status: 404 })
    }
    deleteCommitment(seedId)
    return NextResponse.json({ serverSeed: commitment.serverSeed, serverSeedHash: commitment.serverSeedHash })
  }

  if (action === 'verify') {
    const serverSeed = typeof body?.serverSeed === 'string' ? body.serverSeed : ''
    const serverSeedHash = typeof body?.serverSeedHash === 'string' ? body.serverSeedHash : ''
    const clientSeed = typeof body?.clientSeed === 'string' ? body.clientSeed : ''
    const nonce = Number(body?.nonce)
    const value = Number(body?.value)
    if (!serverSeed || !clientSeed || !Number.isInteger(nonce) || !Number.isInteger(value)) {
      return NextResponse.json({ valid: false, error: 'Missing verification inputs.' }, { status: 400 })
    }
    const computedHash = sha256Hex(serverSeed)
    const hashMatches = !serverSeedHash || computedHash === serverSeedHash
    const derived = deriveRoll(serverSeed, clientSeed, nonce)
    return NextResponse.json({ valid: hashMatches && derived === value, serverSeedHash: computedHash, derived })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
