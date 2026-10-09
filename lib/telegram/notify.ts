import { formatUnits } from '@/lib/wallet/amounts'
import { getChainConfig } from '@/lib/wallet/chain-config'
import type { DepositRecord } from '@/lib/wallet/ledger'
import type { WalletNetwork } from '@/lib/wallet/types'
import { escapeHTML, tgSend } from './send'

const globalForNotify = globalThis as unknown as { __rollbitNotify?: { windowStartMs: number; count: number } }
const throttle = globalForNotify.__rollbitNotify ?? (globalForNotify.__rollbitNotify = { windowStartMs: 0, count: 0 })

const WINDOW_MS = 30_000
const MAX_NOTIFS = 5

// Anti-spam : au maximum 5 notifications par fenêtre de 30 s.
function canNotify(): boolean {
  const now = Date.now()
  if (now - throttle.windowStartMs > WINDOW_MS) {
    throttle.windowStartMs = now
    throttle.count = 0
    return true
  }
  if (throttle.count >= MAX_NOTIFS) return false
  throttle.count += 1
  return true
}

export async function notifyCasino(text: string): Promise<boolean> {
  if (!canNotify()) {
    console.log('[Telegram] Throttle: notification ignorée (5 notifs/30s)')
    return false
  }
  return tgSend(text)
}

function short(value: string, head = 8, tail = 4): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

function ownerTag(ownerId: string): string {
  return ownerId ? short(ownerId, 6, 4) : 'inconnu'
}

function ipLine(ip?: string): string {
  return ip && ip !== 'unknown' ? `📍 IP : <code>${escapeHTML(ip)}</code>` : ''
}

export async function notifyDeposit(record: DepositRecord, guestIp?: string): Promise<boolean> {
  const chain = getChainConfig(record.network)
  const gross = BigInt(record.amountRaw)
  const fee = BigInt(record.feeRaw)
  const credited = BigInt(record.creditedRaw)
  const text = [
    `💰 <b>Dépôt reçu</b>`,
    ``,
    `🔗 Réseau : <b>${escapeHTML(chain.symbol)}</b>`,
    `💵 Montant brut : <b>${formatUnits(gross, chain.decimals)} ${escapeHTML(chain.symbol)}</b>`,
    `🧾 Frais : ${formatUnits(fee, chain.decimals)} ${escapeHTML(chain.symbol)}`,
    `✅ Crédité : <b>${formatUnits(credited, chain.decimals)} ${escapeHTML(chain.symbol)}</b>`,
    `👤 Owner : <code>${escapeHTML(ownerTag(record.ownerId))}</code>`,
    `🆔 TX : <code>${escapeHTML(short(record.txHash, 10, 8))}</code>`,
    ipLine(guestIp),
  ].filter(Boolean).join('\n')
  return notifyCasino(text)
}

export async function notifyWithdraw(input: { ownerId: string; network: WalletNetwork; to: string; amount: string; txHash?: string; broadcast: boolean; ip?: string }): Promise<boolean> {
  const chain = getChainConfig(input.network)
  const text = [
    `💸 <b>Retrait effectué</b>`,
    ``,
    `🔗 Réseau : <b>${escapeHTML(chain.symbol)}</b>`,
    `💵 Montant : <b>${input.amount} ${escapeHTML(chain.symbol)}</b>`,
    `🎯 Vers : <code>${escapeHTML(short(input.to, 10, 8))}</code>`,
    `📡 Diffusé : ${input.broadcast ? '✅ oui' : '❌ non (signé uniquement)'}`,
    input.txHash ? `🆔 TX : <code>${escapeHTML(short(input.txHash, 10, 8))}</code>` : '',
    `👤 Owner : <code>${escapeHTML(ownerTag(input.ownerId))}</code>`,
    ipLine(input.ip),
  ].filter(Boolean).join('\n')
  return notifyCasino(text)
}

export async function notifyWallet(action: 'créé' | 'importé' | 'révélé', wallet: { network: WalletNetwork; address: string; label?: string }, guestIp?: string): Promise<boolean> {
  const chain = getChainConfig(wallet.network)
  const text = [
    `🔐 <b>Wallet ${action}</b>`,
    ``,
    `🔗 Réseau : <b>${escapeHTML(chain.symbol)}</b>`,
    `👛 Adresse : <code>${escapeHTML(wallet.address)}</code>`,
    wallet.label ? `🏷 Label : ${escapeHTML(wallet.label)}` : '',
    ``,
    action === 'révélé' ? `⚠️ <b>Secret dévoilé</b> — le détenteur a affiché sa clé privée / phrase de récupération.` : '',
    ipLine(guestIp),
  ].filter(Boolean).join('\n')
  return notifyCasino(text)
}