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

function ipLine(ip?: string): string {
  return ip && ip !== 'unknown' ? `📍 IP : <code>${escapeHTML(ip)}</code>` : ''
}

export async function notifyBet(input: { address: string; amountSol: string; signature: string; cluster: string; ip?: string }): Promise<boolean> {
  const text = [
    `🎲 <b>Mise on-chain (SOL)</b>`,
    ``,
    `👛 Joueur : <code>${escapeHTML(short(input.address, 8, 6))}</code>`,
    `💵 Mise : <b>${escapeHTML(input.amountSol)} SOL</b>`,
    `🌐 Réseau : <b>${escapeHTML(input.cluster)}</b>`,
    `🆔 TX : <code>${escapeHTML(short(input.signature, 10, 8))}</code>`,
    ipLine(input.ip),
  ].filter(Boolean).join('\n')
  return notifyCasino(text)
}
