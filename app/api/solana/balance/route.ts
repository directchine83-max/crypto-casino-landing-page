import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getConnection } from '@/lib/solana/connection'
import { getSolanaConfig } from '@/lib/solana/config'
import { formatSol } from '@/lib/solana/amounts'
import { isValidSolanaAddress } from '@/lib/solana/address'
import { SolanaError, solanaErrorResponse } from '@/lib/solana/errors'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''
    if (!isValidSolanaAddress(address)) throw new SolanaError('A valid Solana address is required.', 400)

    const config = getSolanaConfig()
    const lamports = BigInt(await getConnection().getBalance(new PublicKey(address), config.commitment))
    return NextResponse.json({ address, lamports: lamports.toString(), sol: formatSol(lamports), symbol: config.symbol, cluster: config.cluster })
  } catch (error) {
    return solanaErrorResponse(error)
  }
}
