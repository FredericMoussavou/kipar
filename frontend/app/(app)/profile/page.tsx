'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  User as UserIcon,
  Mail,
  Phone,
  Camera,
  Lock,
  Globe,
  Sun,
  Moon,
  Monitor,
  Bell,
  LogOut,
  Trash2,
  ChevronRight,
  ExternalLink,
  Check,
  Eye,
  EyeOff,
  Upload,
  AlertCircle,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { getT } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from 'next-themes'
import KiparTrustGauge from '@/components/ui/kipar/KiparTrustGauge'
import Toggle from '@/components/ui/kipar/Toggle'
import Modal from '@/components/ui/kipar/Modal'
import {
  uploadAvatar,
  removeAvatar,
  validateAvatarFile,
  getAvatarUrl,
  CloudinaryError,
  CloudinaryErrorCode,
} from '@/lib/cloudinary'
import api from '@/lib/api'
import {
  CHARCOAL,
  CHARCOAL2,
  TAUPE,
  SAND,
  BORDER,
  WHITE,
  RED,
  GREEN,
  BG,
} from '@/lib/theme'

type Theme = 'light' | 'dark' | 'system'
type ToastType = 'success' | 'error'

export default function ProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout, refreshUser, patchUser } = useAuthStore()
  const { theme, setTheme } = useTheme()

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  // Modal states
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  // Vérification email/phone
  const [verifyEmailOpen, setVerifyEmailOpen] = useState(false)
  const [verifyPhoneOpen, setVerifyPhoneOpen] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyStep, setVerifyStep] = useState<'send' | 'confirm'>('send')
  const [verifyLoading, setVerifyLoading] = useState(false)

  const handleSendCode = async (channel: 'email' | 'phone') => {
    setVerifyLoading(true)
    try {
      await api.post(`/verify/${channel}/send`)
      setVerifyStep('confirm')
      setVerifyCode('')
      showToast(t.verify.code_sent, 'success')
    } catch {
      showToast(t.errors.generic, 'error')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleConfirmCode = async (channel: 'email' | 'phone') => {
    if (verifyCode.length !== 6) return
    setVerifyLoading(true)
    try {
      await api.post(`/verify/${channel}/confirm`, { code: verifyCode })
      await refreshUser()
      showToast(channel === 'email' ? t.verify.email_verified : t.verify.phone_verified, 'success')
      if (channel === 'email') { setVerifyEmailOpen(false) }
      else { setVerifyPhoneOpen(false) }
      setVerifyStep('send')
      setVerifyCode('')
    } catch {
      showToast(t.verify.invalid_code, 'error')
    } finally {
      setVerifyLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type })
  }

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: TAUPE }}>
        {t.profile_edit.saving}
      </div>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`
  const initials = `${user.first_name[0] || ''}${user.last_name[0] || ''}`
  const avatarUrl = getAvatarUrl(user.avatar_url, 200)
  const isKycVerified = user.kyc_status === 'verified'
  const isEmailVerified = user.email_verified ?? false
  const isPhoneVerified = user.phone_verified ?? false

  const handleLanguageChange = async (newLang: 'fr' | 'en' | 'es') => {
    if (user.language === newLang) return
    const previousLang = user.language
    patchUser({ language: newLang })
    try {
      await api.patch('/users/me/language', { language: newLang })
      const newT = getT(newLang)
      showToast(newT.profile_edit.success_language_updated, 'success')
    } catch {
      patchUser({ language: previousLang })
      showToast(t.errors.generic, 'error')
    }
  }

  const handleNotificationToggle = async (
    field: 'notify_by_email' | 'notify_by_push' | 'notify_by_sms',
    value: boolean
  ) => {
    const previousValue = user[field]
    patchUser({ [field]: value })
    try {
      await api.patch('/users/me/notification-preferences', { [field]: value })
      showToast(t.profile_edit.success_notifications_updated, 'success')
    } catch {
      patchUser({ [field]: previousValue })
      showToast(t.errors.generic, 'error')
    }
  }

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: toast.type === 'success' ? GREEN : RED,
            color: WHITE,
            padding: '10px 20px',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      <div style={{ padding: '24px 16px 80px', maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div
          style={{
            background: WHITE,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: '24px 20px',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          <div
            onClick={() => setAvatarModalOpen(true)}
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              margin: '0 auto 12px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 28,
                background: CHARCOAL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : initials ? (
                <span
                  style={{
                    fontFamily: 'var(--font-syne, Syne)',
                    fontSize: 32,
                    fontWeight: 800,
                    color: WHITE,
                  }}
                >
                  {initials}
                </span>
              ) : (
                <UserIcon size={40} color={WHITE} />
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: RED,
                border: `3px solid ${WHITE}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={14} color={WHITE} />
            </div>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-syne, Syne)',
              fontSize: 22,
              fontWeight: 800,
              color: CHARCOAL,
              margin: 0,
              marginBottom: 4,
            }}
          >
            {fullName}
          </h1>
          <p style={{ fontSize: 13, color: TAUPE, margin: 0, marginBottom: 16 }}>
            {user.email}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <KiparTrustGauge score={user.trust_score} size="md" />
          </div>

          <button
            type="button"
            onClick={() => router.push(`/profile/${user.id}`)}
            style={{
              background: SAND,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: CHARCOAL,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ExternalLink size={12} />
            {t.profile_edit.view_public_profile}
          </button>
        </div>

        {/* Section Informations */}
        <SectionTitle title={t.profile_edit.section_info} />
        <Card>
          <InfoRow icon={<Mail size={16} />} label={t.profile_edit.field_email} value={user.email} readonly />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_first_name} value={user.first_name} readonly />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_last_name} value={user.last_name} readonly />
          <InfoRow
            icon={<Phone size={16} />}
            label={t.profile_edit.field_phone}
            value={user.phone || t.profile_edit.field_phone_empty}
            valueStyle={{ color: user.phone ? CHARCOAL : TAUPE }}
            onClick={() => setPhoneModalOpen(true)}
            isLast={!isKycVerified && false}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            <div style={{ color: TAUPE, display: 'flex' }}>
              <Lock size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>
                {t.profile_edit.kyc_title}
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isKycVerified ? GREEN : TAUPE,
                  margin: 0,
                }}
              >
                {isKycVerified
                  ? `✓ ${t.profile_edit.kyc_status_verified}`
                  : t.profile_edit.kyc_status_pending}
              </p>
            </div>
          </div>

          {/* Email verification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${SAND}` }}>
            <div style={{ color: TAUPE, display: 'flex' }}><Mail size={16} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>{t.verify.email_label}</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: isEmailVerified ? GREEN : TAUPE, margin: 0 }}>
                {isEmailVerified ? `✓ ${t.verify.verified}` : t.verify.not_verified}
              </p>
            </div>
            {!isEmailVerified && (
              <button onClick={() => { setVerifyEmailOpen(true); setVerifyStep('send') }}
                style={{ fontSize: 12, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {t.verify.verify_btn}
              </button>
            )}
          </div>

          {/* Phone verification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${SAND}` }}>
            <div style={{ color: TAUPE, display: 'flex' }}><Phone size={16} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>{t.verify.phone_label}</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: isPhoneVerified ? GREEN : TAUPE, margin: 0 }}>
                {isPhoneVerified ? `✓ ${t.verify.verified}` : t.verify.not_verified}
              </p>
            </div>
            {!isPhoneVerified && user.phone && (
              <button onClick={() => { setVerifyPhoneOpen(true); setVerifyStep('send') }}
                style={{ fontSize: 12, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {t.verify.verify_btn}
              </button>
            )}
          </div>
        </Card>

        {/* Section Préférences */}
        <SectionTitle title={t.profile_edit.section_preferences} />
        <Card>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SAND}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Globe size={16} color={TAUPE} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>
                  {t.profile_edit.pref_language}
                </p>
                <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>
                  {t.profile_edit.pref_language_desc}
                </p>
              </div>
            </div>
            <SegmentedControl
              options={[
                { value: 'fr', label: t.profile_edit.lang_fr },
                { value: 'en', label: t.profile_edit.lang_en },
                { value: 'es', label: t.profile_edit.lang_es },
              ]}
              value={user.language}
              onChange={(v) => handleLanguageChange(v as 'fr' | 'en')}
            />
          </div>

          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SAND}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Sun size={16} color={TAUPE} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>
                  {t.profile_edit.pref_theme}
                </p>
                <p style={{ fontSize: 11, color: TAUPE, margin: 0 }}>
                  {t.profile_edit.pref_theme_desc}
                </p>
              </div>
            </div>
            <SegmentedControl
              options={[
                { value: 'light', label: t.profile_edit.theme_light, icon: <Sun size={12} /> },
                { value: 'dark', label: t.profile_edit.theme_dark, icon: <Moon size={12} /> },
                { value: 'system', label: t.profile_edit.theme_auto, icon: <Monitor size={12} /> },
              ]}
              value={theme ?? 'system'}
              onChange={(v) => setTheme(v as Theme)}
            />
          </div>

          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Bell size={16} color={TAUPE} />
              <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>
                {t.profile_edit.pref_notifications}
              </p>
            </div>
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

        {/* Section Sécurité */}
        <SectionTitle title={t.profile_edit.section_security} />
        <Card>
          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Lock size={16} color={TAUPE} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: CHARCOAL }}>
              {t.profile_edit.modal_password_title}
            </span>
            <ChevronRight size={16} color={TAUPE} />
          </button>
        </Card>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            background: WHITE,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: CHARCOAL,
            cursor: 'pointer',
            marginBottom: 32,
            marginTop: 16,
          }}
        >
          <LogOut size={16} />
          {t.profile_edit.logout}
        </button>

        {/* Zone dangereuse */}
        <SectionTitle title={t.profile_edit.section_danger} variant="danger" />
        <div
          style={{
            background: WHITE,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 12, color: TAUPE, margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
            {t.profile_edit.danger_desc}
          </p>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: 'transparent',
              border: `1px solid ${RED}`,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              color: RED,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            {t.profile_edit.delete_account}
          </button>
        </div>
      </div>

      {/* ─── Modals ─── */}
      <PhoneModal
        isOpen={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        currentPhone={user.phone}
        onSuccess={() => {
          refreshUser()
          showToast(t.profile_edit.success_phone_updated, 'success')
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => showToast(t.profile_edit.success_password_changed, 'success')}
        onError={(msg) => showToast(msg, 'error')}
      />
      <AvatarModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        hasAvatar={!!user.avatar_url}
        onSuccess={() => {
          refreshUser()
          showToast(t.profile_edit.upload_success, 'success')
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onSuccess={() => {
          showToast(t.profile_edit.success_account_deleted, 'success')
          setTimeout(() => {
            logout()
            router.replace('/login')
          }, 1500)
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
      <VerifyCodeModal
        isOpen={verifyEmailOpen}
        channel="email"
        step={verifyStep}
        code={verifyCode}
        loading={verifyLoading}
        onClose={() => { setVerifyEmailOpen(false); setVerifyStep('send'); setVerifyCode('') }}
        onSend={() => handleSendCode('email')}
        onCodeChange={setVerifyCode}
        onConfirm={() => handleConfirmCode('email')}
      />
      <VerifyCodeModal
        isOpen={verifyPhoneOpen}
        channel="phone"
        step={verifyStep}
        code={verifyCode}
        loading={verifyLoading}
        onClose={() => { setVerifyPhoneOpen(false); setVerifyStep('send'); setVerifyCode('') }}
        onSend={() => handleSendCode('phone')}
        onCodeChange={setVerifyCode}
        onConfirm={() => handleConfirmCode('phone')}
      />
    </div>
  )
}

// ─── Sub-components UI ──────────────────────────────────────────────────────

function SectionTitle({ title, variant = 'default' }: { title: string; variant?: 'default' | 'danger' }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: variant === 'danger' ? RED : TAUPE,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '20px 4px 8px',
      }}
    >
      {title}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function InfoRow({
  icon, label, value, valueStyle, onClick, readonly, isLast,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueStyle?: React.CSSProperties
  onClick?: () => void
  readonly?: boolean
  isLast?: boolean
}) {
  const clickable = !readonly && onClick

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : `1px solid ${SAND}`,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ color: TAUPE, display: 'flex' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>{label}</p>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: CHARCOAL,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...valueStyle,
          }}
        >
          {value}
        </p>
      </div>
      {clickable && <ChevronRight size={16} color={TAUPE} />}
    </div>
  )
}

interface SegmentedControlOption { value: string; label: string; icon?: React.ReactNode }

function SegmentedControl({
  options, value, onChange,
}: {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 4,
        background: SAND,
        borderRadius: 10,
        padding: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              background: active ? WHITE : 'transparent',
              border: 'none',
              borderRadius: 8,
              padding: '8px 6px',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? CHARCOAL : TAUPE,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function NotificationToggleRow({
  label, description, checked, onChange, isLast,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  isLast?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingTop: 8,
        paddingBottom: isLast ? 0 : 8,
        borderBottom: isLast ? 'none' : `1px solid ${SAND}`,
        marginBottom: isLast ? 0 : 8,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginTop: 2 }}>{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  )
}

// ─── Modal: Téléphone ───────────────────────────────────────────────────────

function PhoneModal({
  isOpen, onClose, currentPhone, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  currentPhone: string | null
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(currentPhone || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) setValue(currentPhone || '')
  }, [isOpen, currentPhone])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.patch('/users/me', { phone: value })
      onSuccess()
      onClose()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        onError(t.profile_edit.error_phone_already_used)
      } else if (status === 422) {
        onError(t.profile_edit.error_phone_invalid)
      } else {
        onError(t.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.profile_edit.modal_phone_title}
      description={t.profile_edit.modal_phone_desc}
      closeDisabled={loading}
    >
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.profile_edit.modal_phone_placeholder}
        autoFocus
        style={inputStyle()}
      />
      <p style={{ fontSize: 11, color: TAUPE, margin: '6px 0 16px' }}>
        {t.profile_edit.modal_phone_format}
      </p>
      <ModalActions
        onCancel={onClose}
        onConfirm={handleSubmit}
        loading={loading}
        confirmLabel={t.profile_edit.save}
      />
    </Modal>
  )
}

