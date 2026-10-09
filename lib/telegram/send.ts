export function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
}

export function getChatIds(): string[] {
  return String(process.env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
}

export function isAuthorizedChat(chatId: number | string): boolean {
  return getChatIds().includes(String(chatId))
}

export function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type TelegramSendOptions = {
  disable_web_page_preview?: boolean
  disable_notification?: boolean
  reply_markup?: unknown
}

type ApiResponse = { ok?: boolean; error_code?: number; description?: string }

const TELEGRAM_API = 'https://api.telegram.org/bot'

export async function tgSend(text: string, options: TelegramSendOptions = {}): Promise<boolean> {
  const token = getBotToken()
  const chatIds = getChatIds()
  if (!token || !chatIds.length) return false

  const trimmed = text.length > 3900 ? `${text.slice(0, 3900)}\n\n… (tronqué)` : text
  let ok = true
  for (const chatId of chatIds) {
    ok = (await tgSendTo(chatId, trimmed, options)) && ok
  }
  return ok
}

export async function tgSendTo(chatId: string, text: string, options: TelegramSendOptions = {}): Promise<boolean> {
  const token = getBotToken()
  if (!token) return false
  try {
    const resp = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }),
    })
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as Partial<ApiResponse>
      console.error(`[Telegram] sendMessage error: ${err.error_code ?? resp.status} · ${err.description ?? 'unknown'}`)
      return false
    }
    return true
  } catch (error) {
    console.error('[Telegram] sendMessage exception:', error instanceof Error ? error.message : error)
    return false
  }
}

export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  const token = getBotToken()
  if (!token) return
  try {
    await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: true }),
    })
  } catch {
    /* best-effort */
  }
}

export async function setMyCommands(): Promise<void> {
  const token = getBotToken()
  if (!token) return
  const commands = [
    { command: 'start', description: 'Message d’accueil' },
    { command: 'help', description: 'Afficher cette aide' },
    { command: 'chatid', description: 'Identifiant de ce chat' },
    { command: 'ping', description: 'Vérifier que le casino répond' },
    { command: 'house', description: 'Marge maison et multiplicateur' },
    { command: 'deposits', description: 'Adresses de réception des dépôts' },
    { command: 'stats', description: 'État du casino (frais collectés, dépôts)' },
  ]
  try {
    await fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    })
  } catch (error) {
    console.error('[Telegram] setMyCommands error:', error instanceof Error ? error.message : error)
  }
}