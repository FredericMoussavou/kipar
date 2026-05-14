'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  Headphones,
  Scale,
  CreditCard,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { getT } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from 'next-themes'
import KiparTrustGauge from '@/components/ui/kipar/KiparTrustGauge'
import Toggle from '@/components/ui/kipar/Toggle'
import Modal from '@/components/ui/kipar/Modal'
import Input from '@/components/ui/kipar/Input'
import { Button } from '@/components/ui/kipar'
import {
  uploadAvatar,
  removeAvatar,
  validateAvatarFile,
  getAvatarUrl,
  CloudinaryError,
  CloudinaryErrorCode,
} from '@/lib/cloudinary'
import api from '@/lib/api'
import { WeightUnit } from '@/lib/weight'
import { isValidIBAN } from 'ibantools'
import PhoneInputField, { isValidPhoneNumber } from '@/components/ui/kipar/PhoneInputField'
import { formatPhoneNumberIntl } from 'react-phone-number-input'
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

// ─── NameModal ───────────────────────────────────────────────────────────────
function NameModal({
  isOpen, onClose, currentFirstName, currentLastName, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  currentFirstName: string
  currentLastName: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const { patchUser } = useAuthStore()
  const [firstName, setFirstName] = useState(currentFirstName)
  const [lastName, setLastName] = useState(currentLastName)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) { setFirstName(currentFirstName); setLastName(currentLastName) }
  }, [isOpen, currentFirstName, currentLastName])

  const handleSubmit = async () => {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      onError(t.errors.generic); return
    }
    setLoading(true)
    try {
      await api.patch('/users/me', { first_name: firstName.trim(), last_name: lastName.trim() })
      patchUser({ first_name: firstName.trim(), last_name: lastName.trim() })
      onSuccess(); onClose()
    } catch (err: any) {
      onError(err?.response?.data?.detail || t.errors.generic)
    } finally { setLoading(false) }
  }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, display: 'block' as const }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.profile_edit.field_first_name + ' / ' + t.profile_edit.field_last_name} closeDisabled={loading}>
      <Input label={t.profile_edit.field_first_name} value={firstName} onChange={e => setFirstName(e.target.value)} style={{ marginBottom: 14 }} />
      <Input label={t.profile_edit.field_last_name} value={lastName} onChange={e => setLastName(e.target.value)} style={{ marginBottom: 16 }} />
      <ModalActions onCancel={onClose} onConfirm={handleSubmit} loading={loading}
        confirmLabel={t.profile_edit.save} />
    </Modal>
  )
}

// ─── UsernameModal ────────────────────────────────────────────────────────────
function UsernameModal({
  isOpen, onClose, currentUsername, usernameUpdatedAt, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  currentUsername: string
  usernameUpdatedAt: string | null
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const { patchUser } = useAuthStore()
  const [username, setUsername] = useState(currentUsername)
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) { setUsername(currentUsername); setStatus('idle') }
  }, [isOpen, currentUsername])

  const cooldownEnd = usernameUpdatedAt ? new Date(new Date(usernameUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null
  const inCooldown = cooldownEnd ? new Date() < cooldownEnd : false
  const cooldownStr = cooldownEnd ? cooldownEnd.toLocaleDateString() : ''

  const checkUsername = (value: string) => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!value || value === currentUsername) { setStatus('idle'); return }
    if (!/^[a-z0-9_]{4,15}$/.test(value)) { setStatus('invalid'); return }
    setStatus('checking')
    debounce.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/check-username', { params: { username: value } })
        setStatus(res.data.available ? 'available' : 'taken')
      } catch { setStatus('idle') }
    }, 400)
  }

  const handleChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)
    checkUsername(clean)
  }

  const handleSubmit = async () => {
    if (inCooldown) return
    if (username !== currentUsername && status !== 'available') return
    setLoading(true)
    try {
      await api.patch('/users/me', { username })
      patchUser({ username })
      onSuccess(); onClose()
    } catch (err: any) {
      onError(err?.response?.data?.detail || t.errors.generic)
    } finally { setLoading(false) }
  }

  const hintColor = status === 'available' ? GREEN : status === 'taken' || status === 'invalid' ? RED : TAUPE
  const hint = status === 'available' ? t.profile_edit.username_available
    : status === 'taken' ? t.profile_edit.username_taken
    : status === 'invalid' ? t.profile_edit.field_username_hint
    : status === 'checking' ? t.profile_edit.username_checking
    : t.profile_edit.field_username_hint
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, display: 'block' as const }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.profile_edit.field_username} closeDisabled={loading}>
      {inCooldown ? (
        <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            {t.profile_edit.username_cooldown} {cooldownStr}
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Input label={t.profile_edit.field_username} value={username} onChange={e => handleChange(e.target.value)} maxLength={15} />
          <p style={{ fontSize: 11, color: hintColor, marginTop: 4 }}>{hint}</p>
        </div>
      )}
      <ModalActions onCancel={onClose} onConfirm={handleSubmit}
        loading={loading} confirmDisabled={inCooldown || (status !== 'available' && username !== currentUsername)}
        confirmLabel={t.profile_edit.save} />
    </Modal>
  )
}

