'use client'
import React from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, ShieldCheck, AlertTriangle,
  CheckCircle, XCircle, Ban, Shield, ChevronLeft,
  LogOut, RefreshCw, TrendingUp, Umbrella, ClipboardCheck, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import { useResponsive } from '@/hooks/useResponsive'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN, AMBER } from '@/lib/theme'

type Tab = 'dashboard' | 'users' | 'kyc' | 'disputes' | 'finance' | 'insurance' | 'validations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_users: number
  total_bookings: number
  open_disputes: number
  kyc_pending: number
  total_trips: number
  total_revenue: number
}

interface AdminUser {
  id: string
  full_name: string
  email: string
  username: string | null
  kyc_status: string
  is_admin: boolean
  is_active?: boolean
  trust_score: number
  created_at: string
  id_front?: string | null
  id_back?: string | null
  selfie?: string | null
}

interface DisputeParty {
  id: string; full_name: string; email: string; phone: string | null
  address: string | null; trust_score: number
}
interface DisputeDetail {
  id: string; status: string; reason: string; resolution: string | null
  incident_type: string; incident_stage: string; initiated_by_role: string
  initiator: DisputeParty | null; respondent_comment: string | null
  respondent_evidence_urls: string[]; evidence_urls: string[]
  has_insurance: boolean; insurance_payout: number
  insurer_dossier_sent: boolean; insurer_reference: string | null
  admin_notes: string | null
  booking: { id: string; status: string; amount: number; currency: string } | null
  package: { content_description: string; declared_value: number | null; weight_kg: number; photo_urls: string[] } | null
  trip: { origin: string; destination: string; departure_date: string; flight_number: string | null } | null
  sender: DisputeParty | null; carrier: DisputeParty | null; receiver: DisputeParty | null
  timeline: { created_at: string; pickup_failed_at: string | null; delivery_failed_at: string | null; incident_response_deadline: string | null; resolved_at: string | null }
  created_at: string; resolved_at: string | null
}
interface Dispute {
  id: string; booking_id: string; status: string; reason: string
  incident_type: string; incident_stage: string; initiated_by_role: string
  resolution: string | null; created_at: string
  booking: { amount: number; currency: string } | null
  initiator: DisputeParty | null
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function StatCard({ label, value, color, onClick }: { label: string; value: number | string; color?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px', flex: 1, minWidth: 130, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: color ?? CHARCOAL, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>{value}</p>
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    approved:         { bg: '#ECFDF5', color: '#16A34A', label: 'Vérifié' },
    verified:         { bg: '#ECFDF5', color: '#16A34A', label: 'Vérifié' },
    pending:          { bg: '#FFF7ED', color: '#EA580C', label: 'En attente' },
    rejected:         { bg: '#FEF2F2', color: RED,       label: 'Rejeté' },
    open:             { bg: '#EFF6FF', color: '#2563EB', label: 'Ouvert' },
    resolved_sender:  { bg: '#ECFDF5', color: '#16A34A', label: 'Résolu (expéditeur)' },
    resolved_carrier: { bg: '#ECFDF5', color: '#16A34A', label: 'Résolu (transporteur)' },
    cancelled:        { bg: SAND,      color: TAUPE,      label: 'Annulé' },
  }
  const s = map[status] ?? { bg: SAND, color: TAUPE, label: status }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: type === 'error' ? RED : '#16A34A', color: WHITE, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
      {message}
    </div>
  )
}

// ─── Modal detail (mobile/tablet) ─────────────────────────────────────────────

function DetailModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', marginTop: 'auto', background: WHITE, borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 32px' }}>
        <button type="button" onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: SAND, border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} color={CHARCOAL} />
        </button>
        {children}
      </div>
    </div>
  )
}

// ─── Onglet Dashboard ─────────────────────────────────────────────────────────

