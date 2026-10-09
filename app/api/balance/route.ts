import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { getBalances } from '@/lib/wallet/payments'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ownerId = new URL(request.url).searchParams.get('ownerId')
    return NextResponse.json({ balances: getBalances(ownerId ?? '') })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
