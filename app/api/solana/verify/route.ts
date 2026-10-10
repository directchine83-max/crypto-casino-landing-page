import { NextResponse } from 'next/server'
import { verifyMessageSignature } from '@/lib/solana/verify'
import { SolanaError, solanaErrorResponse } from '@/lib/solana/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const address = typeof body?.address === 'string' ? body.address.trim() : ''
    const message = typeof body?.message === 'string' ? body.message : ''
    const signature = typeof body?.signature === 'string' ? body.signature : ''
    if (!address || !message || !signature) throw new SolanaError('address, message and signature are required.', 400)

    return NextResponse.json({ verified: verifyMessageSignature(address, message, signature) })
  } catch (error) {
    return solanaErrorResponse(error)
  }
}
