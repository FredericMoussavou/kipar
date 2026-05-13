'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED } from '@/lib/theme'

type Section = { heading: string; body: string }
type PageContent = { title: string; sections: Section[] }

export default function CookiesPage() {
  const router = useRouter()
  const { lang } = useTranslation()

  const content: Record<string, PageContent> = {
    fr: {
      title: 'Politique de Cookies',
      sections: [
      { heading: "Qu'est-ce qu'un cookie ?", body: "Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d'un site. Il permet de mémoriser vos préférences et d'améliorer votre expérience." },
      { heading: "Cookies utilisés", body: "KIPAR utilise des cookies strictement nécessaires (authentification, session), des cookies de préférences (langue, devise) et des cookies analytiques anonymisés pour améliorer le service." },
      { heading: "Cookies tiers", body: "Certains services intégrés (Cloudinary, Stripe) peuvent déposer leurs propres cookies. Nous n'avons pas de contrôle direct sur ces cookies." },
      { heading: "Gérer vos cookies", body: "Vous pouvez configurer votre navigateur pour refuser les cookies. Attention : certaines fonctionnalités de KIPAR peuvent ne plus fonctionner correctement sans les cookies nécessaires." },
      { heading: "Durée de conservation", body: "Les cookies de session expirent à la fermeture du navigateur. Les cookies persistants ont une durée maximale de 12 mois." },
      { heading: "Contact", body: "Pour toute question sur les cookies : privacy@kipar.app" },
    ]
    },
    en: {
      title: 'Cookie Policy',
      sections: [
      { heading: "What is a cookie?", body: "A cookie is a small text file placed on your device when you visit a website. It allows your preferences to be remembered and improves your experience." },
      { heading: "Cookies used", body: "KIPAR uses strictly necessary cookies (authentication, session), preference cookies (language, currency) and anonymized analytics cookies to improve the service." },
      { heading: "Third-party cookies", body: "Some integrated services (Cloudinary, Stripe) may set their own cookies. We have no direct control over these cookies." },
      { heading: "Managing your cookies", body: "You can configure your browser to refuse cookies. Note: some KIPAR features may no longer work properly without necessary cookies." },
      { heading: "Retention period", body: "Session cookies expire when the browser is closed. Persistent cookies have a maximum duration of 12 months." },
      { heading: "Contact", body: "For any question about cookies: privacy@kipar.app" },
    ]
    },
    es: {
      title: 'Política de Cookies',
      sections: [
      { heading: "¿Qué es una cookie?", body: "Una cookie es un pequeño archivo de texto depositado en su dispositivo al visitar un sitio web. Permite recordar sus preferencias y mejorar su experiencia." },
      { heading: "Cookies utilizadas", body: "KIPAR utiliza cookies estrictamente necesarias (autenticación, sesión), cookies de preferencias (idioma, moneda) y cookies analíticas anonimizadas para mejorar el servicio." },
      { heading: "Cookies de terceros", body: "Algunos servicios integrados (Cloudinary, Stripe) pueden instalar sus propias cookies. No tenemos control directo sobre estas cookies." },
      { heading: "Gestión de cookies", body: "Puede configurar su navegador para rechazar las cookies. Nota: algunas funciones de KIPAR pueden dejar de funcionar correctamente sin las cookies necesarias." },
      { heading: "Período de conservación", body: "Las cookies de sesión expiran al cerrar el navegador. Las cookies persistentes tienen una duración máxima de 12 meses." },
      { heading: "Contacto", body: "Para cualquier consulta sobre cookies: privacy@kipar.app" },
    ]
    },
  }

  const page = content[lang] ?? content['fr']

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: TAUPE, fontSize: 13, marginBottom: 32, padding: 0 }}
      >
        <ArrowLeft size={14} />
        Retour
      </button>

      <p style={{ fontFamily: 'var(--font-syne, Syne)', fontSize: 28, fontWeight: 900, color: CHARCOAL, marginBottom: 4, letterSpacing: '-1px' }}>
        KI<span style={{ color: RED }}>PAR</span>
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: CHARCOAL, marginBottom: 32 }}>{page.title}</h1>

      {page.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.heading}</h2>
          <p style={{ fontSize: 14, color: TAUPE, lineHeight: 1.8 }}>{s.body}</p>
        </div>
      ))}

      <p style={{ fontSize: 11, color: TAUPE, marginTop: 48, paddingTop: 16, borderTop: '1px solid ' + BORDER }}>
        &copy; {new Date().getFullYear()} KIPAR. Tous droits réservés.
      </p>
    </div>
  )
}
