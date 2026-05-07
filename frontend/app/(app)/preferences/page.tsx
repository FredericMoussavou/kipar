'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Scale, CreditCard, Sun, Moon, Monitor,
  Bell, Lock, ChevronLeft, ChevronRight, Headphones,
  ExternalLink, LogOut, Trash2,
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from 'next-themes'
import Toggle from '@/components/ui/kipar/Toggle'
import Modal from '@/components/ui/kipar/Modal'
import PhoneInputField from '@/components/ui/kipar/PhoneInputField'
import api from '@/lib/api'
import { WeightUnit } from '@/lib/weight'
import { isValidIBAN } from 'ibantools'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED, GREEN } from '@/lib/theme'
import Link from 'next/link'

type Theme = 'light' | 'dark' | 'system'
type ToastType = 'success' | 'error'

// ─── Composants locaux ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, variant }: { title: string; variant?: 'danger' }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: variant === 'danger' ? RED : TAUPE, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '20px 0 8px', padding: '0 4px' }}>
      {title}
    </p>
  )
}

function SegmentedControl({ options, value, onChange }: {
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: SAND, borderRadius: 10, padding: 3 }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', background: value === o.value ? WHITE : 'transparent', color: value === o.value ? CHARCOAL : TAUPE, fontSize: 12, fontWeight: value === o.value ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: value === o.value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

function NotificationToggleRow({ label, description, checked, onChange, isLast }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; isLast?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: isLast ? 'none' : `1px solid ${SAND}` }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>{label}</p>
        {description && <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ─── PasswordModal ─────────────────────────────────────────────────────────────

function PasswordModal({ isOpen, onClose, onSuccess, onError }: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, display: 'block' as const }

  const handleSubmit = async () => {
    if (newPwd !== confirmPwd) { onError(t.profile_edit.error_password_mismatch); return }
    setLoading(true)
    try {
      await api.post('/auth/change-password', { old_password: oldPwd, new_password: newPwd })
      onSuccess(); onClose()
    } catch (err: any) {
      onError(err?.response?.data?.detail || t.errors.generic)
    } finally { setLoading(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.profile_edit.modal_password_title} closeDisabled={loading}>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>{t.profile_edit.field_old_password}</label>
        <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>{t.profile_edit.field_new_password}</label>
        <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.profile_edit.field_confirm_password}</label>
        <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 13, cursor: 'pointer' }}>{t.profile_edit.cancel}</button>
        <button type="button" onClick={handleSubmit} disabled={loading} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{loading ? '...' : t.profile_edit.save}</button>
      </div>
    </Modal>
  )
}

