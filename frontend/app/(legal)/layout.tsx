import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KIPAR — Informations légales',
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FBFBFF', padding: '0 0 80px' }}>
      {children}
    </div>
  )
}
