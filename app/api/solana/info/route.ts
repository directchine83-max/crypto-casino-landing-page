import { NextResponse } from 'next/server'
import { getSolanaConfig } from '@/lib/solana/config'

export const runtime = 'nodejs'

export async function GET() {
  const config = getSolanaConfig()
  return NextResponse.json({
    configured: config.configured,
    sendEnabled: config.sendEnabled,
    treasuryAddress: config.treasuryAddress,
    cluster: config.cluster,
    symbol: config.symbol,
    explorerAddressUrl: config.explorerAddressUrl,
    decimals: config.decimals,
  })
}
