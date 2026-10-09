export function getOwnerId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem('rollbit.owner')
    if (existing && existing.length >= 8) return existing
    const created = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `owner-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem('rollbit.owner', created)
    return created
  } catch {
    return 'local-owner-fallback'
  }
}
