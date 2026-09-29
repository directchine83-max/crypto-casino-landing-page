import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    networks: [
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', provider: 'ethereum' },
      { id: 'solana', name: 'Solana', symbol: 'SOL', provider: 'solana' },
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', provider: 'unisat' },
    ],
    custody: 'non-custodial',
    message: 'Connect a browser wallet to continue.',
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const address = typeof body?.address === 'string' ? body.address : ''
  const network = typeof body?.network === 'string' ? body.network : ''

  if (!address || !['ethereum', 'solana', 'bitcoin'].includes(network)) {
    return NextResponse.json({ error: 'A valid wallet address and network are required.' }, { status: 400 })
  }

  return NextResponse.json({ connected: true, address, network, custody: 'non-custodial' })
}