// ─── AddressModal ─────────────────────────────────────────────────────────────
function AddressModal({
  isOpen, onClose, currentAddress, onSuccess, onError,
}: {
  isOpen: boolean
  onClose: () => void
  currentAddress: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { t } = useTranslation()
  const { user, patchUser } = useAuthStore()
  const [address, setAddress] = useState(currentAddress)
  const [suggestions, setSuggestions] = useState<{ display_name: string; place_id: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addrLoading, setAddrLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) { setAddress(currentAddress); setSuggestions([]); setShowSuggestions(false) }
  }, [isOpen, currentAddress])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchAddress = (value: string) => {
    if (debounce.current) clearTimeout(debounce.current)
    if (value.length < 3) { setSuggestions([]); setShowSuggestions(false); return }
    setAddrLoading(true)
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5`,
          { headers: { 'Accept-Language': user?.language ?? 'fr' } }
        )
        const data = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      } catch { setSuggestions([]) }
      finally { setAddrLoading(false) }
    }, 500)
  }

  const handleSubmit = async () => {
    if (address.trim().length < 5) { onError(t.errors.generic); return }
    setLoading(true)
    try {
      await api.patch('/users/me', { address: address.trim() })
      patchUser({ address: address.trim() })
      onSuccess(); onClose()
    } catch (err: any) {
      onError(err?.response?.data?.detail || t.errors.generic)
    } finally { setLoading(false) }
  }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, display: 'block' as const }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.profile_edit.field_address} closeDisabled={loading}>
      <div style={{ marginBottom: 16, position: 'relative' }} ref={containerRef}>
        <Input label={t.profile_edit.field_address} value={address} onChange={e => { setAddress(e.target.value); searchAddress(e.target.value) }} placeholder={t.profile_edit.field_address} />
        {addrLoading && <p style={{ fontSize: 11, color: TAUPE, marginTop: 4 }}>...</p>}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
            {suggestions.map(s => (
              <button key={s.place_id} type="button" onClick={() => { setAddress(s.display_name); setSuggestions([]); setShowSuggestions(false) }}
                style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid ' + BORDER, fontSize: 12, color: CHARCOAL, cursor: 'pointer', lineHeight: 1.4 }}>
                {s.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <ModalActions onCancel={onClose} onConfirm={handleSubmit} loading={loading}
        confirmLabel={t.profile_edit.save} />
    </Modal>
  )
}


export default function ProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, logout, refreshUser, patchUser } = useAuthStore()
  const { theme, setTheme } = useTheme()

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  // Modal states
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [usernameModalOpen, setUsernameModalOpen] = useState(false)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  // Vérification email/phone
  const [verifyEmailOpen, setVerifyEmailOpen] = useState(false)
  const [verifyPhoneOpen, setVerifyPhoneOpen] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyStep, setVerifyStep] = useState<'send' | 'confirm'>('send')
  const [verifyLoading, setVerifyLoading] = useState(false)

  const [ibanInput, setIbanInput] = useState(user?.iban ?? '' as string)
  const [ibanError, setIbanError] = useState('')
  const [mobileInput, setMobileInput] = useState(user?.mobile_money_number ?? '' as string)

  const handleSaveIban = async () => {
    const clean = ibanInput.replace(/\s/g, '').toUpperCase()
    if (clean && !isValidIBAN(clean)) {
      setIbanError(t.profile_edit.error_iban_invalid)
      return
    }
    setIbanError('')
    await handlePayoutChange({ iban: clean || null })
  }

  const handleSaveMobile = async () => {
    await handlePayoutChange({ mobile_money_number: mobileInput || null })
  }

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

  const handleWeightUnitChange = async (unit: string) => {
    if (user.weight_unit === unit) return
    const previous = user.weight_unit
    patchUser({ weight_unit: unit })
    try {
      await api.patch('/users/me', { weight_unit: unit })
      showToast(t.profile_edit.success_weight_unit_updated, 'success')
    } catch (err: any) {
      patchUser({ weight_unit: previous })
      showToast( t.profile_edit.weight_unit_active_listings, 'error')
    }
  }

  const handlePayoutChange = async (fields: { currency?: string; payment_method?: string; payment_country?: string; mobile_money_number?: string | null; iban?: string | null }) => {
    const previous = { currency: user.currency, payment_method: user.payment_method, payment_country: user.payment_country, mobile_money_number: user.mobile_money_number, iban: user.iban }
    patchUser(fields)
    try {
      await api.patch('/users/me', fields)
      showToast(t.profile_edit.success_payout_updated, 'success')
    } catch {
      patchUser(previous)
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

          <Button variant="outline" size="sm" onClick={() => router.push(`/profile/${user.id}`)}>
            <ExternalLink size={12} />
            {t.profile_edit.view_public_profile}
          </Button>
        </div>

        {/* Section Informations */}
        <SectionTitle title={t.profile_edit.section_info} />
        <Card>
          {/* Email — affichage + verification fusionnes */}
          <EmailRow
            email={user.email}
            isVerified={isEmailVerified}
            onVerify={() => { setVerifyEmailOpen(true); setVerifyStep('send') }}
            labels={{
              verifiedLabel: t.verify.email_verified,
              verifyBtn: t.verify.verify_btn,
            }}
          />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_first_name} value={user.first_name} onClick={() => setNameModalOpen(true)} />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_last_name} value={user.last_name} onClick={() => setNameModalOpen(true)} />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_username} value={user.username || t.profile_edit.add_btn} onClick={() => setUsernameModalOpen(true)} />
          <InfoRow icon={<UserIcon size={16} />} label={t.profile_edit.field_address} value={user.address || t.profile_edit.add_btn} onClick={() => setAddressModalOpen(true)} />
          {/* Telephone — affichage + verification + modification fusionnes */}
          <PhoneRow
            phone={user.phone}
            isVerified={isPhoneVerified}
            emptyLabel={t.profile_edit.field_phone_empty}
            onVerify={() => { setVerifyPhoneOpen(true); setVerifyStep('send') }}
            onEdit={() => setPhoneModalOpen(true)}
            labels={{
              phoneLabel: t.profile_edit.field_phone,
              verifyBtn: t.verify.verify_btn,
              editBtn: t.profile_edit.edit_btn,
              addBtn: t.profile_edit.add_btn,
              verifiedLabel: t.verify.phone_verified,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${SAND}` }}>
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
        </Card>

      {/* Support */}
      <SectionTitle title={t.support.section_title} />
      <Card>
        <button type="button" onClick={() => { const tawk = (window as any).Tawk_API; if (tawk?.toggle) tawk.toggle() }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${SAND}`, cursor: 'pointer', textAlign: 'left' }}>
          <Headphones size={16} color={TAUPE} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>{t.support.chat_label}</p>
            <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{t.support.chat_desc}</p>
          </div>
          <ChevronRight size={16} color={TAUPE} />
        </button>
        <Link href="/faq" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none' }}>
          <ExternalLink size={16} color={TAUPE} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0 }}>{t.support.faq_label}</p>
            <p style={{ fontSize: 11, color: TAUPE, margin: '2px 0 0' }}>{t.support.faq_desc}</p>
          </div>
          <ChevronRight size={16} color={TAUPE} />
        </Link>
      </Card>

      {/* Déconnexion */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
        <button onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 99, border: '1px solid var(--k-sand)', background: 'transparent', color: 'var(--k-taupe)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <LogOut size={15} />
          {t.profile_edit.logout}
        </button>
      </div>

      {/* Zone dangereuse */}
      <SectionTitle title={t.profile_edit.section_danger} variant="danger" />
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: TAUPE, margin: 0, marginBottom: 12, lineHeight: 1.5 }}>{t.profile_edit.danger_desc}</p>
        <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
          <Trash2 size={13} />
          {t.profile_edit.delete_account}
        </Button>
      </div>
      </div>

      {/* ─── Modales nom / username / adresse ─── */}
      <NameModal
        isOpen={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        currentFirstName={user.first_name}
        currentLastName={user.last_name}
        onSuccess={() => { refreshUser(); showToast(t.profile_edit.success_name_updated, "success") }}
        onError={(msg) => showToast(msg, "error")}
      />
      <UsernameModal
        isOpen={usernameModalOpen}
        onClose={() => setUsernameModalOpen(false)}
        currentUsername={user.username ?? ""}
        usernameUpdatedAt={user.username_updated_at ?? null}
        onSuccess={() => { refreshUser(); showToast(t.profile_edit.success_username_updated, "success") }}
        onError={(msg) => showToast(msg, "error")}
      />
      <AddressModal
        isOpen={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        currentAddress={user.address ?? ""}
        onSuccess={() => { refreshUser(); showToast(t.profile_edit.success_address_updated, "success") }}
        onError={(msg) => showToast(msg, "error")}
      />
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

function EmailRow({
  email, isVerified, onVerify,
  labels,
}: {
  email: string
  isVerified: boolean
  onVerify: () => void
  labels: { verifiedLabel: string; verifyBtn: string }
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${SAND}` }}>
      <div style={{ color: TAUPE, display: 'flex', flexShrink: 0 }}><Mail size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>Email</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: CHARCOAL, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </p>
      </div>
      {isVerified ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, color: GREEN,
          background: 'rgba(34,197,94,0.10)', borderRadius: 99,
          padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <Check size={11} /> {labels.verifiedLabel}
        </span>
      ) : (
        <button
          type="button"
          onClick={onVerify}
          style={{
            fontSize: 12, fontWeight: 600, color: RED,
            background: 'rgba(220,38,38,0.07)', border: 'none',
            borderRadius: 99, padding: '4px 12px',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {labels.verifyBtn}
        </button>
      )}
    </div>
  )
}

