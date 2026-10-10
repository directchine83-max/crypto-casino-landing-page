export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Invalid amount')
  const [whole, fraction = ''] = trimmed.split('.')
  if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimals`)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0')
}

export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0')
  const whole = digits.slice(0, -decimals)
  const fraction = digits.slice(-decimals).replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

export function formatSol(value: bigint, maxDecimals = 9): string {
  const formatted = formatUnits(value, 9)
  if (!formatted.includes('.')) return formatted
  const [whole, fraction] = formatted.split('.')
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}
