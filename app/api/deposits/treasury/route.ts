import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { getTreasuryAddresses } from '@/lib/wallet/treasury'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const addresses = getTreasuryAddresses()
    return NextResponse.json({ addresses, configured: addresses.some(entry => entry.configured) })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
