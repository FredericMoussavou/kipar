'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { extractApiError } from '@/lib/apiError'
import { useAuthStore } from '@/stores/auth.store'
import { getLangCookie } from '@/lib/langCookie'

/**
 * Hook de publication depuis la landing (formulaire public a 2 onglets).
 *
 * Cas geres :
 *  - CONNECTE : POST direct (le backend pose open|pending_kyc), redirection vers l'objet.
 *  - VISITEUR / NOUVEAU COMPTE (mode 'register') : persiste l'objet, cree le compte,
 *    authentifie (token + user), va sur /onboarding. La publication reelle se fait a la
 *    reprise au dashboard (consumePendingPublish) une fois l'onboarding termine.
 *  - VISITEUR / COMPTE EXISTANT (mode 'login') : login (email+password), authentifie,
 *    puis publie DIRECTEMENT (l'utilisateur est deja onboarde). Si 2FA active : on ne
 *    contourne pas -> message + redirection vers /login (le pending est conserve).
 */

export type PublishType = 'trip' | 'request'
export type PublishMode = 'register' | 'login'

export interface GuestUserInfo {
  email: string
  password: string
  // Requis seulement en mode 'register' :
  first_name?: string
  last_name?: string
  cgu_accepted?: boolean
  turnstile_token?: string
}

export interface PendingPublish {
  type: PublishType
  payload: Record<string, any>
}

const PENDING_KEY = 'kipar_pending_publish'

function endpointFor(type: PublishType): string {
  return type === 'trip' ? '/trips' : '/requests'
}
function objectPath(type: PublishType, id: string): string {
  return type === 'trip' ? `/trips/${id}` : `/requests/${id}`
}

export function storePendingPublish(pending: PendingPublish) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)) } catch { /* ignore */ }
}
export function readPendingPublish(): PendingPublish | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingPublish) : null
  } catch { return null }
}
export function clearPendingPublish() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
}

/**
 * Reprise post-onboarding : a appeler au dashboard.
 * Si un objet est en attente, le publie puis redirige vers sa page.
 */
export async function consumePendingPublish(
  push: (path: string) => void,
): Promise<boolean> {
  const pending = readPendingPublish()
  if (!pending) return false
  try {
    const res = await api.post(endpointFor(pending.type), pending.payload)
    clearPendingPublish()
    const id = res?.data?.id
    if (id) push(objectPath(pending.type, id))
    return true
  } catch (err: any) {
    clearPendingPublish()
    toast.error(extractApiError(err, 'La publication a echoue, veuillez reessayer depuis votre espace.'))
    return false
  }
}

export function useGuestPublish() {
  const router = useRouter()
  const { isAuthenticated, setToken, setRefreshToken, refreshUser } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

  /** Publie directement l'objet (utilisateur authentifie) et redirige vers sa page. */
  const publishDirect = async (type: PublishType, payload: Record<string, any>) => {
    const res = await api.post(endpointFor(type), payload)
    const id = res?.data?.id
    if (id) router.push(objectPath(type, id))
  }

  /**
   * @param mode 'register' (nouveau compte) | 'login' (compte existant). Defaut 'register'.
   */
  const submitPublish = async (
    type: PublishType,
    payload: Record<string, any>,
    userInfo?: GuestUserInfo,
    mode: PublishMode = 'register',
  ): Promise<'email_exists' | void> => {
    setSubmitting(true)
    try {
      // Deja connecte : publication directe.
      if (isAuthenticated()) {
        await publishDirect(type, payload)
        return
      }

      if (!userInfo) {
        toast.error('Informations de compte manquantes.')
        return
      }

      // ===== MODE LOGIN (compte existant) =====
      if (mode === 'login') {
        try {
          const res = await api.post('/auth/login', {
            email: userInfo.email,
            password: userInfo.password,
          })
          // 2FA active -> on ne contourne pas : message + redirection login (pending conserve).
          if (res?.data?.token_type === '2fa_required' || !res?.data?.access_token) {
            storePendingPublish({ type, payload })
            toast.message('Connectez-vous depuis la page de connexion pour finaliser la publication.')
            router.push('/login')
            return
          }
          setToken(res.data.access_token)
          if (res.data.refresh_token) setRefreshToken(res.data.refresh_token)
          await refreshUser()
        } catch (err: any) {
          toast.error(extractApiError(err, 'Identifiants invalides.'))
          return
        }
        // Utilisateur existant deja onboarde -> publication directe.
        try {
          await publishDirect(type, payload)
        } catch (err: any) {
          toast.error(extractApiError(err, 'La publication a echoue.'))
        }
        return
      }

      // ===== MODE REGISTER (nouveau compte) =====
      if (!userInfo.cgu_accepted) {
        toast.error('Vous devez accepter les conditions generales.')
        return
      }
      // 1) persister l'objet pour survie au flow register -> onboarding
      storePendingPublish({ type, payload })
      // 2) creer le compte ET authentifier
      try {
        const reg = await api.post('/auth/register', {
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          email: userInfo.email,
          password: userInfo.password,
          language: getLangCookie(),
          cgu_accepted: userInfo.cgu_accepted,
          turnstile_token: userInfo.turnstile_token,
        })
        if (reg?.data?.access_token) setToken(reg.data.access_token)
        if (reg?.data?.refresh_token) setRefreshToken(reg.data.refresh_token)
        await refreshUser()
      } catch (err: any) {
        clearPendingPublish()
        const status = err?.response?.status
        const msg = extractApiError(err, '')
        const emailExistsLabels = [
          'Email déjà utilisé',
          'Email already registered',
          'El correo electrónico ya está registrado',
        ]
        if (status === 400 && emailExistsLabels.some(l => msg === l)) {
          return 'email_exists'
        }
        toast.error(msg || 'La creation du compte a echoue.')
        return
      }
      // 3) vers l'onboarding ; publication a la reprise (dashboard)
      router.push('/onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  return { submitPublish, submitting }
}