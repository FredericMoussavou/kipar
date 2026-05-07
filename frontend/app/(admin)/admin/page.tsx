'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, ShieldCheck, AlertTriangle,
  CheckCircle, XCircle, Ban, Shield, ChevronRight,
  LogOut, RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import api from '@/lib/api'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN } from '@/lib/theme'

type Tab = 'dashboard' | 'users' | 'kyc' | 'disputes'

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
  trust_score: number
  created_at: string
  is_active?: boolean
}

interface Dispute {
  id: string
  booking_id: string
  status: string
  reason: string
  resolution: string | null
  created_at: string
  resolved_at: string | null
  booking_status: string | null
  amount: number | null
  initiated_by?: string
  sender?: string
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', flex: 1, minWidth: 160 }}>
      <p style={{ fontSize: 12, color: TAUPE, margin: 0, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: color ?? CHARCOAL, margin: 0, fontFamily: 'var(--font-syne,Syne)' }}>{value}</p>
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
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
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: type === 'error' ? RED : '#16A34A', color: WHITE, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      {message}
    </div>
  )
}

// ─── Onglet Dashboard ─────────────────────────────────────────────────────────

function DashboardTab({ stats, loading, onRefresh }: { stats: Stats | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return <p style={{ color: TAUPE, padding: 32 }}>Chargement...</p>
  if (!stats) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Vue d'ensemble</h2>
        <button type="button" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 12, color: TAUPE, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard label="Utilisateurs" value={stats.total_users} />
        <StatCard label="Trajets" value={stats.total_trips} />
        <StatCard label="Bookings" value={stats.total_bookings} />
        <StatCard label="Litiges ouverts" value={stats.open_disputes} color={stats.open_disputes > 0 ? RED : CHARCOAL} />
        <StatCard label="KYC en attente" value={stats.kyc_pending} color={stats.kyc_pending > 0 ? '#EA580C' : CHARCOAL} />
        <StatCard label="CA livré" value={`${stats.total_revenue.toLocaleString('fr-FR')} €`} color="#16A34A" />
      </div>
    </div>
  )
}

// ─── Onglet Utilisateurs ──────────────────────────────────────────────────────

function UsersTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, margin: 0 }}>Utilisateurs ({users.length})</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', width: 220 }} />
      </div>
      {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: SAND }}>
                {['Nom', 'Email', 'Username', 'KYC', 'Trust', 'Admin', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TAUPE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${SAND}`, background: i % 2 === 0 ? WHITE : 'rgba(240,237,232,0.3)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{u.full_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: TAUPE }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: TAUPE }}>{u.username ? `@${u.username}` : '—'}</td>
                  <td style={{ padding: '12px 16px' }}><Badge status={u.kyc_status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: CHARCOAL }}>{u.trust_score.toFixed(0)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.is_admin && <span style={{ background: '#EFF6FF', color: '#2563EB', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Admin</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => toggleAdmin(u)} title={u.is_admin ? 'Retirer admin' : 'Passer admin'}
                        style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <Shield size={12} color={u.is_admin ? RED : '#2563EB'} />
                        {u.is_admin ? 'Retirer' : 'Admin'}
                      </button>
                      <button type="button" onClick={() => banUser(u)} title="Bannir / Réactiver"
                        style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <Ban size={12} color={RED} />
                        Ban
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

function KycTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users/kyc-pending')
      setUsers(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const updateKyc = async (userId: string, decision: 'verified' | 'rejected') => {
    try {
      await api.patch(`/admin/users/${userId}/kyc`, { decision })
      setUsers(u => u.filter(x => x.id !== userId))
      onToast(`KYC ${decision === 'verified' ? 'approuvé' : 'rejeté'}`, 'success')
    } catch { onToast('Erreur', 'error') }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 20 }}>KYC en attente ({users.length})</h2>
      {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : users.length === 0 ? (
        <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <CheckCircle size={40} color="#16A34A" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, color: TAUPE, margin: 0 }}>Aucun KYC en attente</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {users.map(u => (
            <div key={u.id} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{u.full_name}</p>
                <p style={{ fontSize: 12, color: TAUPE, margin: '2px 0 0' }}>{u.email}</p>
                <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0' }}>Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => updateKyc(u.id, 'verified')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#16A34A', color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <CheckCircle size={14} /> Approuver
                </button>
                <button type="button" onClick={() => updateKyc(u.id, 'rejected')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <XCircle size={14} /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Litiges ───────────────────────────────────────────────────────────

function DisputesTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolving, setResolving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/disputes')
      setDisputes(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resolve = async (decision: 'resolved_sender' | 'resolved_carrier') => {
    if (!selected || !resolution.trim()) return
    setResolving(true)
    try {
      await api.post(`/admin/disputes/${selected.id}/resolve`, { decision, resolution })
      setDisputes(d => d.map(x => x.id === selected.id ? { ...x, status: decision, resolution } : x))
      onToast('Litige résolu', 'success')
      setSelected(null)
      setResolution('')
    } catch { onToast('Erreur', 'error') }
    finally { setResolving(false) }
  }

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Liste */}
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CHARCOAL, marginBottom: 20 }}>Litiges ({disputes.length})</h2>
        {loading ? <p style={{ color: TAUPE }}>Chargement...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {disputes.map(d => (
              <div key={d.id} onClick={() => setSelected(d)}
                style={{ background: WHITE, border: `1px solid ${selected?.id === d.id ? RED : BORDER}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Badge status={d.status} />
                  <span style={{ fontSize: 11, color: TAUPE }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <p style={{ fontSize: 13, color: CHARCOAL, margin: 0, fontWeight: 500 }}>{d.reason.slice(0, 80)}{d.reason.length > 80 ? '...' : ''}</p>
                {d.amount && <p style={{ fontSize: 12, color: TAUPE, margin: '4px 0 0' }}>{d.amount} €</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Détail */}
      {selected && (
        <div style={{ width: 340, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, height: 'fit-content', position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, marginBottom: 16 }}>Détail du litige</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <div><p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>Statut</p><Badge status={selected.status} /></div>
            <div><p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>Raison</p><p style={{ fontSize: 13, color: CHARCOAL, margin: '2px 0 0' }}>{selected.reason}</p></div>
            {selected.amount && <div><p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>Montant</p><p style={{ fontSize: 13, color: CHARCOAL, margin: '2px 0 0', fontWeight: 600 }}>{selected.amount} €</p></div>}
            {selected.initiated_by && <div><p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>Initié par</p><p style={{ fontSize: 13, color: CHARCOAL, margin: '2px 0 0' }}>{selected.initiated_by}</p></div>}
          </div>

          {selected.status === 'open' && (
            <>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)}
                placeholder="Résolution (obligatoire)..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, color: CHARCOAL, resize: 'vertical', minHeight: 80, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => resolve('resolved_sender')} disabled={resolving || !resolution.trim()}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: '#16A34A', color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !resolution.trim() ? 0.5 : 1 }}>
                  Expéditeur gagne
                </button>
                <button type="button" onClick={() => resolve('resolved_carrier')} disabled={resolving || !resolution.trim()}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !resolution.trim() ? 0.5 : 1 }}>
                  Transporteur gagne
                </button>
              </div>
            </>
          )}
          {selected.resolution && (
            <div style={{ background: SAND, borderRadius: 10, padding: '10px 14px', marginTop: 12 }}>
              <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 4 }}>Résolution</p>
              <p style={{ fontSize: 13, color: CHARCOAL, margin: 0 }}>{selected.resolution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data)
    } finally { setStatsLoading(false) }
  }

  useEffect(() => { loadStats() }, [])

  const navItems: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { id: 'users',     icon: <Users size={18} />,           label: 'Utilisateurs' },
    { id: 'kyc',       icon: <ShieldCheck size={18} />,     label: 'KYC' },
    { id: 'disputes',  icon: <AlertTriangle size={18} />,   label: 'Litiges' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgba(240,237,232,0.4)' }}>

      {/* Sidebar */}
      <aside style={{ width: 240, background: WHITE, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 }}>
        {/* Logo */}
        <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 22, fontWeight: 900, color: CHARCOAL, margin: 0, letterSpacing: '-0.02em' }}>
            KIPAR<span style={{ color: RED }}>.</span>
          </h1>
          <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px' }}>
          {navItems.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: 'none', background: tab === item.id ? 'rgba(220,0,41,0.06)' : 'transparent', color: tab === item.id ? RED : CHARCOAL2, fontSize: 14, fontWeight: tab === item.id ? 600 : 400, cursor: 'pointer', marginBottom: 4, textAlign: 'left', transition: 'all 0.15s' }}>
              <span style={{ color: tab === item.id ? RED : TAUPE }}>{item.icon}</span>
              {item.label}
              {item.id === 'kyc' && stats && stats.kyc_pending > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EA580C', color: WHITE, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{stats.kyc_pending}</span>
              )}
              {item.id === 'disputes' && stats && stats.open_disputes > 0 && (
                <span style={{ marginLeft: 'auto', background: RED, color: WHITE, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{stats.open_disputes}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{user?.first_name} {user?.last_name}</p>
          <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 8px' }}>{user?.email}</p>
          <button type="button" onClick={() => { logout(); router.push('/login') }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', fontSize: 12, color: TAUPE, cursor: 'pointer' }}>
            <LogOut size={13} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main style={{ marginLeft: 240, flex: 1, padding: '32px 40px', minHeight: '100vh' }}>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {tab === 'dashboard' && <DashboardTab stats={stats} loading={statsLoading} onRefresh={loadStats} />}
        {tab === 'users'     && <UsersTab onToast={showToast} />}
        {tab === 'kyc'       && <KycTab onToast={showToast} />}
        {tab === 'disputes'  && <DisputesTab onToast={showToast} />}
      </main>
    </div>
  )
}
