import { NextResponse } from 'next/server'
import { WalletError } from './service'

export function walletErrorResponse(error: unknown): NextResponse {
  if (error instanceof WalletError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: 'Unexpected wallet error.' }, { status: 500 })
}
