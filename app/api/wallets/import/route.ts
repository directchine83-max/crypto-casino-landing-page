import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { importWallet } from '@/lib/wallet/service'
import { notifyWallet } from '@/lib/telegram/notify'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { wallet, secret } = importWallet({
      network: body?.network,
      ownerId: body?.ownerId,
      passphrase: body?.passphrase,
      label: body?.label,
      secret: body?.secret,
      type: body?.type,
    })
    void notifyWallet('importé', { network: wallet.network, address: wallet.address, label: wallet.label }).catch(error => console.error('[Telegram] notifyWallet:', error))
    return NextResponse.json({ wallet, secret, imported: true }, { status: 201 })
  } catch (error) {
    return walletErrorResponse(error)
  }
}
