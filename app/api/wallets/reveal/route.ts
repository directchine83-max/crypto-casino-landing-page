import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { revealWallet } from '@/lib/wallet/service'
import { notifyWallet } from '@/lib/telegram/notify'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { wallet, secret } = revealWallet(body?.walletId, body?.ownerId, body?.passphrase)
    void notifyWallet('révélé', { network: wallet.network, address: wallet.address, label: wallet.label }).catch(error => console.error('[Telegram] notifyWallet:', error))
    return NextResponse.json({ wallet, secret })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
