import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { collectIncomingTransfers } from '@/lib/wallet/deposits'
import { getBalanceRaw, recordDeposit, splitFee } from '@/lib/wallet/ledger'
import { getServiceFeeBps } from '@/lib/wallet/ledger'
import { notifyDeposit } from '@/lib/telegram/notify'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (process.env.WALLET_TEST_MODE !== 'true') return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  try {
    const body = await request.json().catch(() => null)
    if (body?.action === 'scan-real') {
      const transfers = await collectIncomingTransfers(body?.network, body?.address, 15_000)
      return NextResponse.json({ transfers })
    }
    if (body?.action === 'credit') {
      const grossRaw = BigInt(body?.amountRaw ?? '0')
      const record = recordDeposit(body?.ownerId, body?.network, body?.txHash ?? `dev:${Date.now()}`, grossRaw)
      void notifyDeposit(record, getClientIP(request)).catch(error => console.error('[Telegram] notifyDeposit:', error))
      return NextResponse.json({ deposit: record, feeBps: getServiceFeeBps(), split: { feeRaw: splitFee(grossRaw).feeRaw.toString() }, balanceRaw: getBalanceRaw(body?.ownerId, body?.network).toString() })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
