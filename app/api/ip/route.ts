import { NextResponse } from 'next/server'
import { getClientIP } from '@/lib/client-ip'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const ip = getClientIP(request)
  return NextResponse.json({ ip, service: 'rollbit visitor ip check' })
}