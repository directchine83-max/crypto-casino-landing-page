import { NextResponse } from 'next/server'

export class SolanaError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SolanaError'
    this.status = status
  }
}

export function solanaErrorResponse(error: unknown): NextResponse {
  if (error instanceof SolanaError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  const message = error instanceof Error ? error.message : 'Unexpected Solana error.'
  console.error('[Solana]', message)
  return NextResponse.json({ error: message }, { status: 502 })
}
