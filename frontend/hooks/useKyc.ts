import { useState, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/api'

export type KycStatus = 'idle' | 'started' | 'polling' | 'approved' | 'timeout' | 'error'

interface UseKycOptions {
  onApproved?: () => void
}

export function useKyc(options?: UseKycOptions) {
  const { patchUser } = useAuthStore()
  const [status, setStatus] = useState<KycStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startKyc = async () => {
    setError(null)
    setStatus('started')
    try {
      const res = await api.post('/kyc/init')
      if (!res.data.verification_url) {
        setStatus('error')
        setError('Impossible de lancer la verification')
        return
      }
      window.open(res.data.verification_url, '_blank')
      setStatus('polling')
      let attempts = 0
      const maxAttempts = 60
      pollRef.current = setInterval(async () => {
        attempts++
        try {
          const me = await api.get('/users/me')
          if (me.data.kyc_status === 'approved') {
            clearInterval(pollRef.current!)
            setStatus('approved')
            patchUser({ kyc_status: 'approved' })
            options?.onApproved?.()
            return
          }
        } catch {}
        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current!)
          setStatus('timeout')
        }
      }, 5000)
    } catch (err: any) {
      setStatus('error')
      setError(err?.response?.data?.detail || 'Erreur KYC')
    }
  }

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStatus('idle')
    setError(null)
  }

  return {
    status, error,
    isIdle: status === 'idle',
    isStarted: status === 'started',
    isPolling: status === 'polling',
    isApproved: status === 'approved',
    isTimeout: status === 'timeout',
    isError: status === 'error',
    isLoading: status === 'started' || status === 'polling',
    startKyc, reset,
  }
}
