import { NextResponse } from 'next/server'
import { buildUnsignedTransfer } from '@/lib/solana/transaction'
import { parseUnits } from '@/lib/solana/amounts'
import { SOLANA_DECIMALS, getSolanaConfig } from '@/lib/solana/config'
import { isValidSolanaAddress } from '@/lib/solana/address'
import { SolanaError, solanaErrorResponse } from '@/lib/solana/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const config = getSolanaConfig()
    if (!config.sendEnabled) throw new SolanaError('On-chain sending is disabled.', 503)

    const body = await request.json().catch(() => null)
    const from = typeof body?.from === 'string' ? body.from.trim() : ''
    if (!isValidSolanaAddress(from)) throw new SolanaError('Connect a valid Solana wallet first.', 400)

    const amount = typeof body?.amount === 'string' ? body.amount : String(body?.amount ?? '')
    let amountLamports: bigint
    try {
      amountLamports = parseUnits(amount, SOLANA_DECIMALS)
    } catch {
      throw new SolanaError('Invalid amount.', 400)
    }

    const to = typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : undefined
    return NextResponse.json(await buildUnsignedTransfer({ from, to, amountLamports }))
  } catch (error) {
    return solanaErrorResponse(error)
  }
}
