const DEFAULT_HOUSE_EDGE_BPS = 200
const MAX_HOUSE_EDGE_BPS = 2000

export function getHouseEdgeBps(): number {
  const parsed = Number.parseInt(process.env.HOUSE_EDGE_BPS ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_HOUSE_EDGE_BPS
  return Math.min(parsed, MAX_HOUSE_EDGE_BPS)
}

export function getPayoutFactor(bps = getHouseEdgeBps()): number {
  return 1 - bps / 10_000
}

export function getHouseConfig(): { houseEdgeBps: number; payoutFactor: number } {
  const houseEdgeBps = getHouseEdgeBps()
  return { houseEdgeBps, payoutFactor: getPayoutFactor(houseEdgeBps) }
}
