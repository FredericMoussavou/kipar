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
 * Gere les 3 cas :
 *  - VISITEUR (pas de token) : on persiste l'objet en sessionStorage (kipar_pending_publish),
 *    on cree le compte (POST /auth/register) puis on redirige vers /onboarding.
 *    La PUBLICATION reelle (POST /trips|/requests) est effectuee plus tard par la reprise
 *    au dashboard (consumePendingPublish), une fois l'onboarding termine.
 *  - CONNECTE + KYC ok : POST direct -> objet "open".
 *  - CONNECTE + KYC non ok : POST direct -> objet "pending_kyc".
 *  (Le backend pose le bon statut ; le front se contente d'appeler le POST.)
 *
 * Apres publication, redirection vers la page de l'objet cree.
 */

export type PublishType = 'trip' | 'request'

export interface GuestUserInfo {
  first_name: string
  last_name: string
  email: string
  password: string
  cgu_accepted: boolean
}

export interface PendingPublish {
  type: PublishType
  // payload deja pret pour l'API (champs convertis : floats, dates ISO, etc.)
  payload: Record<string, any>
}

const PENDING_KEY = 'kipar_pending_publish'

/** Endpoint API selon le type d'objet. */
function endpointFor(type: PublishType): string {
  return type === 'trip' ? '/trips' : '/requests'
}

/** Page de destination apres creation, selon le type. */
function objectPath(type: PublishType, id: string): string {
  return type === 'trip' ? `/trips/${id}` : `/requests/${id}`
}

/** Stocke l'objet a publier (cas visiteur), pour survie au flow register -> onboarding. */
export function storePendingPublish(pending: PendingPublish) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // quota/securite -> on ignore silencieusement
  }
}

/** Lit (sans supprimer) l'objet en attente. */
export function readPendingPublish(): PendingPublish | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingPublish) : null
  } catch {
    return null
  }
}

/** Efface l'objet en attente. */
export function clearPendingPublish() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
}

/**
 * Reprise post-onboarding : a appeler au dashboard.
 * Si un objet est en attente, le publie puis redirige vers sa page.
 * Retourne true si une publication a ete tentee (pour eviter d'autres redirections).
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
    if (id) {
      push(objectPath(pending.type, id))
    }
    return true
  } catch (err: any) {
    // En cas d'echec (ex: 422), on nettoie pour ne pas boucler, et on laisse l'user au dashboard.
    clearPendingPublish()
    toast.error(extractApiError(err, 'La publication a echoue, veuillez reessayer depuis votre espace.'))
    return false
  }
}

export function useGuestPublish() {
  const router = useRouter()
  const { isAuthenticated, setToken, setRefreshToken, refreshUser } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

  /**
   * Soumet une publication depuis la landing.
   * @param type 'trip' | 'request'
   * @param payload corps API pret a l'emploi
   * @param userInfo infos de compte (requis seulement si visiteur)
   */
  const submitPublish = async (
    type: PublishType,
    payload: Record<string, any>,
    userInfo?: GuestUserInfo,
  ): Promise<void> => {
    setSubmitting(true)
    try {
      if (isAuthenticated()) {
        // CONNECTE : publication directe, le backend pose open|pending_kyc.
        const res = await api.post(endpointFor(type), payload)
        const id = res?.data?.id
        if (id) router.push(objectPath(type, id))
        return
      }

      // VISITEUR : il faut les infos de compte.
      if (!userInfo) {
        toast.error('Informations de compte manquantes.')
        return
      }
      if (!userInfo.cgu_accepted) {
        toast.error('Vous devez accepter les conditions generales.')
        return
      }

      // 1) persister l'objet pour survie au flow register -> onboarding
      storePendingPublish({ type, payload })

      // 2) creer le compte ET authentifier (stocker le token retourne)
      try {
        const reg = await api.post('/auth/register', {
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          email: userInfo.email,
          password: userInfo.password,
          language: getLangCookie(),
          cgu_accepted: userInfo.cgu_accepted,
        })
        // Sans cela, le layout (app) ne voit pas de token -> redirige /onboarding vers /login.
        if (reg?.data?.access_token) setToken(reg.data.access_token)
        if (reg?.data?.refresh_token) setRefreshToken(reg.data.refresh_token)
        // Charger le user (GET /users/me) : le register ne retourne que le token.
        await refreshUser()
      } catch (err: any) {
        // register a echoue -> on retire l'objet en attente (sinon il serait publie au prochain login)
        clearPendingPublish()
        toast.error(extractApiError(err, 'La creation du compte a echoue.'))
        return
      }

      // 3) vers l'onboarding ; la publication se fera a la reprise (dashboard)
      router.push('/onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  return { submitPublish, submitting }
}