'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { GREEN } from '@/lib/theme'

const criteria = [
  { key: 'length',  test: (p: string) => p.length >= 8 },
  { key: 'upper',   test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit',   test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

interface Props {
  password: string
}

export default function PasswordStrengthHints({ password }: Props) {
  const { t } = useTranslation()

  if (!password) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0 12px' }}>
      {criteria.map(({ key, test }) => {
        const ok = test(password)
        const label = (t.profile_edit as any)[`pwd_hint_${key}`]
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: ok ? '#16A34A' : '#E5E1DC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 9, color: '#fff', fontWeight: 700,
              transition: 'background 0.2s',
            }}>
              {ok ? '✓' : ''}
            </span>
            <span style={{ fontSize: 11, color: ok ? '#16A34A' : '#7A736B', transition: 'color 0.2s' }}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
