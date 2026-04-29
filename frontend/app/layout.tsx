import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import Providers from './providers'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KIPAR. — Transport de colis entre particuliers',
  description: 'Envoyez vos colis partout dans le monde grâce à notre réseau de transporteurs vérifiés',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable}`}>
      <body className="antialiased font-sans">
        <ThemeProvider>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
