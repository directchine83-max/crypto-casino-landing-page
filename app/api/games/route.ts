import { NextResponse } from 'next/server'

type Game = {
  value: number
  status: 'Gagné' | 'Perdu'
  amount: string
  tone: 'win' | 'loss'
  player: string
  createdAt: number
}

const globalForGames = globalThis as unknown as { __rollbitGames?: Game[] }

function seedGames(): Game[] {
  const now = Date.now()
  return [
    { value: 6, status: 'Gagné', amount: '+0.024 ETH', tone: 'win', player: '0x71...8A2F', createdAt: now - 62_000 },
    { value: 2, status: 'Perdu', amount: '-0.010 ETH', tone: 'loss', player: '0xA4...19D0', createdAt: now - 128_000 },
    { value: 5, status: 'Gagné', amount: '+0.018 ETH', tone: 'win', player: '0xC8...0B44', createdAt: now - 191_000 },
    { value: 3, status: 'Perdu', amount: '-0.005 ETH', tone: 'loss', player: '0xF2...7C19', createdAt: now - 254_000 },
  ]
}

const games: Game[] = globalForGames.__rollbitGames ?? (globalForGames.__rollbitGames = seedGames())

export async function GET() {
  return NextResponse.json({ games })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const value = Number(body?.value)
  const createdAt = Number(body?.createdAt)
  if (!Number.isInteger(value) || value < 1 || value > 6 || !['Gagné', 'Perdu'].includes(body?.status) || !['win', 'loss'].includes(body?.tone) || typeof body?.amount !== 'string' || typeof body?.player !== 'string' || !Number.isFinite(createdAt)) {
    return NextResponse.json({ error: 'Invalid game record.' }, { status: 400 })
  }

  const game: Game = { value, status: body.status, amount: body.amount, tone: body.tone, player: body.player, createdAt }
  games.unshift(game)
  games.splice(50)
  return NextResponse.json({ saved: true, game }, { status: 201 })
}
