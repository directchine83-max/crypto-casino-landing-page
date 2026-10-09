import { NextResponse } from 'next/server'
import { notifyCasino } from '@/lib/telegram/notify'
import { escapeHTML } from '@/lib/telegram/send'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MONETAG_ENABLED === 'true'
}

type AdsState = { total: number; today: number; day: string; impressions: { ip: string; source: string; at: number }[] }

const globalForAds = globalThis as unknown as { __rollbitAds?: AdsState }
const state: AdsState = globalForAds.__rollbitAds ?? (globalForAds.__rollbitAds = { total: 0, today: 0, day: new Date().toISOString().slice(0, 10), impressions: [] })

const rateLimits = new Map<string, number[]>()
const RATE_LIMIT_PER_MIN = 10
const DEDUP_MS = 30_000
const MAX_IMPRESSIONS = 500

function resetTodayIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (state.day !== today) {
    state.day = today
    state.today = 0
  }
}

function isDuplicateImpression(ip: string, source: string): boolean {
  const now = Date.now()
  const last = state.impressions.find(entry => entry.ip === ip && entry.source === source)
  if (last && now - last.at < DEDUP_MS) return true
  state.impressions.unshift({ ip, source, at: now })
  if (state.impressions.length > MAX_IMPRESSIONS) state.impressions.length = MAX_IMPRESSIONS
  return false
}

export async function POST(request: Request) {
  if (!adsEnabled()) {
    return NextResponse.json({ ok: true, adsDisabled: true, total: 0, today: 0 })
  }

  const body = await request.json().catch(() => null)
  const source = typeof body?.source === 'string' ? body.source.slice(0, 40) : 'push'
  const ip = getClientIP(request)
  resetTodayIfNeeded()

  const now = Date.now()
  const recent = (rateLimits.get(ip) ?? []).filter(ts => now - ts < 60_000)
  if (recent.length >= RATE_LIMIT_PER_MIN) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  recent.push(now)
  rateLimits.set(ip, recent)

  if (isDuplicateImpression(ip, source)) {
    return NextResponse.json({ ok: true, duplicate: true, total: state.total, today: state.today, ip })
  }

  state.total += 1
  state.today += 1

  const text = [
    `📢 <b>PUBLICITÉ DIFFUSÉE</b>`,
    ``,
    `📍 IP : <code>${escapeHTML(ip)}</code>`,
    `🔗 Source : ${escapeHTML(source)}`,
    `📊 Total : <b>${state.total}</b> | Aujourd'hui : <b>${state.today}</b>`,
  ].join('\n')
  await notifyCasino(text).catch(error => console.error('[Telegram] notifyAd:', error))

  return NextResponse.json({ ok: true, total: state.total, today: state.today, ip })
}