// ─── Modal: Mot de passe ────────────────────────────────────────────────────

function PasswordModal({
  isOpen, onClose, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setShowOld(false)
      setShowNew(false)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (newPwd !== confirmPwd) {
      onError(t.profile_edit.error_password_mismatch)
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        old_password: oldPwd,
        new_password: newPwd,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 400 && typeof detail === 'string') {
        if (detail.toLowerCase().includes('ancien') || detail.toLowerCase().includes('old')) {
          onError(t.profile_edit.error_password_old_invalid)
        } else if (detail.toLowerCase().includes('different') || detail.toLowerCase().includes('différent')) {
          onError(t.profile_edit.error_password_same)
        } else {
          onError(detail)
        }
      } else if (status === 422) {
        onError(t.profile_edit.error_password_weak)
      } else {
        onError(t.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.profile_edit.modal_password_title}
      description={t.profile_edit.modal_password_desc}
      closeDisabled={loading}
    >
      <PasswordField
        label={t.profile_edit.field_old_password}
        value={oldPwd}
        onChange={setOldPwd}
        show={showOld}
        toggleShow={() => setShowOld(!showOld)}
      />
      <PasswordField
        label={t.profile_edit.field_new_password}
        value={newPwd}
        onChange={setNewPwd}
        show={showNew}
        toggleShow={() => setShowNew(!showNew)}
      />
      <PasswordField
        label={t.profile_edit.field_confirm_password}
        value={confirmPwd}
        onChange={setConfirmPwd}
        show={showNew}
        toggleShow={() => setShowNew(!showNew)}
        hideToggle
      />
      <p style={{ fontSize: 11, color: TAUPE, margin: '0 0 16px', lineHeight: 1.5 }}>
        {t.profile_edit.password_requirements}
      </p>
      <ModalActions
        onCancel={onClose}
        onConfirm={handleSubmit}
        loading={loading}
        confirmLabel={t.profile_edit.save}
        confirmDisabled={!oldPwd || !newPwd || !confirmPwd}
      />
    </Modal>
  )
}

function PasswordField({
  label, value, onChange, show, toggleShow, hideToggle,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  toggleShow: () => void
  hideToggle?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: TAUPE,
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle(), paddingRight: hideToggle ? 12 : 40 }}
        />
        {!hideToggle && (
          <button
            type="button"
            onClick={toggleShow}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              color: TAUPE,
            }}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Modal: Avatar ──────────────────────────────────────────────────────────

function AvatarModal({
  isOpen, onClose, hasAvatar, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  hasAvatar: boolean
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mapErrorToMessage = (err: unknown): string => {
    if (err instanceof CloudinaryError) {
      switch (err.code) {
        case CloudinaryErrorCode.FILE_TOO_LARGE:
          return t.profile_edit.upload_too_large
        case CloudinaryErrorCode.FILE_WRONG_TYPE:
          return t.profile_edit.upload_wrong_type
        default:
          return t.profile_edit.upload_error
      }
    }
    return t.profile_edit.upload_error
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      validateAvatarFile(file)
    } catch (err) {
      onError(mapErrorToMessage(err))
      return
    }

    setLoading(true)
    try {
      await uploadAvatar(file)
      onSuccess()
      onClose()
    } catch (err) {
      onError(mapErrorToMessage(err))
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    try {
      await removeAvatar()
      onSuccess()
      onClose()
    } catch (err) {
      onError(mapErrorToMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.profile_edit.modal_avatar_title}
      description={t.profile_edit.modal_avatar_desc}
      closeDisabled={loading}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={loading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: RED,
          color: WHITE,
          border: 'none',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: loading ? 0.7 : 1,
          marginBottom: 8,
        }}
      >
        <Upload size={14} />
        {loading ? t.profile_edit.upload_uploading : t.profile_edit.upload_choose}
      </button>

      {hasAvatar && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            color: TAUPE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Trash2 size={12} />
          {t.profile_edit.avatar_remove}
        </button>
      )}
    </Modal>
  )
}

// ─── Modal: Suppression de compte ───────────────────────────────────────────

function DeleteAccountModal({
  isOpen, onClose, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setShowPwd(false)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.delete('/users/me', { data: { password } })
      onSuccess()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 403) {
        onError(t.profile_edit.error_delete_password_invalid)
      } else {
        onError(t.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.profile_edit.modal_delete_title}
      description={t.profile_edit.modal_delete_desc}
      variant="danger"
      closeDisabled={loading}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: RED,
          margin: '0 0 16px',
        }}
      >
        ⚠️ {t.profile_edit.modal_delete_warning}
      </p>

      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: TAUPE,
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {t.profile_edit.modal_delete_password_label}
      </label>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type={showPwd ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.profile_edit.modal_delete_password_placeholder}
          autoFocus
          style={{ ...inputStyle(), paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setShowPwd(!showPwd)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            color: TAUPE,
          }}
        >
          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <ModalActions
        onCancel={onClose}
        onConfirm={handleSubmit}
        loading={loading}
        confirmLabel={t.profile_edit.delete_confirm}
        confirmDisabled={!password}
        confirmVariant="danger"
      />
    </Modal>
  )
}

