'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Clock, AlertTriangle, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import HeroHeader from '@/components/layout/HeroHeader'
import HeroBackHeader from '@/components/layout/HeroBackHeader'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE } from '@/lib/theme'

const HERO_IMG = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80'

type Period = 'day' | 'week' | 'month' | 'year' | 'all'

export default function CarrierFinancePage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [txPage, setTxPage] = useState(0)
  const TX_PER_PAGE = 20

  const load = async (p: Period) => {
    setLoading(true)
    try {
      const res = await api.get(`/carrier/finance?period=${p}`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(period) }, [period])

  useEffect(() => {
    if (user && !user.is_carrier) {
      router.replace('/dashboard')
    }
  }, [user])

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const exportExcel = async () => {
    if (!data) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // R\u00e9sum\u00e9
    const resume = [
      ['KIPAR \u2014 Relevé financier transporteur'],
      ['Période', period, 'Taux commission Kipar', `${data.kipar_rate_percent}%`],
      [],
      ['Catégorie', 'Montant (€)'],
      ['Revenus encaissés (net)', data.summary.revenue_collected],
      ['Revenus en attente (escrow)', data.summary.revenue_pending],
      ['Revenus bloqués (litige)', data.summary.revenue_disputed],
      [],
      ['Nb livraisons terminées', data.summary.delivered_count],
      ['Nb en cours', data.summary.in_escrow_count],
      ['Nb litiges', data.summary.disputed_count],
      ['Nb annulations', data.summary.cancelled_count],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resume), 'Résumé')

    // Fiscal
    const fiscal = [
      ['Année', 'CA brut (€)', 'Commission Kipar (€)', 'Net transporteur (€)', 'Nb livraisons'],
      ...data.fiscal_years.map((f: any) => [f.year, f.gross, f.commission_paid, f.net, f.deliveries_count])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fiscal), 'Fiscal 5 ans')

    // Transactions
    const txRows = [
      ['ID', 'Date', 'Statut', 'Montant brut (€)', 'Commission Kipar (€)', 'Net transporteur (€)', 'Devise', 'Rail', 'Origine', 'Destination', 'Départ', 'Vol', 'Contenu', 'Poids (kg)', 'Valeur déclarée (€)', 'Livraison confirmée'],
      ...(data.transactions || []).map((tx: any) => [
        tx.id, fmtDate(tx.date), tx.status,
        tx.amount_gross, tx.kipar_commission, tx.amount_net ?? '',
        tx.currency, tx.payment_rail ?? '',
        tx.origin ?? '', tx.destination ?? '',
        tx.departure_date ? fmtDate(tx.departure_date) : '',
        tx.flight_number ?? '',
        tx.content_description ?? '', tx.weight_kg ?? '', tx.declared_value ?? '',
        tx.delivery_confirmed_at ? fmtDate(tx.delivery_confirmed_at) : '',
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Transactions')

    XLSX.writeFile(wb, `kipar_carrier_finance_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const summary = data?.summary
  const fiscal: any[] = data?.fiscal_years || []
  const transactions: any[] = data?.transactions || []
  const chart: any[] = data?.chart || []
  const txSlice = transactions.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE)

  const STATUS_COLOR: Record<string, string> = {
    delivered: '#16A34A', paid: '#2563EB', in_transit: '#EA580C',
    disputed: RED, refunded: '#6B7280', cancelled: '#6B7280',
    cancelled_by_sender: '#6B7280', cancelled_by_carrier: '#6B7280',
    pending: TAUPE, accepted: '#2563EB',
  }

  const PERIOD_LABELS: Record<Period, string> = {
    day: 'Aujourd\'hui', week: 'Cette semaine', month: 'Ce mois', year: 'Cette année', all: 'Tout (5 ans)'
  }

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      <HeroBackHeader
        imageUrl={HERO_IMG}
        title="Mes finances"
        subtitle={`${user?.first_name ?? ''} ${user?.last_name ?? ''} · Commission Kipar ${data?.kipar_rate_percent ?? 17}%`}
        minHeight={180}
        onBack={() => router.push('/carrier')}
      />

      <div style={{ padding: '20px 16px 100px', maxWidth: 900, margin: '0 auto' }} className="md:px-0 md:pt-6">

        {/* Filtre période */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {(['day', 'week', 'month', 'year', 'all'] as Period[]).map(p => (
            <button key={p} type="button" onClick={() => { setPeriod(p); setTxPage(0) }}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${period === p ? RED : BORDER}`, background: period === p ? 'rgba(220,0,41,0.06)' : WHITE, color: period === p ? RED : CHARCOAL2, fontSize: 12, fontWeight: period === p ? 600 : 400, cursor: 'pointer' }}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {data && (
            <button type="button" onClick={exportExcel}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10, border: '1px solid #16A34A', background: '#ECFDF5', color: '#16A34A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={13} /> Exporter Excel
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: TAUPE, textAlign: 'center', padding: 40 }}>Chargement...</p>
        ) : !data ? (
          <p style={{ color: TAUPE, textAlign: 'center', padding: 40 }}>Impossible de charger les données.</p>
        ) : (
          <>
            {/* ── Section 1 : Résumé revenus ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Revenus encaissés', value: summary.revenue_collected, sub: `${summary.delivered_count} livraison(s)`, color: '#16A34A', icon: <TrendingUp size={18} color="#16A34A" /> },
                { label: 'En attente (escrow)', value: summary.revenue_pending, sub: `${summary.in_escrow_count} en cours`, color: '#2563EB', icon: <Clock size={18} color="#2563EB" /> },
                { label: 'Bloqués (litige)', value: summary.revenue_disputed, sub: `${summary.disputed_count} litige(s)`, color: summary.revenue_disputed > 0 ? RED : TAUPE, icon: <AlertTriangle size={18} color={summary.revenue_disputed > 0 ? RED : TAUPE} /> },
              ].map((card, i) => (
                <div key={i} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: TAUPE, margin: 0, fontWeight: 600 }}>{card.label}</p>
                    {card.icon}
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: card.color, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>{fmt(card.value)} €</p>
                  <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0' }}>{card.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Section 2 : Graphique évolution ── */}
            {chart.length > 0 && (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 16px' }}>Évolution des revenus</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: TAUPE }} />
                    <YAxis tick={{ fontSize: 11, fill: TAUPE }} />
                    <Tooltip formatter={(v: any) => `${fmt(Number(v))} €`} />
                    <Legend />
                    <Line type="monotone" dataKey="net" name="Net transporteur" stroke="#16A34A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="gross" name="Brut" stroke="#2563EB" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Section 3 : Fiscal 5 ans ── */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Déclaration fiscale — 5 ans</p>
                <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>Ces chiffres sont fournis à titre indicatif. Consultez un expert-comptable pour votre déclaration.</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: SAND }}>
                      {['Année', 'CA brut', 'Commission Kipar', 'Net encaissé', 'Livraisons'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TAUPE, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fiscal.map((f: any) => (
                      <tr key={f.year} style={{ borderBottom: `1px solid ${BORDER}`, background: f.is_current ? 'rgba(220,0,41,0.03)' : WHITE }}>
                        <td style={{ padding: '10px 14px', fontWeight: f.is_current ? 700 : 400, color: f.is_current ? RED : CHARCOAL }}>
                          {f.year} {f.is_current && <span style={{ fontSize: 10, background: RED, color: WHITE, borderRadius: 99, padding: '1px 6px', marginLeft: 6 }}>En cours</span>}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: CHARCOAL }}>{fmt(f.gross)} €</td>
                        <td style={{ padding: '10px 14px', color: TAUPE }}>{fmt(f.commission_paid)} €</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16A34A' }}>{fmt(f.net)} €</td>
                        <td style={{ padding: '10px 14px', color: TAUPE }}>{f.deliveries_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 4 : Historique transactions ── */}
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Historique ({transactions.length} transactions)
              </p>
              {transactions.length === 0 ? (
                <p style={{ color: TAUPE, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune transaction sur cette période</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: SAND }}>
                          {['Date', 'Statut', 'Trajet', 'Contenu', 'Poids', 'Brut', 'Commission', 'Net', 'Rail'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TAUPE, whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {txSlice.map((tx: any, i: number) => (
                          <tr key={tx.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? WHITE : SAND }}>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: TAUPE }}>{fmtDate(tx.date)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[tx.status] ?? TAUPE, background: (STATUS_COLOR[tx.status] ?? TAUPE) + '18', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{tx.status}</span>
                            </td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>{tx.origin ?? '?'} → {tx.destination ?? '?'}</td>
                            <td style={{ padding: '8px 12px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.content_description ?? '—'}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{tx.weight_kg ? `${tx.weight_kg} kg` : '—'}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: CHARCOAL }}>{fmt(tx.amount_gross)} €</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: TAUPE }}>-{fmt(tx.kipar_commission)} €</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: tx.amount_net ? '#16A34A' : TAUPE }}>{tx.amount_net ? `${fmt(tx.amount_net)} €` : '—'}</td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: TAUPE }}>{tx.payment_rail ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {transactions.length > TX_PER_PAGE && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                      <button type="button" onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, color: txPage === 0 ? TAUPE : CHARCOAL, fontSize: 12, cursor: txPage === 0 ? 'not-allowed' : 'pointer' }}>
                        ← Précédent
                      </button>
                      <span style={{ fontSize: 12, color: TAUPE }}>Page {txPage + 1} / {Math.ceil(transactions.length / TX_PER_PAGE)}</span>
                      <button type="button" onClick={() => setTxPage(p => Math.min(Math.ceil(transactions.length / TX_PER_PAGE) - 1, p + 1))} disabled={(txPage + 1) * TX_PER_PAGE >= transactions.length}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, color: (txPage + 1) * TX_PER_PAGE >= transactions.length ? TAUPE : CHARCOAL, fontSize: 12, cursor: (txPage + 1) * TX_PER_PAGE >= transactions.length ? 'not-allowed' : 'pointer' }}>
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}