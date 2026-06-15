import type { Metadata } from 'next'
import Script from 'next/script'
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
        {process.env.NODE_ENV === 'production' && (
        <Script id="tawk-init" strategy="lazyOnload">
          {`
            var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
            Tawk_API.onLoad = function() { Tawk_API.hideWidget(); };
            Tawk_API.customStyle = {
              visibility: {
                desktop: { position: 'br', xOffset: 20, yOffset: 20 },
                mobile: { position: 'br', xOffset: 10, yOffset: 80 }
              }
            };
            (function(){
              var s1 = document.createElement('script'), s0 = document.getElementsByTagName('script')[0];
              s1.async = true;
              s1.src = 'https://embed.tawk.to/69f9ebcc04c2b71c35758284/1jns425or';
              s1.charset = 'UTF-8';
              s1.setAttribute('crossorigin', '*');
              s0.parentNode.insertBefore(s1, s0);
            })();
          `}
        </Script>
        )}
      </body>
    </html>
  )
}
