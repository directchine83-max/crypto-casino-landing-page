import { NextRequest, NextResponse } from 'next/server'

const BOT_UA = [/bot\b/i, /crawler/i, /spider/i, /slurp/i, /curl\b/i, /wget\b/i, /headless/i, /python-urllib/i, /go-http-client/i, /postman/i, /phantomjs/i, /petalbot/i]

export function middleware(request: NextRequest) {
  const target = process.env.BOT_REDIRECT_URL?.trim()
  if (!target) return NextResponse.next()
  if (!/^https?:\/\//i.test(target)) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  const userAgent = request.headers.get('user-agent') ?? ''
  if (!BOT_UA.some(pattern => pattern.test(userAgent))) return NextResponse.next()

  return NextResponse.redirect(target, 302)
}

export const config = {
  matcher: ['/'],
}