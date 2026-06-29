'use client'
import { Turnstile } from '@marsidev/react-turnstile'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
}

/**
 * Widget Cloudflare Turnstile (anti-bot).
 * Remonte le token via onVerify. Si la site key n'est pas configuree, ne rend rien
 * (le backend bypassera la verification cote serveur si le secret est vide).
 */
export default function TurnstileWidget({ onVerify, onExpire }: Props) {
  if (!SITE_KEY) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
      <Turnstile
        siteKey={SITE_KEY}
        options={{ theme: 'light', size: 'flexible' }}
        onSuccess={onVerify}
        onExpire={() => onExpire?.()}
        onError={() => onExpire?.()}
      />
    </div>
  )
}