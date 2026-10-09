import { NextResponse } from 'next/server'
import { walletErrorResponse } from '@/lib/wallet/http'
import { createWallet } from '@/lib/wallet/service'
import { notifyWallet } from '@/lib/telegram/notify'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const { wallet, secret } = createWallet({
      network: body?.network,
      ownerId: body?.ownerId,
      passphrase: body?.passphrase,
      label: body?.label,
    })
    void notifyWallet('créé', { network: wallet.network, address: wallet.address, label: wallet.label }).catch(error => console.error('[Telegram] notifyWallet:', error))
    return NextResponse.json(
      {
        wallet,
        secret,
        warning: 'Save this recovery phrase offline. It is shown only once; without it (and your passphrase) the wallet cannot be recovered.',
      },
      { status: 201 },
    )
  } catch (error) {
    return walletErrorResponse(error)
  }
}
