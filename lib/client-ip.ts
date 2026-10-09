export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-vercel-forwarded-for')?.trim()
  if (forwarded) return forwarded.split(',')[0].trim()
  const xForwardedFor = request.headers.get('x-forwarded-for')?.trim()
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
  return (
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  )
}