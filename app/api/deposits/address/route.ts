import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { getDepositAddress } from '@/lib/wallet/payments'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    return NextResponse.json(getDepositAddress(body?.ownerId, body?.network))
  } catch (error) {
    return walletErrorResponse(error)
  }
}
