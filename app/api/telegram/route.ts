import { NextResponse } from 'next/server'
import { getHouseConfig } from '@/lib/house'
import { CHAIN_NETWORKS, getChainConfig } from '@/lib/wallet/chain-config'
import { countDeposits, getFeesCollected } from '@/lib/wallet/ledger'
import { getTreasuryAddresses } from '@/lib/wallet/treasury'
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
    `🎰 <b>Rollbit Casino Bot</b>`,
    ``,
    `📋 Commandes disponibles :`,
    `<code>/start</code> : message d’accueil`,
    `<code>/help</code> : afficher cette aide`,
    `<code>/chatid</code> : identifiant de ce chat`,
    `<code>/ping</code> : vérifier que le casino répond`,
    `<code>/house</code> : marge maison et multiplicateur`,
    `<code>/deposits</code> : adresses de réception des dépôts`,
    `<code>/stats</code> : frais collectés et état du casino`,
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

function buildDepositsMessage(): string {
  const entries = getTreasuryAddresses()
  const lines = entries.map(entry => {
    const label = entry.configured
      ? `<code>${escapeHTML(entry.address)}</code> · <a href="${entry.explorerUrl}">explorer</a>`
      : `<i>non configuré</i>`
    return `• <b>${escapeHTML(entry.symbol)}</b> — ${label}`
  })
  return [
    `📥 <b>Adresses de dépôt</b>`,
    ``,
    ...lines,
    ``,
    `<i>Envoyez vos fonds sur ces adresses publiques ; votre solde est crédité après confirmation.</i>`,
  ].join('\n')
}

function buildStatsMessage(): string {
  const config = getHouseConfig()
  const fees = CHAIN_NETWORKS.map(network => {
    const chain = getChainConfig(network)
    const fee = getFeesCollected(network)
    const feeText = (Number(fee) / 10 ** chain.decimals).toLocaleString('fr-FR', { maximumFractionDigits: chain.decimals })
    return `• <b>${escapeHTML(chain.symbol)}</b> : <b>${feeText}</b>${chain.configured ? '' : ' <i>(trésorerie non configurée)</i>'}`
  })
  return [
    `📊 <b>État du casino</b>`,
    ``,
    `🪙 Dépôts enregistrés : <b>${countDeposits()}</b>`,
    `📐 Marge maison : <b>${config.houseEdgeBps} bps</b> (${(config.houseEdgeBps / 100).toFixed(2)} %)`,
    `🧾 Frais collectés :`,
    ...fees,
  ].join('\n')
}

async function handleCommand(chatId: number, rawCommand: string): Promise<void> {
  const command = rawCommand.trim()
  const arg = command.replace(/^\/(\w+)\s*/i, '').trim()

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

  if (command.startsWith('/deposits')) {
    await tgSendTo(String(chatId), buildDepositsMessage())
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

  void arg
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