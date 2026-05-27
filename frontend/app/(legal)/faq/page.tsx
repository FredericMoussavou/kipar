'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Search, MessageCircle } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

type CategoryKey =
  | 'general' | 'inscription' | 'expediteur' | 'transporteur'
  | 'recepteur' | 'paiements' | 'securite' | 'colis' | 'compte'

interface FaqItem {
  q: string
  a: string
  category: CategoryKey
}

export default function FaqPage() {
  const router = useRouter()
  const { t, lang } = useTranslation()
  const f = t.faq
  const [search, setSearch] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all')

  const allLabel = lang === 'fr' ? 'Toutes' : lang === 'es' ? 'Todas' : 'All'

  const categories: { key: CategoryKey | 'all'; label: string }[] = [
    { key: 'all',          label: allLabel },
    { key: 'general',      label: f.categories.general },
    { key: 'inscription',  label: f.categories.inscription },
    { key: 'expediteur',   label: f.categories.expediteur },
    { key: 'transporteur', label: f.categories.transporteur },
    { key: 'recepteur',    label: f.categories.recepteur },
    { key: 'paiements',    label: f.categories.paiements },
    { key: 'securite',     label: f.categories.securite },
    { key: 'colis',        label: f.categories.colis },
    { key: 'compte',       label: f.categories.compte },
  ]

  const items: FaqItem[] = [
    { category: 'general',      q: f.q_what_is_kipar,       a: f.a_what_is_kipar },
    { category: 'general',      q: f.q_how_works,           a: f.a_how_works },
    { category: 'general',      q: f.q_countries,           a: f.a_countries },
    { category: 'general',      q: f.q_legal,               a: f.a_legal },
    { category: 'inscription',  q: f.q_kyc_why,             a: f.a_kyc_why },
    { category: 'inscription',  q: f.q_kyc_docs,            a: f.a_kyc_docs },
    { category: 'inscription',  q: f.q_kyc_time,            a: f.a_kyc_time },
    { category: 'inscription',  q: f.q_kyc_rejected,        a: f.a_kyc_rejected },
    { category: 'expediteur',   q: f.q_sender_how,          a: f.a_sender_how },
    { category: 'expediteur',   q: f.q_sender_handover,     a: f.a_sender_handover },
    { category: 'expediteur',   q: f.q_sender_lost,         a: f.a_sender_lost },
    { category: 'expediteur',   q: f.q_sender_cancel,       a: f.a_sender_cancel },
    { category: 'transporteur', q: f.q_carrier_publish,     a: f.a_carrier_publish },
    { category: 'transporteur', q: f.q_carrier_payment,     a: f.a_carrier_payment },
    { category: 'transporteur', q: f.q_carrier_refuse,      a: f.a_carrier_refuse },
    { category: 'transporteur', q: f.q_carrier_prohibited,  a: f.a_carrier_prohibited },
    { category: 'recepteur',    q: f.q_receiver_how,        a: f.a_receiver_how },
    { category: 'recepteur',    q: f.q_receiver_noshow,     a: f.a_receiver_noshow },
    { category: 'paiements',    q: f.q_payment_methods,     a: f.a_payment_methods },
    { category: 'paiements',    q: f.q_escrow,              a: f.a_escrow },
    { category: 'paiements',    q: f.q_fees,                a: f.a_fees },
    { category: 'securite',     q: f.q_trust,               a: f.a_trust },
    { category: 'securite',     q: f.q_kiparscore,          a: f.a_kiparscore },
    { category: 'securite',     q: f.q_dispute,             a: f.a_dispute },
    { category: 'colis',        q: f.q_allowed,             a: f.a_allowed },
    { category: 'colis',        q: f.q_weight,              a: f.a_weight },
    { category: 'colis',        q: f.q_insurance,           a: f.a_insurance },
    { category: 'compte',       q: f.q_profile,             a: f.a_profile },
    { category: 'compte',       q: f.q_delete,              a: f.a_delete },
    { category: 'compte',       q: f.q_contact,             a: f.a_contact },
  ]

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(item => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory
      if (!q) return matchCat
      return matchCat && (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
    })
  }, [search, activeCategory, lang])

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <div style={{ minHeight: '100vh', background: SAND }}>
      {/* Header */}
      <div style={{
        background: WHITE, borderBottom: `1px solid ${BORDER}`,
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} color={CHARCOAL} />
        </button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>
            {f.page_title}
          </p>
          <p style={{ fontSize: 12, color: TAUPE, margin: 0 }}>{f.page_subtitle}</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Recherche */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} color={TAUPE} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpenIndex(null) }}
            placeholder={f.search_placeholder}
            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 14, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filtres categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 24, scrollbarWidth: 'none' as const }}>
          {categories.map(cat => (
            <button key={cat.key} type="button"
              onClick={() => { setActiveCategory(cat.key); setOpenIndex(null) }}
              style={{
                padding: '7px 14px', borderRadius: 99,
                border: `1px solid ${activeCategory === cat.key ? RED : BORDER}`,
                background: activeCategory === cat.key ? 'rgba(220,0,41,0.06)' : WHITE,
                color: activeCategory === cat.key ? RED : CHARCOAL2,
                fontSize: 12, fontWeight: activeCategory === cat.key ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Accordion */}
        {filtered.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <Search size={32} color={TAUPE} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 14, color: TAUPE, margin: 0 }}>{f.no_results}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((item, i) => (
              <div key={i} style={{
                background: WHITE,
                border: `1px solid ${openIndex === i ? RED : BORDER}`,
                borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s',
              }}>
                <button type="button" onClick={() => toggle(i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, lineHeight: 1.4, flex: 1 }}>
                    {item.q}
                  </span>
                  {openIndex === i
                    ? <ChevronUp size={18} color={RED} style={{ flexShrink: 0 }} />
                    : <ChevronDown size={18} color={TAUPE} style={{ flexShrink: 0 }} />}
                </button>
                {openIndex === i && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${SAND}` }}>
                    <p style={{ fontSize: 14, color: CHARCOAL2, margin: '14px 0 0', lineHeight: 1.7 }}>
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bloc contact */}
        <div style={{ marginTop: 40, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
          <MessageCircle size={32} color={RED} style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: '0 0 6px', fontFamily: 'var(--font-syne,Syne)' }}>
            {f.contact_title}
          </p>
          <p style={{ fontSize: 13, color: TAUPE, margin: '0 0 16px' }}>{f.contact_desc}</p>
          <a href="mailto:contact@kipar.app"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, background: RED, color: WHITE, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            {f.contact_btn}
          </a>
        </div>

      </div>
    </div>
  )
}