function PhoneRow({
  phone, isVerified, emptyLabel, onVerify, onEdit, labels,
}: {
  phone: string | null
  isVerified: boolean
  emptyLabel: string
  onVerify: () => void
  onEdit: () => void
  labels: { phoneLabel: string; verifyBtn: string; editBtn: string; addBtn: string; verifiedLabel: string }
}) {
  const displayPhone = phone ? (formatPhoneNumberIntl(phone) || phone) : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${SAND}` }}>
      <div style={{ color: TAUPE, display: 'flex', flexShrink: 0 }}><Phone size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: TAUPE, margin: 0, marginBottom: 2 }}>{labels.phoneLabel}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: displayPhone ? CHARCOAL : TAUPE, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayPhone ?? emptyLabel}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {!displayPhone ? (
          <button
            type="button"
            onClick={onEdit}
            style={{
              fontSize: 12, fontWeight: 600, color: RED,
              background: 'rgba(220,38,38,0.07)', border: 'none',
              borderRadius: 99, padding: '4px 12px', cursor: 'pointer',
            }}
          >
            {labels.addBtn}
          </button>
        ) : isVerified ? (
          <>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600, color: GREEN,
              background: 'rgba(34,197,94,0.10)', borderRadius: 99,
              padding: '3px 10px',
            }}>
              <Check size={11} /> {labels.verifiedLabel}
            </span>
            <button
              type="button"
              onClick={onEdit}
              style={{
                fontSize: 12, fontWeight: 600, color: CHARCOAL,
                background: SAND, border: `1px solid ${BORDER}`,
                borderRadius: 99, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              {labels.editBtn}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onVerify}
              style={{
                fontSize: 12, fontWeight: 600, color: RED,
                background: 'rgba(220,38,38,0.07)', border: 'none',
                borderRadius: 99, padding: '4px 10px', cursor: 'pointer',
              }}
            >
              {labels.verifyBtn}
            </button>
            <button
              type="button"
              onClick={onEdit}
              style={{
                fontSize: 12, fontWeight: 600, color: CHARCOAL,
                background: SAND, border: `1px solid ${BORDER}`,
                borderRadius: 99, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              {labels.editBtn}
            </button>
          </>
        )}
      </div>
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
  const [phoneError, setPhoneError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setValue(currentPhone || '')
      setPhoneError('')
    }
  }, [isOpen, currentPhone])

  const handleSubmit = async () => {
    if (value && !isValidPhoneNumber(value)) {
      setPhoneError(t.profile_edit.error_phone_invalid)
      return
    }
    setPhoneError('')
    setLoading(true)
    try {
      await api.patch('/users/me', { phone: value || null })
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
      <PhoneInputField
        value={value}
        onChange={(val) => { setValue(val); setPhoneError('') }}
        error={phoneError}
        defaultCountry="FR"
      />
      <div style={{ marginBottom: 16 }} />
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
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rightIcon={!hideToggle ? (
          <button type="button" onClick={toggleShow} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: TAUPE }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : undefined}
      />
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
      <Button fullWidth loading={loading} onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 8 }}>
        <Upload size={14} />
        {t.profile_edit.upload_choose}
      </Button>

      {hasAvatar && (
        <Button fullWidth variant="outline" disabled={loading} onClick={handleRemove}>
          <Trash2 size={12} />
          {t.profile_edit.avatar_remove}
        </Button>
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
      <div style={{ marginBottom: 16 }}>
        <Input
          type={showPwd ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.profile_edit.modal_delete_password_placeholder}
          autoFocus
          rightIcon={
            <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: TAUPE }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
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
          <Button fullWidth loading={loading} onClick={onSend}>
            {channel === 'email' ? t.verify.verify_btn + ' par email' : t.verify.verify_btn + ' par SMS'}
          </Button>
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
            <Button variant="outline" size="sm" disabled={loading} onClick={onSend}>
              {t.verify.resend}
            </Button>
            <Button size="sm" loading={loading} disabled={loading || code.replace(/\D/g, '').length !== 6} onClick={onConfirm}>
              {t.verify.confirm_btn}
            </Button>
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
      <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
        {t.profile_edit.cancel}
      </Button>
      <Button variant={isDanger ? 'danger' : 'primary'} size="sm" loading={loading} disabled={loading || confirmDisabled} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}