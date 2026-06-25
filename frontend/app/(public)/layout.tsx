'use client'
import VisitorNav from '@/components/layout/VisitorNav'
import { BG } from '@/lib/theme'
import { useTranslation } from '@/hooks/useTranslation'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <VisitorNav />
      <main className="md:max-w-5xl md:mx-auto md:px-6 md:pt-6 md:pb-12">{children}</main>
      <footer style={{ textAlign: 'center', padding: '16px 20px 80px', display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/cgu" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.terms}</a>
        <a href="/privacy" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.privacy}</a>
        <a href="/mentions-legales" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.legal}</a>
        <a href="/cookies" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.cookies}</a>
        <a href="/faq" style={{ fontSize: 11, color: '#B5AFAB', textDecoration: 'none' }}>{t.footer.faq}</a>
      </footer>
    </div>
  )
}