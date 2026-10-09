import { NextResponse } from 'next/server'
import { getHouseConfig } from '@/lib/house'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getHouseConfig())
}
