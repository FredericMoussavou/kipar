'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/apiError'
import { ChevronRight, ChevronLeft, Check, Upload, X, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { Button, Input } from '@/components/ui/kipar'
import Select from '@/components/ui/kipar/Select'
import PhoneInputField from '@/components/ui/kipar/PhoneInputField'
import api from '@/lib/api'
import { useKyc } from '@/hooks/useKyc'
import { RED, CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, GREEN } from '@/lib/theme'

const STEPS = ['personal', 'preferences', 'payment', 'identity', 'done']
const CURRENCIES = ['EUR','GBP','USD','CHF','CAD','AUD','XOF','XAF','MAD','EGP','KES','NGN','GHS','ZAR','HTG','BRL','MXN','AED','INR','CNY']
const LANGUAGES = [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
type NominatimResult = { display_name: string; place_id: number }

export default function OnboardingPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, patchUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 0 — Personal
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [address, setAddress] = useState(user?.address ?? '')
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [phone, setPhone] = useState(user?.phone ?? '')
  const addressRef = useRef<HTMLDivElement>(null)
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 1 — Preferences
  const [language, setLanguage] = useState(user?.language ?? 'fr')
  const [weightUnit, setWeightUnit] = useState(user?.weight_unit ?? 'kg')
  const [currency, setCurrency] = useState(user?.currency ?? 'EUR')

  // Step 2 — Payment
  const [paymentMethod, setPaymentMethod] = useState(user?.payment_method ?? 'iban')
  const [iban, setIban] = useState(user?.iban ?? '')
  const [ibanError, setIbanError] = useState('')
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState(user?.mobile_money_number ?? '')
  const [paymentCountry, setPaymentCountry] = useState(user?.payment_country ?? '')

  // Step 3 — Identity iDenfy
  const { startKyc, isLoading: kycLoading, isApproved: kycVerified, isPolling: kycPolling, isTimeout: kycTimeout } = useKyc({
    onApproved: () => setTimeout(() => setStep(s => s + 1), 2000)
  })

  const progress = (step / (STEPS.length - 1)) * 100

  // ── Fermer suggestions si clic extérieur ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Vérification username (debounce 400ms) ──
  const checkUsername = useCallback((value: string) => {
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current)
    if (!value || value === user?.username) { setUsernameStatus('idle'); return }
    if (!/^[a-z0-9_]{4,15}$/.test(value)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    usernameDebounce.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/check-username', { params: { username: value } })
        setUsernameStatus(res.data.available ? 'available' : 'taken')
      } catch {
        setUsernameStatus('idle')
      }
    }, 400)
  }, [user?.username])

  const handleUsernameChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)
    checkUsername(clean)
  }

  // ── Autocomplétion Nominatim (debounce 500ms) ──
  const searchAddress = useCallback((value: string) => {
    if (addressDebounce.current) clearTimeout(addressDebounce.current)
    if (value.length < 3) { setAddressSuggestions([]); setShowSuggestions(false); return }
    setAddressLoading(true)
    addressDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': user?.language ?? 'fr' } }
        )
        const data: NominatimResult[] = await res.json()
        setAddressSuggestions(data)
        setShowSuggestions(data.length > 0)
      } catch {
        setAddressSuggestions([])
      } finally {
        setAddressLoading(false)
      }
    }, 500)
  }, [user?.language])

  const handleAddressChange = (value: string) => {
    setAddress(value)
    searchAddress(value)
  }

  const selectAddress = (suggestion: NominatimResult) => {
    setAddress(suggestion.display_name)
    setAddressSuggestions([])
    setShowSuggestions(false)
  }

  // ── Validation étape 0 ──
  const step0Valid =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    username.length >= 4 &&
    (usernameStatus === 'available' || usernameStatus === 'idle' && username === user?.username) &&
    address.trim().length >= 5 &&
    phone.trim().length >= 8


  const saveStep = async () => {
    setSaving(true)
    try {
      if (step === 0) {
        const payload: Record<string, string> = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          address: address.trim(),
        }
        if (phone && phone !== user?.phone) payload.phone = phone
        if (username !== user?.username) payload.username = username
        await api.patch('/users/me', payload)
        patchUser({ first_name: firstName.trim(), last_name: lastName.trim(), address: address.trim(), username, phone: phone || user?.phone || null })
      } else if (step === 1) {
        await api.patch('/users/me/language', { language })
        await api.patch('/users/me', { weight_unit: weightUnit, currency })
        patchUser({ language, weight_unit: weightUnit, currency })
      } else if (step === 2) {
        const fields: Record<string, string> = { payment_method: paymentMethod, payment_country: paymentCountry }
        if (paymentMethod === 'iban') fields.iban = iban
        else fields.mobile_money_number = mobileMoneyNumber
        await api.patch('/users/me', fields)
        patchUser(fields)
      } else if (step === 3) {
        // iDenfy : generer une session + polling
        await startKyc()
        return // Ne pas avancer automatiquement
      }
      if (step === STEPS.length - 2) {
        await api.patch('/users/me', { onboarding_completed: true })
        patchUser({ onboarding_completed: true })
        setStep(STEPS.length - 1)
      } else {
        setStep(s => s + 1)
      }
    } catch (err: any) {
      toast.error(extractApiError(err, t.errors.generic))
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: TAUPE, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8, display: 'block' as const }
  const selectStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none' }
  const cardStyle = { background: WHITE, border: '1px solid ' + BORDER, borderRadius: 16, padding: 20, marginBottom: 12 }
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + BORDER, fontSize: 13, color: CHARCOAL, background: WHITE, outline: 'none', boxSizing: 'border-box' as const }

  const UsernameIcon = () => {
    if (usernameStatus === 'checking') return <Loader size={14} color={TAUPE} style={{ animation: 'spin 1s linear infinite' }} />
    if (usernameStatus === 'available') return <CheckCircle size={14} color={GREEN} />
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return <XCircle size={14} color={RED} />
    return null
  }

  const usernameHintColor = usernameStatus === 'available' ? GREEN : usernameStatus === 'taken' || usernameStatus === 'invalid' ? RED : TAUPE
  const usernameHint = usernameStatus === 'available' ? t.onboarding.username_available
    : usernameStatus === 'taken' ? t.onboarding.username_taken
    : usernameStatus === 'invalid' ? t.onboarding.username_invalid
    : usernameStatus === 'checking' ? t.onboarding.username_checking
    : t.onboarding.field_username_hint

  return (
    <div style={{ minHeight: '100vh', background: SAND, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-syne,Syne)', fontSize: 28, fontWeight: 900, color: CHARCOAL, letterSpacing: '-0.02em', marginBottom: 8 }}>
            KIPAR.
          </h1>
          {step < STEPS.length - 1 && (
            <p style={{ fontSize: 13, color: TAUPE }}>{t.onboarding.step_label} {step + 1}/{STEPS.length - 1}</p>
          )}
        </div>

        {/* Progress bar */}
        {step < STEPS.length - 1 && (
          <div style={{ height: 4, background: BORDER, borderRadius: 99, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: RED, borderRadius: 99, transition: 'width 0.3s ease' }} />
          </div>
        )}

        {/* Step 0 — Personal */}
        {step === 0 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>{t.onboarding.personal_title}</h2>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.onboarding.personal_subtitle}</p>

            {/* Prénom + Nom */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <Input label={t.onboarding.field_first_name} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t.onboarding.ph_first_name} />
              </div>
              <div style={{ flex: 1 }}>
                <Input label={t.onboarding.field_last_name} value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t.onboarding.ph_last_name} />
              </div>
            </div>

            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <Input
                label={t.onboarding.field_username}
                value={username}
                onChange={e => handleUsernameChange(e.target.value)}
                placeholder={t.onboarding.ph_username}
                maxLength={15}
                rightIcon={<UsernameIcon />}
              />
              <p style={{ fontSize: 11, color: usernameHintColor, marginTop: 4 }}>{usernameHint}</p>
            </div>

            {/* Adresse */}
            <div style={{ marginBottom: 16 }} ref={addressRef}>
              <div style={{ position: 'relative' }}>
                <Input
                  label={t.onboarding.field_address}
                  value={address}
                  onChange={e => handleAddressChange(e.target.value)}
                  placeholder={t.onboarding.field_address_hint}
                  rightIcon={addressLoading ? <Loader size={14} color={TAUPE} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: WHITE, border: '1px solid ' + BORDER, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                    {addressSuggestions.map(s => (
                      <button key={s.place_id} type="button" onClick={() => selectAddress(s)}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid ' + BORDER, fontSize: 12, color: CHARCOAL, cursor: 'pointer', lineHeight: 1.4 }}>
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label style={labelStyle}>{t.profile_edit.field_phone}</label>
              <PhoneInputField value={phone} onChange={setPhone} />
            </div>
          </div>
        )}

        {/* Step 1 — Preferences */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>{t.onboarding.pref_title}</h2>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.onboarding.pref_subtitle}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t.profile_edit.pref_language}</label>
              <Select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t.profile_edit.pref_weight}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['kg', 'lb'].map(u => (
                  <button key={u} type="button" onClick={() => setWeightUnit(u)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${weightUnit === u ? RED : BORDER}`, background: weightUnit === u ? 'rgba(220,0,41,0.05)' : WHITE, color: weightUnit === u ? RED : CHARCOAL2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t.profile_edit.pref_currency}</label>
              <Select value={currency} onChange={e => setCurrency(e.target.value)} style={selectStyle}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>{t.onboarding.payment_title}</h2>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.onboarding.payment_subtitle}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t.profile_edit.pref_payment_method}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['iban', 'mobile_money'].map(m => (
                  <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${paymentMethod === m ? RED : BORDER}`, background: paymentMethod === m ? 'rgba(220,0,41,0.05)' : WHITE, color: paymentMethod === m ? RED : CHARCOAL2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {m === 'iban' ? 'IBAN' : 'Mobile Money'}
                  </button>
                ))}
              </div>
            </div>
            {paymentMethod === 'iban' ? (
              <div>
                <Input label="IBAN" value={iban} onChange={e => { setIban(e.target.value); setIbanError('') }}
                  placeholder="FR76 3000 6000 0112 3456 7890 189"
                  error={ibanError || undefined}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Input label={t.profile_edit.pref_payment_country} value={paymentCountry} onChange={e => setPaymentCountry(e.target.value)} placeholder="SN, CI, CM..." />
                </div>
                <div>
                  <label style={labelStyle}>{t.profile_edit.pref_mobile_money}</label>
                  <PhoneInputField value={mobileMoneyNumber} onChange={setMobileMoneyNumber} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Identity */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>{t.onboarding.identity_title}</h2>
            <p style={{ fontSize: 13, color: TAUPE, marginBottom: 20 }}>{t.onboarding.identity_subtitle}</p>
            {kycVerified ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{t.onboarding.kyc_verified ?? 'Identité vérifiée !'}</p>
                <p style={{ fontSize: 13, color: TAUPE, marginTop: 8 }}>{t.onboarding.kyc_verified_sub ?? 'Vous allez être redirigé...'}</p>
              </div>
            ) : kycPolling ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🔄</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, marginBottom: 8 }}>{t.onboarding.kyc_waiting ?? 'En attente de confirmation...'}</p>
                <p style={{ fontSize: 12, color: TAUPE, marginBottom: 20 }}>{t.onboarding.kyc_waiting_sub ?? 'Complétez la vérification dans l’onglet ouvert'}</p>
                <button type='button' onClick={async () => {
                  try {
                    const me = await api.get('/users/me')
                    if (me.data.kyc_status === 'approved') {
                      patchUser({ kyc_status: 'approved' })
                      setTimeout(() => setStep(s => s + 1), 2000)
                    }
                  } catch {}
                }}
                  style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid ' + BORDER, background: WHITE, color: CHARCOAL, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t.onboarding.kyc_check_btn ?? 'J’ai terminé la vérification'}
                </button>
              </div>
            ) : kycTimeout ? (
              <div style={{ background: '#FFF3CD', border: '1px solid #FFE082', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>{t.onboarding.kyc_timeout ?? 'Vérification en cours'}</p>
                <p style={{ fontSize: 12, color: '#92400E' }}>{t.onboarding.kyc_timeout_sub ?? 'Vous recevrez une notification dès que votre identité sera confirmée.'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: SAND, borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 13, color: CHARCOAL, fontWeight: 600, marginBottom: 8 }}>{t.onboarding.kyc_how_title}</p>
                  <p style={{ fontSize: 12, color: TAUPE, marginBottom: 4 }}>📱 {t.onboarding.kyc_step1}</p>
                  <p style={{ fontSize: 12, color: TAUPE, marginBottom: 4 }}>📄 {t.onboarding.kyc_step2}</p>
                  <p style={{ fontSize: 12, color: TAUPE }}>🤳 {t.onboarding.kyc_step3}</p>
                </div>
                <p style={{ fontSize: 11, color: TAUPE, textAlign: 'center' }}>{t.onboarding.kyc_mobile_tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Done */}
        {step === 4 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={32} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: CHARCOAL, marginBottom: 8 }}>{t.onboarding.done_title}</h2>
            <p style={{ fontSize: 14, color: TAUPE, marginBottom: 32 }}>{t.onboarding.done_subtitle}</p>
            <Button fullWidth size="lg" onClick={() => router.push('/dashboard')}>
              {t.onboarding.done_btn}
            </Button>
          </div>
        )}

        {/* Navigation */}
        {step < STEPS.length - 1 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {step > 0 && (
              <Button variant="outline" size="md" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>
                <ChevronLeft size={16} /> {t.onboarding.back_btn}
              </Button>
            )}
            <Button size="md" loading={saving} disabled={saving || (step === 0 && !step0Valid)} onClick={saveStep} style={{ flex: 2 }}>
              {step === STEPS.length - 2 ? t.onboarding.finish_btn : t.onboarding.next_btn} {!saving && <ChevronRight size={16} />}
            </Button>
          </div>
        )}

        {/* Skip (étapes 1-3 uniquement) */}
        {step < STEPS.length - 1 && step > 0 && (
          <button type="button"
            onClick={() => {
              if (step === STEPS.length - 2) {
                api.patch('/users/me', { onboarding_completed: true })
                patchUser({ onboarding_completed: true })
                router.push('/dashboard')
              } else {
                setStep(s => s + 1)
              }
            }}
            style={{ width: '100%', marginTop: 12, padding: '8px', background: 'none', border: 'none', color: TAUPE, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            {t.onboarding.skip_btn}
          </button>
        )}
      </div>
    </div>
  )
}
