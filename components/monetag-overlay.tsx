'use client'

import { useEffect, useRef, useState } from 'react'
import { getMonetagAdLink, isAdsEnabled, initMonetag } from '@/lib/monetag'

export default function MonetagOverlay({ show, embed, autoClose = 15, hint, onClose, onShown }: { show: boolean; embed?: boolean; autoClose?: number; hint?: (remaining: number) => string; onClose?: () => void; onShown?: () => void }) {
  const src = getMonetagAdLink()
  const [remaining, setRemaining] = useState(autoClose)
  const timer = useRef<number | null>(null)
  const reported = useRef(false)

  useEffect(() => {
    if (!show || !isAdsEnabled()) return
    initMonetag()
  }, [show])

  useEffect(() => {
    if (!reported.current && show && isAdsEnabled()) {
      reported.current = true
      onShown?.()
    }
  }, [show, onShown])

  useEffect(() => {
    if (timer.current) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    if (show && !embed) {
      setRemaining(autoClose)
      timer.current = window.setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            if (timer.current) window.clearInterval(timer.current)
            timer.current = null
            onClose?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [show, embed, autoClose, onClose])

  if (!isAdsEnabled() || !src) return null

  if (embed) {
    return (
      <div className="monetag-embed">
        <MonetagFrame src={src} />
      </div>
    )
  }

  if (!show) return null

  return (
    <div className="monetag-overlay" role="dialog" aria-modal="true" aria-label="Annonce">
      <div className="monetag-box">
        <button type="button" className="monetag-close" onClick={() => onClose?.()} aria-label="Fermer">✕</button>
        <MonetagFrame src={src} />
        <p className="monetag-hint">{hint ? hint(remaining) : `Publicité — fermeture automatique dans ${remaining} s`}</p>
      </div>
    </div>
  )
}

function MonetagFrame({ src }: { src: string }) {
  return (
    <iframe
      className="monetag-frame"
      src={src}
      title="Publicité"
      loading="lazy"
      allow="fullscreen; autoplay"
      sandbox="allow-popups allow-scripts allow-forms allow-same-origin"
    />
  )
}