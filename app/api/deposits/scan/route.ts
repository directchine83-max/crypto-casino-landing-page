import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { scanDeposits } from '@/lib/wallet/payments'
import { notifyDeposit } from '@/lib/telegram/notify'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const result = await scanDeposits(body?.ownerId, body?.network)
    for (const record of result.credited) {
      void notifyDeposit(record, getClientIP(request)).catch(error => console.error('[Telegram] notifyDeposit:', error))
    }
    return NextResponse.json(result)
  } catch (error) {
    return walletErrorResponse(error)
  }
}
