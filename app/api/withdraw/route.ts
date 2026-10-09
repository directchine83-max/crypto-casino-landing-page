import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { withdraw } from '@/lib/wallet/payments'
import { notifyWithdraw } from '@/lib/telegram/notify'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const result = await withdraw({ ownerId: body?.ownerId, network: body?.network, to: body?.to, amount: body?.amount, passphrase: body?.passphrase })
    void notifyWithdraw({
      ownerId: body?.ownerId,
      network: body?.network,
      to: body?.to,
      amount: body?.amount,
      txHash: result.tx.hash,
      broadcast: result.broadcast,
      ip: getClientIP(request),
    }).catch(error => console.error('[Telegram] notifyWithdraw:', error))
    return NextResponse.json(result)
  } catch (error) {
    return walletErrorResponse(error)
  }
}