function DashboardTab({ stats, loading, onRefresh, onTabChange, isMobile }: { stats: Stats | null; loading: boolean; onRefresh: () => void; onTabChange: (tab: Tab) => void; isMobile: boolean }) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [finance, setFinance] = useState<{ summary: any; chart: any[] } | null>(null)
  const [financeLoading, setFinanceLoading] = useState(true)

  const loadFinance = async (p: string) => {
    setFinanceLoading(true)
    try {
      const res = await api.get(`/admin/finance?period=${p}`)
      setFinance({ summary: res.data.summary, chart: res.data.chart })
    } finally { setFinanceLoading(false) }
  }

  useEffect(() => { loadFinance(period) }, [period])

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) return <p style={{ color: TAUPE, padding: 32 }}>Chargement...</p>
  if (!stats) return null

  const serviceFeePercent = finance
    ? ((finance.summary.service_fee_sender_percent ?? 0) + (finance.summary.service_fee_carrier_percent ?? 0))
    : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Vue d'ensemble</h2>
        <button type="button" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 12, color: TAUPE, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* Stat cards — grid 2 colonnes sur mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="Utilisateurs" value={stats.total_users} onClick={() => onTabChange('users')} />
        <StatCard label="Trajets" value={stats.total_trips} />
        <StatCard label="Bookings" value={stats.total_bookings} />
        <StatCard label="Litiges ouverts" value={stats.open_disputes} color={stats.open_disputes > 0 ? RED : CHARCOAL} onClick={() => onTabChange('disputes')} />
        <StatCard label="KYC en attente" value={stats.kyc_pending} color={stats.kyc_pending > 0 ? '#EA580C' : CHARCOAL} onClick={() => onTabChange('kyc')} />
      </div>

      {/* Filtre periode */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, margin: 0 }}>CA & Frais de service</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${period === p ? RED : BORDER}`, background: period === p ? 'rgba(220,0,41,0.06)' : WHITE, color: period === p ? RED : CHARCOAL2, fontSize: 11, fontWeight: period === p ? 600 : 400, cursor: 'pointer' }}>
              {p === 'day' ? 'Jour' : p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'Année'}
            </button>
          ))}
        </div>
      </div>

      {financeLoading ? <p style={{ color: TAUPE, fontSize: 13 }}>Chargement...</p> : finance && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="CA livré" value={`${fmt(finance.summary.total_revenue)} €`} color="#16A34A" onClick={() => onTabChange('finance')} />
            <StatCard label={`Frais (${serviceFeePercent.toFixed(0)}%)`} value={`${fmt(finance.summary.total_fees)} €`} color="#2563EB" onClick={() => onTabChange('finance')} />
            <StatCard label="En cours" value={`${fmt(finance.summary.total_in_progress)} €`} color="#EA580C" onClick={() => onTabChange('finance')} />
            <StatCard label="Bloquées" value={`${fmt(finance.summary.total_blocked)} €`} color={finance.summary.total_blocked > 0 ? RED : CHARCOAL} onClick={() => onTabChange('disputes')} />
          </div>

          {finance.chart.length > 0 ? (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 16px' }}>Évolution CA & frais</p>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
                <LineChart data={finance.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: TAUPE }} />
                  <YAxis tick={{ fontSize: 10, fill: TAUPE }} width={40} />
                  <Tooltip formatter={(v: any) => `${fmt(Number(v))} €`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="CA" stroke="#16A34A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fees" name="Frais" stroke="#2563EB" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: TAUPE, margin: 0 }}>Aucune transaction livrée sur cette période</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Onglet Utilisateurs ──────────────────────────────────────────────────────

function UsersTab({ onToast, isMobile }: { onToast: (msg: string, type: 'success' | 'error') => void; isMobile: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleAdmin = async (user: AdminUser) => {
    try {
      await api.patch(`/admin/users/${user.id}/toggle-admin`)
      setUsers(u => u.map(x => x.id === user.id ? { ...x, is_admin: !x.is_admin } : x))
      onToast(`Rôle admin ${user.is_admin ? 'retiré' : 'accordé'} à ${user.full_name}`, 'success')
    } catch { onToast('Erreur', 'error') }
  }

  const banUser = async (user: AdminUser) => {
    try {
      const res = await api.patch(`/admin/users/${user.id}/ban`)
      setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: res.data.is_active } : x))
      onToast(`${user.full_name} ${res.data.is_active ? 'réactivé' : 'banni'}`, 'success')
    } catch { onToast('Erreur', 'error') }
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  // Colonnes selon breakpoint
  const cols = isMobile
    ? ['Nom', 'KYC', 'Statut', 'Actions']
    : ['Nom', 'Email', 'Username', 'KYC', 'Trust', 'Statut', 'Admin', 'Actions']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Utilisateurs ({users.length})</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', width: isMobile ? '100%' : 220 }} />
      </div>
      {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 'unset' : 700 }}>
            <thead>
              <tr style={{ background: SAND }}>
                {cols.map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${SAND}`, background: i % 2 === 0 ? WHITE : 'rgba(240,237,232,0.3)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: CHARCOAL, whiteSpace: 'nowrap' }}>{u.full_name}</td>
                  {!isMobile && <td style={{ padding: '10px 12px', fontSize: 12, color: TAUPE, whiteSpace: 'nowrap' }}>{u.email}</td>}
                  {!isMobile && <td style={{ padding: '10px 12px', fontSize: 12, color: TAUPE }}>{u.username ? `@${u.username}` : '—'}</td>}
                  <td style={{ padding: '10px 12px' }}><Badge status={u.kyc_status} /></td>
                  {!isMobile && <td style={{ padding: '10px 12px', fontSize: 13, color: CHARCOAL }}>{u.trust_score.toFixed(0)}</td>}
                  {/* Colonne statut actif/banni */}
                  <td style={{ padding: '10px 12px' }}>
                    {u.is_active === false
                      ? <span style={{ background: '#FEF2F2', color: RED, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Banni</span>
                      : <span style={{ background: '#ECFDF5', color: '#16A34A', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Actif</span>
                    }
                  </td>
                  {!isMobile && (
                    <td style={{ padding: '10px 12px' }}>
                      {u.is_admin && <span style={{ background: '#EFF6FF', color: '#2563EB', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Admin</span>}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => toggleAdmin(u)} title={u.is_admin ? 'Retirer admin' : 'Passer admin'}
                        style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <Shield size={12} color={u.is_admin ? RED : '#2563EB'} />
                        {!isMobile && (u.is_admin ? 'Retirer' : 'Admin')}
                      </button>
                      <button type="button" onClick={() => banUser(u)} title="Bannir / Réactiver"
                        style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <Ban size={12} color={RED} />
                        {!isMobile && 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Onglet KYC ───────────────────────────────────────────────────────────────

function KycTab({ onToast, isMobile }: { onToast: (msg: string, type: 'success' | 'error') => void; isMobile: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users/kyc-pending')
      setUsers(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const updateKyc = async (userId: string, decision: 'approved' | 'rejected') => {
    try {
      await api.patch(`/admin/users/${userId}/kyc`, { decision })
      setUsers(u => u.filter(x => x.id !== userId))
      setSelected(null)
      onToast(`KYC ${decision === 'approved' ? 'approuvé' : 'rejeté'}`, 'success')
    } catch { onToast('Erreur', 'error') }
  }

  const DetailPanel = ({ u }: { u: AdminUser }) => (
    <>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>{u.full_name}</h3>
      <p style={{ fontSize: 12, color: TAUPE, margin: '0 0 16px' }}>{u.email}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pièce d\'identité — Recto', url: u.id_front },
          { label: 'Pièce d\'identité — Verso', url: u.id_back },
          { label: 'Selfie', url: u.selfie },
        ].map(({ label, url }) => (
          <div key={label}>
            <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                <img src={url} alt={label} style={{ width: '100%', borderRadius: 10, border: `1px solid ${BORDER}`, objectFit: 'cover', maxHeight: 160, cursor: 'pointer' }} />
              </a>
            ) : (
              <div style={{ width: '100%', height: 80, borderRadius: 10, border: `2px dashed ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: TAUPE, margin: 0 }}>Non fourni</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => updateKyc(u.id, 'approved')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: '#16A34A', color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={14} /> Approuver
        </button>
        <button type="button" onClick={() => updateKyc(u.id, 'rejected')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <XCircle size={14} /> Rejeter
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: isMobile ? 'block' : 'flex', gap: 20 }}>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, marginBottom: 20 }}>KYC en attente ({users.length})</h2>
        {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : users.length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <CheckCircle size={40} color="#16A34A" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, color: TAUPE, margin: 0 }}>Aucun KYC en attente</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <div key={u.id} onClick={() => setSelected(u)}
                style={{ background: WHITE, border: `1px solid ${selected?.id === u.id ? RED : BORDER}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{u.full_name}</p>
                    <p style={{ fontSize: 12, color: TAUPE, margin: '2px 0 0' }}>{u.email}</p>
                    <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0' }}>Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Badge status={u.kyc_status} />
                    <span style={{ fontSize: 11, color: u.id_front || u.id_back || u.selfie ? '#16A34A' : TAUPE, fontWeight: 600 }}>
                      {u.id_front || u.id_back || u.selfie ? 'Documents uploadés' : 'Aucun document'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop : panneau latéral */}
      {!isMobile && selected && (
        <div style={{ width: 360, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, height: 'fit-content', position: 'sticky', top: 24 }}>
          <DetailPanel u={selected} />
        </div>
      )}

      {/* Mobile/Tablet : modal full-screen */}
      {isMobile && selected && (
        <DetailModal onClose={() => setSelected(null)}>
          <DetailPanel u={selected} />
        </DetailModal>
      )}
    </div>
  )
}

// ─── Onglet Finance ───────────────────────────────────────────────────────────

interface ChartPoint {
  label: string
  revenue: number
  fees: number
  count: number
}

function FinanceTab({ isMobile }: { isMobile: boolean }) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [txPage, setTxPage] = useState(0)
  const TX_PER_PAGE = 20

  const load = async (p: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/finance?period=${p}`)
      setData(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load(period) }, [period])

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const resume = [
      ['— REVENUS KIPAR —'],
      ['Ligne', 'Montant (€)', 'Catégorie'],
      ['Commissions expéditeur (15%)', data.revenue_breakdown.commissions_sender, 'Ordinaire'],
      ['Commissions transporteur (2%)', data.revenue_breakdown.commissions_carrier, 'Ordinaire'],
      ['Frais de dossier (1.50€/booking)', data.revenue_breakdown.flat_fees, 'Ordinaire'],
      ['Frais de litige', data.revenue_breakdown.dispute_fees, 'Occasionnel'],
      ['Frais annulation transporteur', data.revenue_breakdown.cancel_fees, 'Occasionnel'],
      ['TOTAL REVENUS KIPAR', data.revenue_breakdown.total, ''],
      [],
      ['— ESCROW —'],
      ['Montant détenu (actif)', data.escrow.held, ''],
      ['Transactions actives', data.escrow.count_active, ''],
      ['Remboursements intégraux', data.escrow.refunded_full_amount, `${data.escrow.refunded_full_count} transactions`],
      ['Remboursements partiels (50%)', data.escrow.refunded_partial_amount, `${data.escrow.refunded_partial_count} transactions`],
      ['Annulations sans remboursement', data.escrow.no_refund_amount, `${data.escrow.no_refund_count} transactions`],
      [],
      ['— ASSURANCE (TRANSIT) —'],
      ['Primes collectées (à reverser assureur)', data.insurance_transit.collected, `${data.insurance_transit.count} dossiers`],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resume), 'Résumé')
    const chartRows = [['Période', 'CA (€)', 'Frais (€)', 'Nb transactions'], ...data.chart.map((r: any) => [r.label, r.revenue, r.fees, r.count])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chartRows), 'Évolution')
    const txRows = [
      ['ID', 'Date', 'Statut', 'Montant (€)', 'Commission (€)', 'Frais dossier (€)', 'Assurance (€)', 'Rail', 'Devise', 'Origine', 'Destination', 'Départ', 'Vol', 'Expéditeur', 'Email exp.', 'Transporteur', 'Email transp.', 'Contenu', 'Poids (kg)', 'Valeur déclarée (€)'],
      ...(data.transactions || []).map((t: any) => [t.id, fmtDate(t.date), t.status, t.amount, t.commission, t.flat_fee, t.insurance_amount, t.payment_rail || '', t.currency, t.origin || '', t.destination || '', t.departure_date ? fmtDate(t.departure_date) : '', t.flight_number || '', t.sender || '', t.sender_email || '', t.carrier || '', t.carrier_email || '', t.content_description || '', t.weight_kg || '', t.declared_value || ''])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Transactions')
    XLSX.writeFile(wb, `kipar_finance_${period}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const summary = data?.summary
  const breakdown = data?.revenue_breakdown
  const escrow = data?.escrow
  const insurance = data?.insurance_transit
  const transactions: any[] = data?.transactions || []
  const chart: ChartPoint[] = data?.chart || []
  const txSlice = transactions.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE)

  const STATUS_COLOR: Record<string, string> = {
    delivered: '#16A34A', paid: '#2563EB', in_transit: '#EA580C',
    disputed: RED, refunded: '#6B7280', cancelled: '#6B7280',
    cancelled_by_sender: '#6B7280', cancelled_by_carrier: '#6B7280',
    pending: TAUPE, accepted: '#2563EB',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Finance</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${period === p ? RED : BORDER}`, background: period === p ? 'rgba(220,0,41,0.06)' : WHITE, color: period === p ? RED : CHARCOAL2, fontSize: 12, fontWeight: period === p ? 600 : 400, cursor: 'pointer' }}>
              {p === 'day' ? 'Jour' : p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'Année'}
            </button>
          ))}
          {data && (
            <button type="button" onClick={exportExcel}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid #16A34A`, background: '#ECFDF5', color: '#16A34A', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⬇ Excel
            </button>
          )}
        </div>
      </div>

      {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : data && (
        <>
          {/* Revenus Kipar */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenus Kipar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Commissions expéditeur (15%)', value: breakdown?.commissions_sender ?? 0, tag: 'Ordinaire', color: '#16A34A' },
                { label: 'Commissions transporteur (2%)', value: breakdown?.commissions_carrier ?? 0, tag: 'Ordinaire', color: '#16A34A' },
                { label: `Frais de dossier (${summary?.booking_flat_fee ?? 1.5}€ × ${summary?.flat_fee_count ?? 0})`, value: breakdown?.flat_fees ?? 0, tag: 'Ordinaire', color: '#16A34A' },
                { label: 'Frais de litige', value: breakdown?.dispute_fees ?? 0, tag: 'Occasionnel', color: '#EA580C' },
                { label: 'Frais annulation transporteur', value: breakdown?.cancel_fees ?? 0, tag: 'Occasionnel', color: '#EA580C' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: i % 2 === 0 ? SAND : WHITE, borderRadius: 8, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    <span style={{ fontSize: isMobile ? 12 : 13, color: CHARCOAL, fontWeight: 500 }}>{row.label}</span>
                    {!isMobile && <span style={{ fontSize: 10, fontWeight: 700, color: row.color, background: row.color + '18', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{row.tag}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.value > 0 ? row.color : TAUPE, whiteSpace: 'nowrap' }}>{fmt(row.value)} €</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: CHARCOAL, borderRadius: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>TOTAL</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#4ADE80' }}>{fmt(breakdown?.total ?? 0)} €</span>
              </div>
            </div>
          </div>

          {/* Escrow */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escrow & Remboursements</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <StatCard label="Détenu (actif)" value={`${fmt(escrow?.held ?? 0)} €`} color="#2563EB" />
              <StatCard label="Tx actives" value={escrow?.count_active ?? 0} color="#2563EB" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Remboursements intégraux', amount: escrow?.refunded_full_amount ?? 0, count: escrow?.refunded_full_count ?? 0, color: '#16A34A' },
                { label: 'Remboursements partiels 50%', amount: escrow?.refunded_partial_amount ?? 0, count: escrow?.refunded_partial_count ?? 0, color: '#EA580C' },
                { label: 'Annulations sans remboursement', amount: escrow?.no_refund_amount ?? 0, count: escrow?.no_refund_count ?? 0, color: RED },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: SAND, borderRadius: 8, gap: 8 }}>
                  <span style={{ fontSize: 12, color: CHARCOAL, flex: 1 }}>{row.label} <span style={{ color: TAUPE }}>({row.count})</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color, whiteSpace: 'nowrap' }}>{fmt(row.amount)} €</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assurance */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assurance (Flux transit)</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA', gap: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: 0 }}>Primes collectées</p>
                <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>{insurance?.count ?? 0} dossier(s)</p>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#92400E', whiteSpace: 'nowrap' }}>{fmt(insurance?.collected ?? 0)} €</span>
            </div>
          </div>

          {/* Graphiques */}
          {chart.length > 0 && (
            <>
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 16px' }}>Évolution CA & frais</p>
                <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: TAUPE }} />
                    <YAxis tick={{ fontSize: 10, fill: TAUPE }} width={40} />
                    <Tooltip formatter={(v: any) => `${fmt(Number(v))} €`} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="CA" stroke="#16A34A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fees" name="Frais" stroke="#2563EB" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 16px' }}>Transactions livrées</p>
                <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: TAUPE }} />
                    <YAxis tick={{ fontSize: 10, fill: TAUPE }} width={30} />
                    <Tooltip />
                    <Bar dataKey="count" name="Transactions" fill={RED} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Historique transactions */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transactions ({transactions.length})</p>
            {transactions.length === 0 ? (
              <p style={{ color: TAUPE, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune transaction</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: SAND }}>
                        {['Date', 'Statut', 'Expéditeur', 'Transporteur', 'Trajet', 'Poids', 'Montant', 'Commission', 'Rail'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TAUPE, whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txSlice.map((tx: any, i: number) => (
                        <tr key={tx.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? WHITE : SAND }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: TAUPE }}>{fmtDate(tx.date)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[tx.status] ?? TAUPE, background: (STATUS_COLOR[tx.status] ?? TAUPE) + '18', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{tx.status}</span>
                          </td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{tx.sender ?? '—'}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{tx.carrier ?? '—'}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 600 }}>{tx.origin ?? '?'} → {tx.destination ?? '?'}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{tx.weight_kg ? `${tx.weight_kg}kg` : '—'}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: CHARCOAL }}>{fmt(tx.amount)} €</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: tx.commission > 0 ? '#16A34A' : TAUPE }}>{fmt(tx.commission)} €</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: TAUPE }}>{tx.payment_rail ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactions.length > TX_PER_PAGE && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                    <button type="button" onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, color: txPage === 0 ? TAUPE : CHARCOAL, fontSize: 12, cursor: txPage === 0 ? 'not-allowed' : 'pointer' }}>
                      ← Préc.
                    </button>
                    <span style={{ fontSize: 12, color: TAUPE }}>Page {txPage + 1} / {Math.ceil(transactions.length / TX_PER_PAGE)}</span>
                    <button type="button" onClick={() => setTxPage(p => Math.min(Math.ceil(transactions.length / TX_PER_PAGE) - 1, p + 1))} disabled={(txPage + 1) * TX_PER_PAGE >= transactions.length}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, color: (txPage + 1) * TX_PER_PAGE >= transactions.length ? TAUPE : CHARCOAL, fontSize: 12, cursor: (txPage + 1) * TX_PER_PAGE >= transactions.length ? 'not-allowed' : 'pointer' }}>
                      Suiv. →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Onglet Litiges ───────────────────────────────────────────────────────────

function DisputesTab({ onToast, isMobile }: { onToast: (msg: string, type: 'success' | 'error') => void; isMobile: boolean }) {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DisputeDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resolution, setResolution] = useState('')
  const [resolving, setResolving] = useState(false)

  const INCIDENT_LABELS: Record<string, string> = {
    pickup_failed: 'Non remis', delivery_failed: 'Non livré',
    damaged: 'Endommagé', lost: 'Perdu', wrong_content: 'Mauvais contenu', other: 'Autre',
  }
  const STAGE_LABELS: Record<string, string> = {
    pickup: 'À la remise', transit: 'En transit', delivery: 'À la livraison',
  }
  const ROLE_LABELS: Record<string, string> = {
    sender: 'Expéditeur', carrier: 'Transporteur', receiver: 'Récepteur',
  }

  const load = async () => {
    setLoading(true)
    try { const res = await api.get('/admin/disputes'); setDisputes(res.data) }
    finally { setLoading(false) }
  }

  const loadDetail = async (id: string) => {
    setLoadingDetail(true)
    try { const res = await api.get(`/admin/disputes/${id}`); setSelected(res.data) }
    catch { onToast('Erreur chargement detail', 'error') }
    finally { setLoadingDetail(false) }
  }

  useEffect(() => { load() }, [])

  const resolve = async (decision: 'resolved_sender' | 'resolved_carrier' | 'split') => {
    if (!selected || !resolution.trim()) return
    setResolving(true)
    try {
      await api.patch(`/admin/disputes/${selected.id}/resolve`, { decision, resolution })
      setDisputes(d => d.map(x => x.id === selected.id ? { ...x, status: decision } : x))
      setSelected(s => s ? { ...s, status: decision, resolution } : s)
      onToast('Litige résolu', 'success')
      setResolution('')
    } catch { onToast('Erreur', 'error') }
    finally { setResolving(false) }
  }

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => !value ? null : (
    <div style={{ marginBottom: 6 }}>
      <p style={{ fontSize: 11, color: TAUPE, margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 13, color: CHARCOAL, margin: '2px 0 0' }}>{value}</p>
    </div>
  )

  const PartyBlock = ({ label, party, accent }: { label: string; party: DisputeParty | null; accent?: string }) => !party ? null : (
    <div style={{ background: accent ? '#FFF8F8' : '#F8F9FF', border: `1px solid ${accent || '#E0E7FF'}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
      <p style={{ fontSize: 11, color: accent || '#3B5BDB', margin: '0 0 5px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 2px' }}>{party.full_name}</p>
      <p style={{ fontSize: 12, color: TAUPE, margin: 0 }}>{party.email}{party.phone ? ` · ${party.phone}` : ''}</p>
      {party.address && <p style={{ fontSize: 12, color: TAUPE, margin: '2px 0 0' }}>{party.address}</p>}
      <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0' }}>KiparTrust : {(party.trust_score || 0).toFixed(0)}/100</p>
    </div>
  )

  const DetailContent = ({ d }: { d: DisputeDetail }) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Détail du litige</h3>
        <button type='button' onClick={async () => {
          try {
            const token = useAuthStore.getState().token
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/disputes/${d.id}/export-pdf`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) { const err = await res.text(); onToast('Erreur: ' + err, 'error'); return }
            const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `kipar_litige_${d.id.slice(0,8).toUpperCase()}.pdf`
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          } catch { onToast('Erreur export PDF', 'error') }
        }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: WHITE, background: RED, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge status={d.status} />
        {d.incident_type && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{INCIDENT_LABELS[d.incident_type]}</span>}
        {d.incident_stage && <span style={{ fontSize: 11, background: '#EEF2FF', color: '#3730A3', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{STAGE_LABELS[d.incident_stage]}</span>}
        {d.has_insurance && <span style={{ fontSize: 11, background: '#ECFDF5', color: '#065F46', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>Assuré</span>}
      </div>

      <PartyBlock label={`Déclarant — ${ROLE_LABELS[d.initiated_by_role] || d.initiated_by_role}`} party={d.initiator} accent={RED} />
      {d.initiated_by_role !== 'sender' && <PartyBlock label="Expéditeur" party={d.sender} />}
      {d.initiated_by_role !== 'carrier' && <PartyBlock label="Transporteur" party={d.carrier} />}
      {d.initiated_by_role !== 'receiver' && d.receiver && <PartyBlock label="Récepteur" party={d.receiver} />}

      {d.booking && (
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase' }}>Booking</p>
          <InfoRow label="Montant" value={`${d.booking.amount} ${d.booking.currency}`} />
          <InfoRow label="Statut" value={d.booking.status} />
          {d.trip && <InfoRow label="Corridor" value={`${d.trip.origin} → ${d.trip.destination}`} />}
          {d.trip?.departure_date && <InfoRow label="Départ" value={new Date(d.trip.departure_date).toLocaleDateString('fr-FR')} />}
        </div>
      )}

      {d.package && (
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase' }}>Colis</p>
          <InfoRow label="Description" value={d.package.content_description} />
          <InfoRow label="Valeur déclarée" value={d.package.declared_value ? `${d.package.declared_value} EUR` : null} />
          <InfoRow label="Poids" value={`${d.package.weight_kg} kg`} />
          {d.package.photo_urls?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {d.package.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Motif déclarant</p>
        <p style={{ fontSize: 13, color: CHARCOAL, margin: 0, lineHeight: 1.5 }}>{d.reason}</p>
      </div>

      {d.evidence_urls?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Photos déclarant</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.evidence_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {d.respondent_comment && (
        <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: '#3730A3', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Réponse partie adverse</p>
          <p style={{ fontSize: 13, color: CHARCOAL, margin: 0 }}>{d.respondent_comment}</p>
        </div>
      )}

      <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase' }}>Timeline</p>
        <InfoRow label="Litige créé" value={new Date(d.timeline.created_at).toLocaleString('fr-FR')} />
        {d.timeline.resolved_at && <InfoRow label="Résolu le" value={new Date(d.timeline.resolved_at).toLocaleString('fr-FR')} />}
      </div>

      {d.status === 'open' && (
        <>
          <textarea value={resolution} onChange={e => setResolution(e.target.value)}
            placeholder="Résolution (obligatoire)..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, color: CHARCOAL, resize: 'vertical', minHeight: 80, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={() => resolve('resolved_sender')} disabled={resolving || !resolution.trim()}
              style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', background: '#16A34A', color: WHITE, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !resolution.trim() ? 0.5 : 1 }}>
              Expéditeur
            </button>
            <button type="button" onClick={() => resolve('resolved_carrier')} disabled={resolving || !resolution.trim()}
              style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !resolution.trim() ? 0.5 : 1 }}>
              Transporteur
            </button>
            <button type="button" onClick={() => resolve('split')} disabled={resolving || !resolution.trim()}
              style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', background: '#F59E0B', color: WHITE, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !resolution.trim() ? 0.5 : 1 }}>
              Partage
            </button>
          </div>
        </>
      )}
      {d.resolution && (
        <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontSize: 11, color: '#166534', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Résolution</p>
          <p style={{ fontSize: 13, color: CHARCOAL, margin: 0 }}>{d.resolution}</p>
        </div>
      )}
    </>
  )

  return (
    <div style={{ display: isMobile ? 'block' : 'flex', gap: 20 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, marginBottom: 20 }}>Litiges ({disputes.length})</h2>
        {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {disputes.map(d => (
              <div key={d.id} onClick={() => loadDetail(d.id)}
                style={{ background: WHITE, border: `1px solid ${selected?.id === d.id ? RED : BORDER}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Badge status={d.status} />
                    {d.incident_type && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 7px', fontWeight: 500 }}>{INCIDENT_LABELS[d.incident_type] || d.incident_type}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: TAUPE, whiteSpace: 'nowrap' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <p style={{ fontSize: 13, color: CHARCOAL, margin: 0 }}>{d.reason.slice(0, 80)}{d.reason.length > 80 ? '...' : ''}</p>
                {d.booking?.amount && <p style={{ fontSize: 12, color: TAUPE, margin: '4px 0 0' }}>{d.booking.amount} {d.booking.currency || 'EUR'}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop : panneau latéral */}
      {!isMobile && (selected || loadingDetail) && (
        <div style={{ width: 380, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, height: 'fit-content', position: 'sticky', top: 24, maxHeight: '90vh', overflowY: 'auto' }}>
          {loadingDetail && !selected ? <p style={{ color: TAUPE }}>Chargement...</p> : selected && <DetailContent d={selected} />}
        </div>
      )}

      {/* Mobile/Tablet : modal */}
      {isMobile && selected && (
        <DetailModal onClose={() => setSelected(null)}>
          <DetailContent d={selected} />
        </DetailModal>
      )}
    </div>
  )
}

// ─── Onglet Validations ───────────────────────────────────────────────────────

function ValidationsTab({ onToast, isMobile }: { onToast: (msg: string, type: 'success' | 'error') => void; isMobile: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    setLoading(true)
    try { const res = await api.get('/admin/pending-validations'); setItems(res.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    setProcessing(id)
    try { await api.patch(`/admin/pending-validations/${id}/approve`); onToast('Livraison validée', 'success'); load() }
    catch { onToast('Erreur', 'error') }
    finally { setProcessing(null) }
  }

  const reject = async () => {
    if (!rejectId) return
    setProcessing(rejectId)
    try {
      await api.patch(`/admin/pending-validations/${rejectId}/reject`, { reason: rejectReason || 'Preuve insuffisante' })
      onToast('Litige ouvert', 'success'); setRejectId(null); setRejectReason(''); load()
    } catch { onToast('Erreur', 'error') }
    finally { setProcessing(null) }
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Validations en attente</h2>
        <button type="button" onClick={load} style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: CHARCOAL2, fontSize: 12, cursor: 'pointer' }}>
          Rafraîchir
        </button>
      </div>
      {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : items.length === 0 ? (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <CheckCircle size={32} color="#16A34A" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: TAUPE, margin: 0 }}>Aucune validation en attente</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item: any) => (
            <div key={item.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: '0 0 4px' }}>
                    {item.origin} → {item.destination} · {item.amount?.toFixed(2)} {item.currency}
                  </p>
                  <p style={{ fontSize: 12, color: TAUPE, margin: '0 0 2px' }}>{item.sender} ({item.sender_email})</p>
                  <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>{fmtDate(item.created_at)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.proof_url && (
                    <a href={item.proof_url} target="_blank" rel="noreferrer"
                      style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: CHARCOAL2, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      Preuve
                    </a>
                  )}
                  <button type="button" onClick={() => approve(item.id)} disabled={processing === item.id}
                    style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: '#16A34A', color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: processing === item.id ? 0.5 : 1 }}>
                    Valider
                  </button>
                  <button type="button" onClick={() => { setRejectId(item.id); setRejectReason('') }} disabled={processing === item.id}
                    style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${RED}`, background: WHITE, color: RED, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: processing === item.id ? 0.5 : 1 }}>
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: '0 0 16px' }}>Motif de rejet</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Preuve insuffisante..."
              style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setRejectId(null)}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: CHARCOAL2, fontSize: 13, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="button" onClick={reject} disabled={!!processing}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: processing ? 0.5 : 1 }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Configuration Assurance ────────────────────────────────────────────

function InsuranceConfigTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [config, setConfig] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    api.get('/insurance/config').then(r => { setConfig(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await api.patch('/insurance/config', {
        rate_type: config.rate_type,
        rate_value: parseFloat(config.rate_value),
        min_premium: parseFloat(config.min_premium),
        max_coverage: parseFloat(config.max_coverage),
        partner_name: config.partner_name || null,
      })
      setConfig(res.data)
      onToast('Configuration sauvegardée', 'success')
    } catch { onToast('Erreur', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: TAUPE, padding: 32 }}>Chargement...</p>
  if (!config) return null

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, display: 'block' as const }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: config.enabled ? '#ECFDF5' : '#FFF7ED', border: '1px solid ' + (config.enabled ? '#86EFAC' : '#FED7AA'), borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: config.enabled ? GREEN : AMBER, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, margin: 0 }}>{config.enabled ? 'Assurance ACTIVE' : 'Assurance INACTIVE'}</p>
          <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{config.enabled ? 'Les clients peuvent souscrire une assurance' : 'Activer via INSURANCE_ENABLED=True dans .env'}</p>
        </div>
      </div>
      <div style={{ background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={labelStyle}>Partenaire assureur</label><input style={inputStyle} value={config.partner_name || ''} onChange={e => setConfig({ ...config, partner_name: e.target.value })} placeholder="Ex: AXA, Allianz..." /></div>
        <div>
          <label style={labelStyle}>Type de tarif</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['percent', 'fixed'].map(t => (
              <button key={t} type="button" onClick={() => setConfig({ ...config, rate_type: t })}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid ' + (config.rate_type === t ? RED : BORDER), background: config.rate_type === t ? 'rgba(220,0,41,0.06)' : WHITE, color: config.rate_type === t ? RED : CHARCOAL, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t === 'percent' ? '% valeur déclarée' : 'Montant fixe'}
              </button>
            ))}
          </div>
        </div>
        <div><label style={labelStyle}>{config.rate_type === 'percent' ? 'Taux (ex: 0.03 = 3%)' : 'Montant fixe (€)'}</label><input style={inputStyle} type="number" step="0.01" value={config.rate_value} onChange={e => setConfig({ ...config, rate_value: e.target.value })} /></div>
        <div><label style={labelStyle}>Prime minimum (€)</label><input style={inputStyle} type="number" step="0.5" value={config.min_premium} onChange={e => setConfig({ ...config, min_premium: e.target.value })} /></div>
        <div><label style={labelStyle}>Couverture maximum (€)</label><input style={inputStyle} type="number" step="100" value={config.max_coverage} onChange={e => setConfig({ ...config, max_coverage: e.target.value })} /></div>
        <button type="button" onClick={handleSave} disabled={saving}
          style={{ padding: '10px 20px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-end' }}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isMobile, isTablet } = useResponsive()
  const isCompact = isMobile || isTablet

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  // Fermer drawer au changement d'onglet sur mobile
  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (isCompact) setDrawerOpen(false)
  }

  const SIDEBAR_W = 220

  const navItems: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard',   icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { id: 'users',       icon: <Users size={18} />,           label: 'Utilisateurs' },
    { id: 'kyc',         icon: <ShieldCheck size={18} />,     label: 'KYC' },
    { id: 'disputes',    icon: <AlertTriangle size={18} />,   label: 'Litiges' },
    { id: 'finance',     icon: <TrendingUp size={18} />,      label: 'Finance' },
    { id: 'insurance',   icon: <Umbrella size={18} />,        label: 'Assurance' },
    { id: 'validations', icon: <ClipboardCheck size={18} />,  label: 'Validations' },
  ]

  const SidebarContent = () => (
    <>
      <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${BORDER}`, marginBottom: 12 }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: RED, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>KIPAR.</p>
        <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>Administration</p>
      </div>
      {navItems.map(item => (
        <button key={item.id} type="button" onClick={() => handleTabChange(item.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: tab === item.id ? SAND : 'transparent', border: 'none', borderLeft: tab === item.id ? `3px solid ${RED}` : '3px solid transparent', color: tab === item.id ? RED : CHARCOAL2, fontSize: 13, fontWeight: tab === item.id ? 600 : 400, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          {item.icon}
          {item.label}
          {item.id === 'disputes' && stats && stats.open_disputes > 0 && (
            <span style={{ marginLeft: 'auto', background: RED, color: WHITE, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{stats.open_disputes}</span>
          )}
          {item.id === 'kyc' && stats && stats.kyc_pending > 0 && (
            <span style={{ marginLeft: 'auto', background: '#EA580C', color: WHITE, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{stats.kyc_pending}</span>
          )}
        </button>
      ))}
      <div style={{ marginTop: 'auto', padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Link href='/dashboard'
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, color: CHARCOAL2, fontSize: 12, textDecoration: 'none' }}>
          <ChevronLeft size={14} /> Retour au dashboard
        </Link>
        <button type='button' onClick={() => { useAuthStore.getState().logout(); window.location.href = '/login' }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, color: RED, fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: SAND }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Sidebar desktop ── */}
      {!isCompact && (
        <nav style={{ width: SIDEBAR_W, background: WHITE, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', padding: '24px 0', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
          <SidebarContent />
        </nav>
      )}

      {/* ── Drawer mobile/tablet ── */}
      {isCompact && (
        <>
          {/* Overlay */}
          {drawerOpen && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 150 }}
              onClick={() => setDrawerOpen(false)}
            />
          )}
          {/* Drawer panel */}
          <nav style={{
            position: 'fixed', top: 0, left: 0, height: '100vh',
            width: SIDEBAR_W, background: WHITE,
            borderRight: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column',
            padding: '24px 0',
            transform: drawerOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
            transition: 'transform 0.25s ease',
            zIndex: 200,
          }}>
            <SidebarContent />
          </nav>
        </>
      )}

      {/* ── Header mobile fixe ── */}
      {isCompact && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56,
          background: WHITE, borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 100,
        }}>
          <button type="button" onClick={() => setDrawerOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            {drawerOpen ? <X size={22} color={CHARCOAL} /> : <Menu size={22} color={CHARCOAL} />}
          </button>
          <p style={{ fontSize: 18, fontWeight: 800, color: RED, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>KIPAR.</p>
          {/* Badge litiges ouverts sur mobile */}
          <div style={{ width: 32, display: 'flex', justifyContent: 'flex-end' }}>
            {stats && stats.open_disputes > 0 && (
              <span style={{ background: RED, color: WHITE, borderRadius: 99, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{stats.open_disputes}</span>
            )}
          </div>
        </header>
      )}

      {/* ── Main content ── */}
      <main style={{
        marginLeft: isCompact ? 0 : SIDEBAR_W,
        flex: 1,
        padding: isCompact ? '72px 16px 32px' : '32px 32px',
        maxWidth: isCompact ? '100vw' : `calc(100vw - ${SIDEBAR_W}px)`,
        boxSizing: 'border-box',
      }}>
        {tab === 'dashboard'   && <DashboardTab stats={stats} loading={!stats} onRefresh={() => api.get('/admin/stats').then(r => setStats(r.data))} onTabChange={handleTabChange} isMobile={isCompact} />}
        {tab === 'users'       && <UsersTab onToast={showToast} isMobile={isCompact} />}
        {tab === 'kyc'         && <KycTab onToast={showToast} isMobile={isCompact} />}
        {tab === 'disputes'    && <DisputesTab onToast={showToast} isMobile={isCompact} />}
        {tab === 'finance'     && <FinanceTab isMobile={isCompact} />}
        {tab === 'validations' && <ValidationsTab onToast={showToast} isMobile={isCompact} />}
        {tab === 'insurance'   && <InsuranceConfigTab onToast={showToast} />}
      </main>
    </div>
  )
}
