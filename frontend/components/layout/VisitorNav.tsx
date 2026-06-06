'use client'
import { RED, CHARCOAL, BORDER, WHITE } from '@/lib/theme'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useLanguage } from '@/hooks/useLanguage'
import type { SupportedLang } from '@/lib/langCookie'

export default function VisitorNav() {
  const { t } = useTranslation()
  const { currentLang, setLanguage } = useLanguage()
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <nav style={{ background: WHITE, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em' }}>KIPAR<span style={{ color: RED }}>.</span></span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={langRef} style={{ position: 'relative' }}>
            <button onClick={() => setLangOpen(!langOpen)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 99, border: '1px solid ' + BORDER, background: WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: CHARCOAL, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
              {currentLang === 'fr' ? '\u{1F1EB}\u{1F1F7}' : currentLang === 'en' ? '\u{1F1EC}\u{1F1E7}' : '\u{1F1EA}\u{1F1F8}'} {currentLang.toUpperCase()}
            </button>
            {langOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: WHITE, border: '1px solid ' + BORDER, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 200, minWidth: 140 }}>
                {([['fr', '\u{1F1EB}\u{1F1F7}', 'Fran\u00e7ais'], ['en', '\u{1F1EC}\u{1F1E7}', 'English'], ['es', '\u{1F1EA}\u{1F1F8}', 'Espa\u00f1ol']] as const).map(([code, flag, label]) => (
                  <button key={code} type="button" onClick={() => { setLanguage(code as SupportedLang); setLangOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: currentLang === code ? 'rgba(220,0,41,0.06)' : WHITE, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: currentLang === code ? 700 : 400, color: currentLang === code ? RED : CHARCOAL, textAlign: 'left', fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
                    {flag} {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href="/login" style={{ textDecoration: 'none', padding: '8px 18px', borderRadius: 99, background: RED, color: '#fff', fontSize: 13, fontWeight: 700 }}>{t.nav.login}</Link>
        </div>
      </div>
    </nav>
  )
}