// ─── Modal: Vérification email / téléphone ─────────────────────────────────

function VerifyCodeModal({
  isOpen, channel, step, code, loading,
  onClose, onSend, onCodeChange, onConfirm,
}: {
  isOpen: boolean
  channel: 'email' | 'phone'
  step: 'send' | 'confirm'
  code: string
  loading: boolean
  onClose: () => void
  onSend: () => void
  onCodeChange: (val: string) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const title = channel === 'email' ? t.verify.modal_email_title : t.verify.modal_phone_title
  const desc  = channel === 'email' ? t.verify.modal_email_desc  : t.verify.modal_phone_desc

  // Split code string → array of 6 chars
  const digits = Array.from({ length: 6 }, (_, i) => code[i] ?? '')

  const handleDigit = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1)
    const arr = Array.from({ length: 6 }, (_, i) => code[i] ?? '')
    arr[index] = char
    const next = arr.join('')
    onCodeChange(next)
    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const arr = Array.from({ length: 6 }, (_, i) => code[i] ?? '')
      arr[index - 1] = ''
      onCodeChange(arr.join(''))
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onCodeChange(pasted.padEnd(6, '').slice(0, 6))
    e.preventDefault()
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={desc} closeDisabled={loading}>
      {step === 'send' ? (
        <>
          <button
            type="button"
            onClick={onSend}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: RED,
              color: WHITE,
              border: 'none',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t.verify.sending : (channel === 'email' ? t.verify.verify_btn + ' par email' : t.verify.verify_btn + ' par SMS')}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: TAUPE, margin: '0 0 16px', textAlign: 'center' }}>
            {t.verify.enter_code}
          </p>
          {/* 6 inputs OTP */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                style={{
                  width: 44,
                  height: 52,
                  textAlign: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: CHARCOAL,
                  background: BG,
                  border: `2px solid ${d ? RED : BORDER}`,
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onSend}
              disabled={loading}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: TAUPE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {t.verify.resend}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || code.replace(/\D/g, '').length !== 6}
              style={{
                padding: '10px 20px',
                background: RED,
                color: WHITE,
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: (loading || code.replace(/\D/g, '').length !== 6) ? 'not-allowed' : 'pointer',
                opacity: (loading || code.replace(/\D/g, '').length !== 6) ? 0.5 : 1,
                minWidth: 100,
              }}
            >
              {loading ? t.verify.confirming : t.verify.confirm_btn}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── Helpers UI partagés ────────────────────────────────────────────────────

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    fontSize: 13,
    color: CHARCOAL,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }
}

function ModalActions({
  onCancel, onConfirm, loading, confirmLabel, confirmDisabled, confirmVariant = 'default',
}: {
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
  confirmLabel: string
  confirmDisabled?: boolean
  confirmVariant?: 'default' | 'danger'
}) {
  const { t } = useTranslation()
  const isDanger = confirmVariant === 'danger'

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        style={{
          padding: '10px 20px',
          background: 'transparent',
          color: TAUPE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.5 : 1,
        }}
      >
        {t.profile_edit.cancel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || confirmDisabled}
        style={{
          padding: '10px 20px',
          background: isDanger ? RED : RED,
          color: WHITE,
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading || confirmDisabled ? 'not-allowed' : 'pointer',
          opacity: loading || confirmDisabled ? 0.5 : 1,
          minWidth: 100,
        }}
      >
        {loading ? t.profile_edit.saving : confirmLabel}
      </button>
    </div>
  )
}