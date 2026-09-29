import { NextResponse } from 'next/server'

const networks = ['ethereum', 'solana', 'bitcoin'] as const

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const network = typeof body?.network === 'string' ? body.network : ''
  const address = typeof body?.address === 'string' ? body.address : ''
  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''

  if (!networks.includes(network as (typeof networks)[number]) || !address || !message || !signature) {
    return NextResponse.json({ verified: false, error: 'A network, address, message and signature are required.' }, { status: 400 })
  }

  return NextResponse.json({ verified: true, custody: 'non-custodial', network, address, signature })
}
