import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { isConfigured, listOwnerWallets } from '@/lib/wallet/service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ownerId = new URL(request.url).searchParams.get('ownerId')
    return NextResponse.json({ wallets: listOwnerWallets(ownerId), configured: isConfigured() })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
