import { NextResponse } from 'next/server'

type Game = {
  value: number
  status: 'Gagné' | 'Perdu'
  amount: string
  tone: 'win' | 'loss'
  player: string
  createdAt: number
}

const games: Game[] = []

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
