'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, Zap, Globe, Star, ChevronDown, Package, Plane, Users, CheckCircle } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { getT } from '@/lib/i18n'

const R = '#DC0029'
const CHARCOAL = '#1A1A1A'
const SAND = '#F5F2EE'
const TAUPE = '#8B8078'
const WHITE = '#FFFFFF'

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, inView }
}

function Counter({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const { ref, inView } = useInView()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / 60
    const t = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(start))
    }, 1000 / 60)
    return () => clearInterval(t)
  }, [inView, target])
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 36, fontWeight: 900, color: WHITE, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {val}{suffix}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function PhoneMockup() {
  return (
    <div style={{ position: 'relative', width: 180, height: 360, flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 32, background: 'linear-gradient(145deg,#2a2a2a,#1a1a1a)', boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', transform: 'rotate(-4deg)' }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 50, height: 5, background: '#111', borderRadius: 99, zIndex: 10 }} />
        <div style={{ position: 'absolute', inset: 7, borderRadius: 26, overflow: 'hidden', background: '#F5F2EE' }}>
          <div style={{ background: R, padding: '28px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 14, fontWeight: 900, color: WHITE }}>KIPAR.</span>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: WHITE }} />
            </div>
          </div>
          <div style={{ padding: '10px 10px 0' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: TAUPE, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trajets disponibles</div>
            {[{ from: 'CDG', to: 'ABJ', price: '8€/kg', carrier: 'Marie T.' }, { from: 'ORY', to: 'DSS', price: '7€/kg', carrier: 'Kofi A.' }, { from: 'CDG', to: 'LBV', price: '9€/kg', carrier: 'Serge M.' }].map((t, i) => (
              <div key={i} style={{ background: WHITE, borderRadius: 8, padding: '6px 8px', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: CHARCOAL }}>{t.from} → {t.to}</div><div style={{ fontSize: 7, color: TAUPE }}>{t.carrier}</div></div>
                <div style={{ background: R, borderRadius: 5, padding: '2px 6px', fontSize: 8, fontWeight: 700, color: WHITE }}>{t.price}</div>
              </div>
            ))}
            <div style={{ background: 'linear-gradient(135deg,#DC0029,#8B0018)', borderRadius: 8, padding: '7px 9px', marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Shield size={10} color={WHITE} />
              <div><div style={{ fontSize: 8, fontWeight: 700, color: WHITE }}>KiparTrust</div><div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Vérifiés</div></div>
              <div style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: WHITE }}>98%</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 36, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 99 }} />
      </div>
      <div style={{ position: 'absolute', top: -10, right: -20, background: WHITE, borderRadius: 12, padding: '6px 10px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 5, transform: 'rotate(3deg)', zIndex: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: CHARCOAL }}>Livré ✓</span>
      </div>
      <div style={{ position: 'absolute', bottom: 32, left: -22, background: R, borderRadius: 12, padding: '6px 12px', boxShadow: '0 6px 24px rgba(220,0,41,0.3)', transform: 'rotate(-2deg)', zIndex: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: WHITE }}>8€/kg</span>
      </div>
    </div>
  )
}

function LaptopMockup() {
  return (
    <div style={{ position: 'relative', width: 320, flexShrink: 0 }}>
      <div style={{ width: '100%', paddingBottom: '62%', position: 'relative', background: 'linear-gradient(145deg,#2d2d2d,#1a1a1a)', borderRadius: '10px 10px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', transform: 'rotate(2deg)' }}>
        <div style={{ position: 'absolute', inset: 5, borderRadius: 7, overflow: 'hidden', background: '#F5F2EE' }}>
          <div style={{ background: WHITE, padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E8E4DF' }}>
            <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 9, fontWeight: 900, color: CHARCOAL }}>KIPAR<span style={{ color: R }}>.</span></span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#F5F2EE','#F5F2EE','#DC0029'].map((bg, i) => <div key={i} style={{ width: 36, height: 11, borderRadius: 3, background: bg, border: i < 2 ? '1px solid #E8E4DF' : 'none' }} />)}
            </div>
          </div>
          <div style={{ padding: '8px 10px' }}>
            <div style={{ background: 'linear-gradient(90deg,#DC0029,#8B0018)', borderRadius: 7, padding: '10px', marginBottom: 7 }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>Bonjour 👋</div>
              <div style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 10, fontWeight: 900, color: WHITE }}>Frédéric M.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[{ label: 'CDG → ABJ', date: '15 mai', color: '#ECFDF5', accent: '#16A34A' }, { label: 'ORY → DSS', date: '18 mai', color: '#EFF6FF', accent: '#2563EB' }, { label: 'CDG → LOS', date: '22 mai', color: '#FFF7ED', accent: '#EA580C' }, { label: 'CDG → CMN', date: '28 mai', color: '#F5F2EE', accent: TAUPE }].map((c, i) => (
                <div key={i} style={{ background: c.color, borderRadius: 5, padding: '5px 7px' }}>
                  <div style={{ fontSize: 7, fontWeight: 700, color: CHARCOAL }}>{c.label}</div>
                  <div style={{ fontSize: 6, color: c.accent, marginTop: 1 }}>{c.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#333' }} />
      </div>
      <div style={{ height: 5, background: 'linear-gradient(180deg,#2d2d2d,#222)', borderRadius: '0 0 2px 2px', transform: 'rotate(2deg)' }} />
      <div style={{ height: 12, background: 'linear-gradient(180deg,#2a2a2a,#1e1e1e)', borderRadius: '0 0 7px 7px', transform: 'rotate(2deg)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 2, margin: '3px 30%' }} />
      </div>
      <div style={{ position: 'absolute', top: 16, left: -16, background: WHITE, borderRadius: 12, padding: '6px 10px', boxShadow: '0 6px 24px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 5, transform: 'rotate(-3deg)', zIndex: 10 }}>
        <Star size={9} fill={R} color={R} />
        <span style={{ fontSize: 9, fontWeight: 700, color: CHARCOAL }}>4.9/5</span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const isMobile = useIsMobile()
  const [lang, setLang] = useState<'fr' | 'en' | 'es'>('fr')
  const t = getT(lang)
  const [scrolled, setScrolled] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { ref: howRef, inView: howInView } = useInView()
  const { ref: whyRef, inView: whyInView } = useInView()
  const { ref: corridorRef, inView: corridorInView } = useInView()
  const { ref: testimonialRef, inView: testimonialInView } = useInView()

  const px = isMobile ? 20 : 48

  return (
    <div style={{ fontFamily: 'var(--font-sans,DM Sans)', background: WHITE, overflowX: 'hidden' }}>

      {/* HEADER */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: `0 ${px}px`, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none', transition: 'all 0.3s ease' }}>
        <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 900, color: scrolled ? CHARCOAL : WHITE, letterSpacing: '-0.02em' }}>
          KIPAR<span style={{ color: R }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 28 }}>
          {!isMobile && [[t.landing.nav_how, '#how'], [t.landing.nav_why, '#why']].map(([label, href]) => (
            <a key={href} href={href} style={{ fontSize: 13, fontWeight: 500, color: scrolled ? CHARCOAL : 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>{label}</a>
          ))}
          <Link href="/splash" style={{ padding: isMobile ? '8px 16px' : '9px 20px', borderRadius: 10, background: R, color: WHITE, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            {isMobile ? t.landing.nav_login_mobile : t.landing.nav_login}
          </Link>
          {/* Sélecteur langue */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setLangOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: `1px solid ${scrolled ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: scrolled ? CHARCOAL : WHITE, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
              {lang === 'fr' ? '🇫🇷' : lang === 'en' ? '🇬🇧' : '🇪🇸'} {lang.toUpperCase()}
            </button>
            {langOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: WHITE, border: `1px solid rgba(0,0,0,0.08)`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 200, minWidth: 140 }}>
                {([['fr', '🇫🇷', 'Français'], ['en', '🇬🇧', 'English'], ['es', '🇪🇸', 'Español']] as const).map(([code, flag, label]) => (
                  <button key={code} type="button"
                    onClick={() => { setLang(code); setLangOpen(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: lang === code ? 'rgba(220,0,41,0.06)' : WHITE, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: lang === code ? 700 : 400, color: lang === code ? R : CHARCOAL, textAlign: 'left', fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }}>
                    {flag} {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg,${CHARCOAL} 0%,#2d0a12 50%,#1a0008 100%)`, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(220,0,41,0.15) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(220,0,41,0.08) 0%,transparent 70%)' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '90px 20px 160px' : '100px 48px 120px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 40 : 80, width: '100%' }}>
          {/* Texte */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(220,0,41,0.15)', border: '1px solid rgba(220,0,41,0.3)', borderRadius: 99, padding: '5px 12px', marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: R, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Transporteurs vérifiés KiparTrust</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 42 : 64, fontWeight: 900, color: WHITE, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 12 }}>
              Chaque colis<br /><span style={{ color: R }}>mérite</span> un<br />transporteur<br />de confiance.
            </h1>
            <p style={{ fontSize: isMobile ? 16 : 18, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 400, lineHeight: 1.6, maxWidth: 480 }}>{t.landing.hero_tagline}</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36, lineHeight: 1.7, maxWidth: 480 }}>La première marketplace de transport de colis entre particuliers avec vérification d'identité et score de confiance KiparTrust.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '13px 22px' : '14px 28px', borderRadius: 12, background: R, color: WHITE, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(220,0,41,0.4)' }}>
                Commencer gratuitement <ArrowRight size={16} />
              </Link>
              {!isMobile && (
                <a href="#how" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 500, textDecoration: 'none', background: 'rgba(255,255,255,0.05)' }}>
                  Comment ça marche <ChevronDown size={16} />
                </a>
              )}
            </div>
          </div>

          {/* Mockups — masqués sur mobile très petit, empilés sur tablette */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
              <PhoneMockup />
              <LaptopMockup />
            </div>
          )}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneMockup />
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px' : '24px 48px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 20 : 0 }}>
            <Counter target={10000} suffix="+" label="Transporteurs actifs" />
            <Counter target={50} suffix="+" label="Destinations" />
            <Counter target={98} suffix="%" label="Livraisons réussies" />
            <Counter target={4} suffix=".9★" label="Note moyenne" />
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section id="how" ref={howRef} style={{ padding: isMobile ? '60px 20px' : '100px 48px', background: SAND }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{t.landing.how_tag}</p>
            <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 32 : 44, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em', margin: 0 }}>{t.landing.how_title}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 20 }}>
            {[
              { icon: <Package size={26} color={R} />, num: '01', title: 'Déposez votre annonce', desc: "Décrivez votre colis, son poids et sa destination. Notre IA KiparScan analyse vos photos pour valider le contenu." },
              { icon: <Plane size={26} color={R} />, num: '02', title: 'Choisissez un transporteur', desc: "Parcourez les voyageurs vérifiés KiparTrust sur votre corridor. Consultez leur score de confiance, leurs avis et leurs tarifs." },
              { icon: <CheckCircle size={26} color={R} />, num: '03', title: 'Livraison sécurisée', desc: "Le transporteur remet le colis avec un code QR unique. Le paiement est débloqué uniquement après confirmation de réception." },
            ].map((step, i) => (
              <div key={i} style={{ background: WHITE, borderRadius: 18, padding: 28, opacity: howInView ? 1 : 0, transform: howInView ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`, boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,0,41,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{step.icon}</div>
                  <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 40, fontWeight: 900, color: 'rgba(0,0,0,0.06)' }}>{step.num}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: CHARCOAL, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: TAUPE, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
            {[{ role: 'Expéditeur', color: R, bg: 'rgba(220,0,41,0.06)', desc: 'Envoyez vos colis en toute sérénité' }, { role: 'Transporteur', color: '#2563EB', bg: '#EFF6FF', desc: 'Rentabilisez vos voyages' }, { role: 'Récepteur', color: '#16A34A', bg: '#ECFDF5', desc: 'Recevez vos colis en sécurité' }].map((r, i) => (
              <div key={i} style={{ background: r.bg, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <div><div style={{ fontWeight: 700, color: CHARCOAL, fontSize: 14 }}>{r.role}</div><div style={{ fontSize: 12, color: TAUPE, marginTop: 2 }}>{r.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

{/* VIDEO */}
      <section style={{ padding: isMobile ? '60px 20px' : '80px 48px', background: WHITE }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 28 : 36, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em', margin: 0 }}>{t.landing.video_title}</h2>
          </div>
          
          {/* Conteneur de la vidéo (Conserve le ratio 16:9) */}
          <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', background: CHARCOAL, boxShadow: '0 20px 56px rgba(0,0,0,0.15)' }}>
            
            {isVideoPlaying ? (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#000' }}>
                <video 
                  src="../videos/presentation.mp4" 
                  controls 
                  autoPlay 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsVideoPlaying(false) }}
                  style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div 
                  onClick={() => setIsVideoPlaying(true)}
                  style={{ width: 64, height: 64, borderRadius: '50%', background: R, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(220,0,41,0.4)', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ width: 0, height: 0, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderLeft: '18px solid white', marginLeft: 4 }} />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Voir la vidéo de présentation</span>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* POURQUOI KIPAR */}
      <section id="why" ref={whyRef} style={{ padding: isMobile ? '60px 20px' : '100px 48px', background: CHARCOAL }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{t.landing.why_tag}</p>
            <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 32 : 44, fontWeight: 900, color: WHITE, letterSpacing: '-0.02em', margin: 0 }}>{t.landing.why_title}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 20 }}>
            {[
              { icon: <Shield size={22} color={R} />, title: 'KiparTrust', desc: "Notre système de score de confiance unique vérifie chaque transporteur : identité, historique, avis clients." },
              { icon: <Zap size={22} color={R} />, title: 'KiparScan IA', desc: "Notre intelligence artificielle analyse vos photos de colis pour valider le contenu et accélérer la mise en relation." },
              { icon: <Globe size={22} color={R} />, title: '50+ destinations', desc: "CDG, ORY, LYS vers Abidjan, Dakar, Libreville, Lagos, Casablanca et bien plus. Le réseau KIPAR couvre les corridors les plus demandés." },
              { icon: <Users size={22} color={R} />, title: 'Communauté vérifiée', desc: "Chaque membre est vérifié via notre processus KYC. Email, téléphone, pièce d'identité. Une communauté de confiance." },
            ].map((feat, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: isMobile ? 24 : 32, opacity: whyInView ? 1 : 0, transform: whyInView ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s` }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(220,0,41,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{feat.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 18, fontWeight: 800, color: WHITE, marginBottom: 8 }}>{feat.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORRIDORS */}
      <section ref={corridorRef} style={{ padding: isMobile ? '60px 20px' : '80px 48px', background: SAND }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 28 : 36, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em', marginBottom: 28, textAlign: 'center' }}>{t.landing.corridors_title}</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[{ from: 'Paris CDG', to: 'Abidjan', flag: '🇫🇷→🇨🇮' }, { from: 'Paris CDG', to: 'Dakar', flag: '🇫🇷→🇸🇳' }, { from: 'Paris CDG', to: 'Libreville', flag: '🇫🇷→🇬🇦' }, { from: 'Paris ORY', to: 'Douala', flag: '🇫🇷→🇨🇲' }, { from: 'Paris CDG', to: 'Lagos', flag: '🇫🇷→🇳🇬' }, { from: 'Paris CDG', to: 'Casablanca', flag: '🇫🇷→🇲🇦' }, { from: 'Lyon', to: 'Kinshasa', flag: '🇫🇷→🇨🇩' }, { from: 'Paris CDG', to: 'Accra', flag: '🇫🇷→🇬🇭' }].map((c, i) => (
              <div key={i} style={{ background: WHITE, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', opacity: corridorInView ? 1 : 0, transform: corridorInView ? 'translateY(0)' : 'translateY(12px)', transition: `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s`, cursor: 'pointer' }}>
                <span style={{ fontSize: 14 }}>{c.flag}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: CHARCOAL }}>{c.from}</span>
                <span style={{ fontSize: 10, color: TAUPE }}>→</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: CHARCOAL }}>{c.to}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section id="testimonials" ref={testimonialRef} style={{ padding: isMobile ? '60px 20px' : '100px 48px', background: WHITE }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: R, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{t.landing.testimonials_tag}</p>
            <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 32 : 44, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em', margin: 0 }}>{t.landing.testimonials_title}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 20 }}>
            {[
              { name: 'Aminata D.', role: 'Expéditrice, Paris', text: "J'envoie des colis à ma famille à Dakar régulièrement. Avec KIPAR, je choisis un transporteur de confiance et je suis rassurée à chaque envoi.", stars: 5, avatar: 'A' },
              { name: 'Kofi A.', role: 'Transporteur, Lyon', text: "Je voyage souvent pour le travail. KIPAR me permet de rentabiliser mes valises vides. Le processus est simple et les paiements sont sécurisés.", stars: 5, avatar: 'K' },
              { name: 'Marie-Claire N.', role: 'Expéditrice, Bordeaux', text: "Le score KiparTrust est une vraie révolution. Je sais exactement à qui je confie mon colis avant même de le lui remettre.", stars: 5, avatar: 'M' },
            ].map((t, i) => (
              <div key={i} style={{ background: SAND, borderRadius: 18, padding: isMobile ? 24 : 28, opacity: testimonialInView ? 1 : 0, transform: testimonialInView ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.5s ease ${i * 0.15}s, transform 0.5s ease ${i * 0.15}s` }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={13} fill={R} color={R} />)}
                </div>
                <p style={{ fontSize: 14, color: CHARCOAL, lineHeight: 1.7, marginBottom: 18, fontStyle: 'italic' }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: R, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-syne,Syne)', fontSize: 15, fontWeight: 800, color: WHITE, flexShrink: 0 }}>{t.avatar}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>{t.name}</div><div style={{ fontSize: 11, color: TAUPE }}>{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: isMobile ? '80px 20px' : '100px 48px', background: `linear-gradient(135deg,${CHARCOAL} 0%,#2d0a12 60%,#1a0008 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(220,0,41,0.12) 0%,transparent 70%)' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: isMobile ? 36 : 52, fontWeight: 900, color: WHITE, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
            Prêt à rejoindre<br />la communauté <span style={{ color: R }}>KIPAR</span> ?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 36, lineHeight: 1.7 }}>
            Rejoignez des milliers de membres qui font confiance à KIPAR pour leurs envois internationaux.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '14px 24px' : '16px 36px', borderRadius: 12, background: R, color: WHITE, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(220,0,41,0.4)' }}>
              Créer un compte gratuit <ArrowRight size={17} />
            </Link>
            <Link href="/splash" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '14px 24px' : '16px 36px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', color: WHITE, fontSize: 15, fontWeight: 500, textDecoration: 'none', background: 'rgba(255,255,255,0.05)' }}>
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: isMobile ? '28px 20px' : '36px 48px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 0 }}>
        <span style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 16, fontWeight: 900, color: WHITE }}>KIPAR<span style={{ color: R }}>.</span></span>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{t.landing.footer_rights}</p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Confidentialité', 'CGU', 'Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)} }
      `}</style>
    </div>
  )
}
