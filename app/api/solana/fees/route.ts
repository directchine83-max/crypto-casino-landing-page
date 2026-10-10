import { NextResponse } from 'next/server'
import { estimateFee } from '@/lib/solana/transaction'
import { parseUnits } from '@/lib/solana/amounts'
import { SOLANA_DECIMALS } from '@/lib/solana/config'
import { SolanaError, solanaErrorResponse } from '@/lib/solana/errors'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const from = params.get('address')?.trim() || undefined
    const amountParam = params.get('amount')?.trim() || ''

    let amountLamports: bigint | undefined
    if (amountParam) {
      try {
        amountLamports = parseUnits(amountParam, SOLANA_DECIMALS)
      } catch {
        throw new SolanaError('Invalid amount.', 400)
      }
    }

    return NextResponse.json(await estimateFee({ from, amountLamports }))
  } catch (error) {
    return solanaErrorResponse(error)
  }
}
