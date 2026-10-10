import { NextResponse } from 'next/server'
import { getHouseConfig } from '@/lib/house'
import { getSolanaConfig } from '@/lib/solana/config'
import { escapeHTML, getBotToken, isAuthorizedChat, setMyCommands, tgSendTo } from '@/lib/telegram/send'

export const runtime = 'nodejs'

type TelegramUpdate = {
  message?: { chat?: { id?: number }; text?: string }
}

const globalForTelegram = globalThis as unknown as { __rollbitTelegramRegistered?: boolean }

function getSiteBaseUrl(): string {
  return (
    process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).replace(/\/+$/, '')
}

export async function registerTelegramWebhook(): Promise<boolean> {
  const token = getBotToken()
  const base = getSiteBaseUrl()
  if (!token || !base) return false
  const webhookUrl = `${base}/api/telegram`
  await setMyCommands()
  const params = new URLSearchParams({ url: webhookUrl })
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (secret) params.set('secret_token', secret)
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`, { signal: AbortSignal.timeout(10_000) })
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean }
    if (data.ok) {
      console.log('[Telegram] Webhook registered:', webhookUrl)
      return true
    }
    console.error('[Telegram] Webhook registration failed (token masqué pour sécurité)')
    return false
  } catch (error) {
    console.error('[Telegram] Webhook registration error:', error instanceof Error ? error.message : error)
    return false
  }
}

function buildHelp(): string {
  return [
    `🎰 <b>Live Roll Casino Bot</b>`,
    ``,
    `📋 Commandes disponibles :`,
    `<code>/start</code> : message d’accueil`,
    `<code>/help</code> : afficher cette aide`,
    `<code>/chatid</code> : identifiant de ce chat`,
    `<code>/ping</code> : vérifier que le casino répond`,
    `<code>/house</code> : marge maison et multiplicateur`,
    `<code>/treasury</code> : adresse Solana de réception`,
    `<code>/stats</code> : état du casino (réseau, trésorerie)`,
    `<code>/ip</code> : IP publique du serveur`,
    ``,
    `<i>Les mises sont signées côté joueur (Phantom). La maison ne détient jamais les clés.</i>`,
  ].join('\n')
}

function buildHouseMessage(): string {
  const config = getHouseConfig()
  return [
    `🏠 <b>Marge maison</b>`,
    ``,
    `📐 Edge : <b>${config.houseEdgeBps} bps</b> (${(config.houseEdgeBps / 100).toFixed(2)} %)`,
    `🎯 Facteur de gain : <b>×${config.payoutFactor.toFixed(4)}</b>`,
  ].join('\n')
}

function buildTreasuryMessage(): string {
  const config = getSolanaConfig()
  const address = config.configured
    ? `<code>${escapeHTML(config.treasuryAddress)}</code>\n<a href="${config.explorerAddressUrl}${config.treasuryAddress}${config.explorerQuery}">Voir sur Solscan</a>`
    : `<i>non configurée (SOLANA_TREASURY_ADDRESS)</i>`
  return [
    `📥 <b>Trésorerie Solana</b>`,
    ``,
    `🌐 Réseau : <b>${escapeHTML(config.cluster)}</b>`,
    `👛 Adresse : ${address}`,
  ].join('\n')
}

function buildStatsMessage(): string {
  const house = getHouseConfig()
  const solana = getSolanaConfig()
  return [
    `📊 <b>État du casino</b>`,
    ``,
    `🌐 Réseau : <b>Solana · ${escapeHTML(solana.cluster)}</b>`,
    `📐 Marge maison : <b>${house.houseEdgeBps} bps</b> (${(house.houseEdgeBps / 100).toFixed(2)} %)`,
    `🧾 Trésorerie : ${solana.configured ? `<code>${escapeHTML(solana.treasuryAddress)}</code>` : '<i>non configurée</i>'}`,
    `📡 Diffusion on-chain : <b>${solana.sendEnabled ? 'activée' : 'désactivée'}</b>`,
  ].join('\n')
}

const PUBLIC_IP_SERVICES = ['https://ipinfo.io/ip', 'https://icanhazip.com', 'https://api.ipify.org', 'https://ifconfig.me']

async function getPublicIps(): Promise<string[]> {
  const jobs = PUBLIC_IP_SERVICES.map(async service => {
    try {
      const resp = await fetch(service, { signal: AbortSignal.timeout(6_000) })
      if (!resp.ok) return null
      const ip = (await resp.text()).trim()
      return ip ? `${escapeHTML(ip)} <i>(${service})</i>` : null
    } catch {
      return null
    }
  })
  const results = await Promise.all(jobs)
  return results.filter((entry): entry is string => Boolean(entry))
}

async function handleCommand(chatId: number, rawCommand: string): Promise<void> {
  const command = rawCommand.trim()

  if (command.startsWith('/chatid')) {
    await tgSendTo(String(chatId), `📡 Chat ID : <code>${escapeHTML(String(chatId))}</code>`)
    return
  }

  if (command.startsWith('/ping')) {
    const base = getSiteBaseUrl()
    if (!base) {
      await tgSendTo(String(chatId), `⚠️ URL du site non configurée (TELEGRAM_WEBHOOK_URL / VERCEL_PROJECT_PRODUCTION_URL).`)
      return
    }
    const startedAt = Date.now()
    try {
      const resp = await fetch(`${base}/api/house`, { signal: AbortSignal.timeout(8_000) })
      const latency = Date.now() - startedAt
      await tgSendTo(String(chatId), `🏓 <b>Ping</b>\n\nRéponse du casino : <b>OK</b>\n⏱ Latence : <b>${latency} ms</b>\n📶 HTTP <b>${resp.status}</b>`)
    } catch {
      await tgSendTo(String(chatId), `🏓 <b>Ping</b>\n\n❌ Le casino ne répond pas.`)
    }
    return
  }

  if (command.startsWith('/house')) {
    await tgSendTo(String(chatId), buildHouseMessage())
    return
  }

  if (command.startsWith('/treasury') || command.startsWith('/deposits')) {
    await tgSendTo(String(chatId), buildTreasuryMessage())
    return
  }

  if (command.startsWith('/ip')) {
    const ips = await getPublicIps()
    if (ips.length === 0) {
      await tgSendTo(String(chatId), `🌐 <b>IP publique</b>\n\n❌ Impossible d’interroger les services IP.`)
      return
    }
    await tgSendTo(String(chatId), [`🌐 <b>IP publique du serveur</b>`, ``, ...ips, ``, `<i>IP vue par les services externes — celle qui apparaît dans les notifications du bot.</i>`].join('\n'))
    return
  }

  if (command.startsWith('/stats')) {
    await tgSendTo(String(chatId), buildStatsMessage())
    return
  }

  if (command.startsWith('/start') || command.startsWith('/help')) {
    await tgSendTo(String(chatId), buildHelp())
    return
  }

  await tgSendTo(String(chatId), `❌ Commande inconnue. Tape /help pour la liste des commandes.`)
}

export async function GET() {
  const registered = await registerTelegramWebhook()
  if (registered) globalForTelegram.__rollbitTelegramRegistered = true
  return NextResponse.json({ ok: registered, message: registered ? 'Webhook Telegram enregistré.' : 'Webhook non enregistré (BOT_TOKEN ou URL manquants).' })
}

export async function POST(request: Request) {
  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  const chatId = update.message?.chat?.id
  const text = update.message?.text?.trim()

  if (typeof chatId !== 'number') return NextResponse.json({ ok: true })

  if (!isAuthorizedChat(chatId)) {
    await tgSendTo(String(chatId), '⛔ Accès refusé.')
    return NextResponse.json({ ok: true })
  }

  if (text) await handleCommand(chatId, text)

  if (!globalForTelegram.__rollbitTelegramRegistered) {
    globalForTelegram.__rollbitTelegramRegistered = await registerTelegramWebhook()
  }

  return NextResponse.json({ ok: true })
}