// ─── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({ isOpen, onClose, onSuccess, onError }: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, display: 'block' as const }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.delete('/users/me', { data: { password } })
      onSuccess()
    } catch (err: any) {
      onError(err?.response?.data?.detail || t.errors.generic)
    } finally { setLoading(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.profile_edit.delete_account} closeDisabled={loading}>
      <p style={{ fontSize: 13, color: TAUPE, marginBottom: 16 }}>{t.profile_edit.danger_desc}</p>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.profile_edit.field_old_password}</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 13, cursor: 'pointer' }}>{t.profile_edit.cancel}</button>
        <button type="button" onClick={handleSubmit} disabled={loading} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: RED, color: WHITE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{loading ? '...' : t.profile_edit.delete_account}</button>
      </div>
    </Modal>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function PreferencesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, patchUser, logout, refreshUser } = useAuthStore()
  const { theme, setTheme } = useTheme()

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [ibanInput, setIbanInput] = useState(user?.iban ?? '')
  const [ibanError, setIbanError] = useState('')
  const [mobileInput, setMobileInput] = useState(user?.mobile_money_number ?? '')

  if (!user) return null

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleLanguageChange = async (lang: string) => {
    try {
      await api.patch('/users/me/language', { language: lang })
      patchUser({ language: lang })
      showToast(t.profile_edit.success_language_updated)
    } catch { showToast(t.errors.generic, 'error') }
  }

  const handleWeightUnitChange = async (unit: string) => {
    try {
      await api.patch('/users/me', { weight_unit: unit })
      patchUser({ weight_unit: unit as WeightUnit })
      showToast(t.profile_edit.success_weight_unit_updated)
    } catch (err: any) {
      showToast(err?.response?.data?.detail || t.errors.generic, 'error')
    }
  }

  const handlePayoutChange = async (fields: Record<string, string | null>) => {
    try {
      await api.patch('/users/me', fields)
      patchUser(fields as any)
      showToast(t.profile_edit.success_payout_updated)
    } catch (err: any) {
      showToast(err?.response?.data?.detail || t.errors.generic, 'error')
    }
  }

  const handleNotificationToggle = async (field: string, value: boolean) => {
    const prev = (user as any)[field]
    patchUser({ [field]: value } as any)
    try {
      await api.patch('/users/me/notification-preferences', { [field]: value })
    } catch {
      patchUser({ [field]: prev } as any)
      showToast(t.errors.generic, 'error')
    }
  }

  const handleSaveIban = async () => {
    const clean = ibanInput.replace(/\s/g, '').toUpperCase()
    if (clean && !isValidIBAN(clean)) { setIbanError(t.profile_edit.error_iban_invalid); return }
    setIbanError('')
    await handlePayoutChange({ iban: clean || null })
  }

  const handleSaveMobile = async () => {
    await handlePayoutChange({ mobile_money_number: mobileInput || null })
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 120px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? RED : '#16A34A', color: WHITE, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingTop: 8 }}>
        <button type="button" onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${BORDER}`, background: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={18} color={CHARCOAL} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 20, fontWeight: 800, color: CHARCOAL, margin: 0 }}>
          {t.profile_edit.section_preferences}
        </h1>
      </div>

      {/* Langue */}
      <SectionTitle title={t.profile_edit.pref_language} />
      <Card>
        <div style={{ padding: '14px 16px' }}>
          <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 10px' }}>{t.profile_edit.pref_language_desc}</p>
          <SegmentedControl
            options={[
              { value: 'fr', label: t.profile_edit.lang_fr },
              { value: 'en', label: t.profile_edit.lang_en },
              { value: 'es', label: t.profile_edit.lang_es },
            ]}
            value={user.language}
            onChange={handleLanguageChange}
          />
        </div>
      </Card>

      {/* Unité de poids */}
      <SectionTitle title={t.profile_edit.pref_weight} />
      <Card>
        <div style={{ padding: '14px 16px' }}>
          <SegmentedControl
            options={[
              { value: 'kg', label: t.profile_edit.weight_unit_kg ?? 'kg' },
              { value: 'lb', label: t.profile_edit.weight_unit_lb ?? 'lb' },
            ]}
            value={user.weight_unit ?? 'kg'}
            onChange={handleWeightUnitChange}
          />
        </div>
      </Card>

      {/* Devise & paiement */}
      <SectionTitle title={t.profile_edit.pref_payout} />
      <Card>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SAND}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, margin: '0 0 8px' }}>{t.profile_edit.pref_currency}</p>
          <select value={user.currency ?? 'EUR'} onChange={e => handlePayoutChange({ currency: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none' }}>
            {(['EUR','GBP','USD','CHF','CAD','AUD','XOF','XAF','MAD','EGP','KES','NGN','GHS','ZAR','HTG','BRL','MXN','AED','INR','CNY'] as const).map(c => (
              <option key={c} value={c}>{c} — {(t.profile_edit as any)[`currency_${c}`]}</option>
            ))}
          </select>
        </div>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SAND}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TAUPE, margin: '0 0 8px' }}>{t.profile_edit.pref_payment_method}</p>
          <SegmentedControl
            options={[
              { value: 'iban', label: t.profile_edit.payment_method_iban },
              { value: 'mobile_money', label: t.profile_edit.payment_method_mobile },
            ]}
            value={user.payment_method ?? 'iban'}
            onChange={v => handlePayoutChange({ payment_method: v })}
          />
        </div>
        <div style={{ padding: '14px 16px' }}>
          {(user.payment_method ?? 'iban') === 'iban' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={ibanInput} onChange={e => { setIbanInput(e.target.value); setIbanError('') }}
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${ibanError ? RED : BORDER}`, borderRadius: 10, fontSize: 12, color: CHARCOAL, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
              {ibanError && <p style={{ fontSize: 11, color: RED, margin: 0 }}>{ibanError}</p>}
              <button type="button" onClick={handleSaveIban}
                style={{ alignSelf: 'flex-end', padding: '8px 16px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t.profile_edit.save}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <PhoneInputField value={mobileInput} onChange={val => setMobileInput(val)} defaultCountry="FR" />
              <button type="button" onClick={handleSaveMobile}
                style={{ alignSelf: 'flex-end', padding: '8px 16px', background: RED, color: WHITE, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t.profile_edit.save}
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Thème */}
      <SectionTitle title={t.profile_edit.pref_theme} />
      <Card>
        <div style={{ padding: '14px 16px' }}>
          <SegmentedControl
            options={[
              { value: 'light', label: t.profile_edit.theme_light },
              { value: 'dark', label: t.profile_edit.theme_dark },
              { value: 'system', label: t.profile_edit.theme_auto },
            ]}
            value={theme ?? 'system'}
            onChange={(v) => setTheme(v as Theme)}
          />
        </div>
      </Card>

      {/* Notifications */}
      <SectionTitle title={t.profile_edit.pref_notifications} />
      <Card>
        <div style={{ padding: '14px 16px' }}>
          <NotificationToggleRow
            label={t.profile_edit.notify_by_email}
            description={t.profile_edit.notify_by_email_desc}
            checked={user.notify_by_email}
            onChange={(v) => handleNotificationToggle('notify_by_email', v)}
          />
          <NotificationToggleRow
            label={t.profile_edit.notify_by_push}
            description={t.profile_edit.notify_by_push_desc}
            checked={user.notify_by_push}
            onChange={(v) => handleNotificationToggle('notify_by_push', v)}
          />
          <NotificationToggleRow
            label={t.profile_edit.notify_by_sms}
            description={t.profile_edit.notify_by_sms_desc}
            checked={user.notify_by_sms}
            onChange={(v) => handleNotificationToggle('notify_by_sms', v)}
            isLast
          />
        </div>
      </Card>

      {/* Sécurité */}
      <SectionTitle title={t.profile_edit.section_security} />
      <Card>
        <button type="button" onClick={() => setPasswordModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <Lock size={16} color={TAUPE} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{t.profile_edit.modal_password_title}</span>
          <ChevronRight size={16} color={TAUPE} />
        </button>
      </Card>

      {/* Modales */}
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => showToast(t.profile_edit.success_password_changed)}
        onError={(msg) => showToast(msg, 'error')}
      />
      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={() => { logout(); router.push('/login') }}
        onError={(msg) => showToast(msg, 'error')}
      />
    </div>
  )
}
