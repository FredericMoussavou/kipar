'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react'
import { Button, OtpInput } from '@/components/ui/kipar'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/api'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED, GREEN, SAND } from '@/lib/theme'

interface TwoFASectionProps {
  totpEnabled: boolean
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

type Step = 'idle' | 'setup' | 'verify-setup' | 'disable'

export default function TwoFASection({ totpEnabled, onSuccess, onError }: TwoFASectionProps) {
  const { t } = useTranslation()
  const { refreshUser } = useAuthStore()
  const [step, setStep] = useState<Step>('idle')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCopied, setBackupCopied] = useState(false)
  const [useBackupDisable, setUseBackupDisable] = useState(false)
  const [backupCodeDisable, setBackupCodeDisable] = useState('')

  const reset = () => {
    setStep('idle')
    setQrCode(null)
    setSecret(null)
    setOtp('')
    setOtpError(undefined)
    setUseBackupDisable(false)
    setBackupCodeDisable('')
  }

  const handleSetup = async () => {
    setLoading(true)
    try {
      const res = await api.post('/auth/2fa/setup')
      setQrCode(res.data.qr_code)
      setSecret(res.data.secret)
      setStep('setup')
    } catch (err: any) {
      onError(err.response?.data?.detail || t.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifySetup = async () => {
    if (otp.length < 6) return
    setLoading(true)
    setOtpError(undefined)
    try {
      const res = await api.post('/auth/2fa/verify-setup', { code: otp })
      await refreshUser()
      if (res.data.backup_codes) setBackupCodes(res.data.backup_codes)
      onSuccess(t.auth.twofa_enabled_success)
    } catch (err: any) {
      setOtpError(t.auth.twofa_invalid)
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    if (otp.length < 6) return
    setLoading(true)
    setOtpError(undefined)
    try {
      await api.post('/auth/2fa/disable', { code: otp })
      await refreshUser()
      onSuccess(t.auth.twofa_disabled_success)
      reset()
    } catch (err: any) {
      setOtpError(t.auth.twofa_invalid)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
      {/* En-tete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: step === 'idle' ? 0 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totpEnabled
            ? <ShieldCheck size={18} color={GREEN} />
            : <ShieldOff size={18} color={TAUPE} />}
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, margin: 0 }}>{t.auth.twofa_section_title}</p>
            <p style={{ fontSize: 12, color: totpEnabled ? GREEN : TAUPE, margin: 0, marginTop: 2 }}>
              {totpEnabled ? t.auth.twofa_status_enabled : t.auth.twofa_status_disabled}
            </p>
          </div>
        </div>
        {step === 'idle' && (totpEnabled === false) && (
          <Button variant='primary' size='sm' loading={loading} onClick={handleSetup}>
            {t.auth.twofa_enable_btn}
          </Button>
        )}
        {step === 'idle' && (totpEnabled === false) && (<span/>)}
        {step === 'idle' && totpEnabled && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant='danger' size='sm' loading={loading} onClick={() => setStep('disable')} style={{ width: '100%' }}>
              {t.auth.twofa_disable_btn}
            </Button>
            <Button variant='ghost' size='sm' loading={loading} style={{ width: '100%', backgroundColor: '#F5F2EE', color: '#1A1A1A' }} onClick={async () => {
              setLoading(true)
              try {
                const res = await api.post('/auth/2fa/backup-codes/generate')
                setBackupCodes(res.data.backup_codes)
              } catch (err: any) {
                onError(err.response?.data?.detail || t.errors.generic)
              } finally {
                setLoading(false)
              }
            }}>
              {t.auth.twofa_regen_btn}
            </Button>
          </div>
        )}
      </div>

      {/* Setup : QR code + secret */}
      {step === 'setup' && qrCode && (
        <div>
          <p style={{ fontSize: 13, color: TAUPE, marginBottom: 16, lineHeight: 1.5 }}>{t.auth.twofa_setup_instructions}</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <img src={`data:image/png;base64,${qrCode}`} alt="QR Code 2FA" style={{ width: 160, height: 160, borderRadius: 8, border: `1px solid ${BORDER}` }} />
          </div>
          <p style={{ fontSize: 12, color: TAUPE, textAlign: 'center', marginBottom: 8 }}>{t.auth.twofa_manual_entry}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: SAND, borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
            <code style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: CHARCOAL, letterSpacing: 2, wordBreak: 'break-all' }}>{secret}</code>
            <button onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              {copied ? <Check size={15} color={GREEN} /> : <Copy size={15} color={TAUPE} />}
            </button>
          </div>
          <p style={{ fontSize: 13, color: CHARCOAL, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>{t.auth.twofa_enter_code}</p>
          <OtpInput value={otp} onChange={val => { setOtp(val); setOtpError(undefined) }} error={otpError} disabled={loading} />
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Button variant="ghost" size="sm" onClick={reset} style={{ flex: 1 }}>{t.auth.twofa_cancel}</Button>
            <Button size="sm" loading={loading} onClick={handleVerifySetup} style={{ flex: 2 }}>{t.auth.twofa_confirm_btn}</Button>
          </div>
        </div>
      )}

      {/* Desactivation */}
      {step === 'disable' && (
        <div>
          <p style={{ fontSize: 13, color: TAUPE, marginBottom: 16, lineHeight: 1.5 }}>{t.auth.twofa_disable_instructions}</p>
          {!useBackupDisable ? (
            <OtpInput value={otp} onChange={val => { setOtp(val); setOtpError(undefined) }} error={otpError} disabled={loading} />
          ) : (
            <input
              type="text"
              placeholder={t.auth.twofa_backup_placeholder}
              value={backupCodeDisable}
              onChange={e => { setBackupCodeDisable(e.target.value.toUpperCase()); setOtpError(undefined) }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontFamily: 'monospace', fontSize: 15, letterSpacing: 2, boxSizing: 'border-box' }}
            />
          )}
          {otpError && <p style={{ textAlign: 'center', color: '#DC0029', fontSize: 12, marginTop: 8 }}>{otpError}</p>}
          <button type="button" onClick={() => { setUseBackupDisable(!useBackupDisable); setOtp(''); setBackupCodeDisable(''); setOtpError(undefined) }}
            style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888' }}>
            {useBackupDisable ? t.auth.twofa_enter_code : t.auth.twofa_use_backup}
          </button>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="ghost" size="sm" onClick={reset} style={{ flex: 1 }}>{t.auth.twofa_cancel}</Button>
            <Button variant="danger" size="sm" loading={loading} onClick={async () => {
              if (useBackupDisable) {
                if (backupCodeDisable.length < 11) return
                setLoading(true); setOtpError(undefined)
                try {
                  await api.post('/auth/2fa/disable', { code: backupCodeDisable })
                  await refreshUser(); onSuccess(t.auth.twofa_disabled_success); reset()
                } catch { setOtpError(t.auth.twofa_backup_invalid) }
                finally { setLoading(false) }
              } else { handleDisable() }
            }} style={{ flex: 2 }}>{t.auth.twofa_confirm_disable_btn}</Button>
          </div>
        </div>
      )}
      {/* Backup codes modal */}
      {backupCodes.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: CHARCOAL, marginBottom: 4 }}>{t.auth.twofa_backup_codes_title}</p>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 12 }}>{t.auth.twofa_backup_codes_subtitle}</p>
            <div style={{ background: SAND, borderRadius: 8, padding: 12, marginBottom: 8 }}>
              {backupCodes.map((c, i) => (
                <p key={i} style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: CHARCOAL, margin: '4px 0', letterSpacing: 2 }}>{c}</p>
              ))}
            </div>
            <p style={{ fontSize: 11, color: RED, fontWeight: 600, marginBottom: 16 }}>{t.auth.twofa_backup_codes_warning}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant='ghost' size='sm' onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); setBackupCopied(true); setTimeout(() => setBackupCopied(false), 2000) }} style={{ flex: 1 }}>
                {backupCopied ? t.auth.twofa_backup_codes_copied : t.auth.twofa_backup_codes_copy}
              </Button>
              <Button size='sm' onClick={() => { setBackupCodes([]); reset() }} style={{ flex: 1 }}>
                {t.auth.twofa_backup_codes_close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
