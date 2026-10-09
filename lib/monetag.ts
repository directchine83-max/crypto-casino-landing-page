const AD_LINK = process.env.NEXT_PUBLIC_MONETAG_AD_LINK?.trim() || 'https://uplcm.com/4/11934306'
const ENABLED = process.env.NEXT_PUBLIC_MONETAG_ENABLED === 'true'
const TAG_SRC = process.env.NEXT_PUBLIC_MONETAG_TAG_SRC?.trim() || ''
const ZONE = process.env.NEXT_PUBLIC_MONETAG_ZONE?.trim() || ''

export function isMonetagEnabled(): boolean {
  return ENABLED
}

export function getMonetagAdLink(): string {
  return AD_LINK
}

export function isAdsEnabled(): boolean {
  return ENABLED && AD_LINK.length > 0
}

let multiTagInjected = false

export function initMonetag(): boolean {
  if (!ENABLED) return false
  if (!TAG_SRC || !ZONE) {
    console.log('[Monetag] MultiTag non configuré (TAG_SRC/ZONE manquants)')
    return false
  }
  if (multiTagInjected) return true
  if (typeof document === 'undefined') return false
  try {
    const script = document.createElement('script')
    script.src = TAG_SRC
    script.setAttribute('data-zone', ZONE)
    script.setAttribute('data-sdk', `show_${ZONE}`)
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.onerror = () => console.warn('[Monetag] MultiTag failed to load')
    document.head.appendChild(script)
    multiTagInjected = true
    return true
  } catch (error) {
    console.warn('[Monetag] Error:', error instanceof Error ? error.message : error)
    return false
  }
}