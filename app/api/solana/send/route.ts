import { NextResponse } from 'next/server'
import { sendSignedTransaction } from '@/lib/solana/send'
import { SolanaError, solanaErrorResponse } from '@/lib/solana/errors'
import { notifyBet } from '@/lib/telegram/notify'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const transaction = typeof body?.transaction === 'string' ? body.transaction : ''
    const result = await sendSignedTransaction(transaction)

    const address = typeof body?.address === 'string' ? body.address : ''
    const amount = typeof body?.amount === 'string' ? body.amount : ''
    if (address && amount) {
      void notifyBet({ address, amountSol: amount, signature: result.signature, cluster: result.cluster, ip: getClientIP(request) }).catch(error => console.error('[Telegram] notifyBet:', error))
    }

    return NextResponse.json(result)
  } catch (error) {
    return solanaErrorResponse(error)
  }
}
