'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED } from '@/lib/theme'

type Section = { heading: string; body: string }
type PageContent = { title: string; sections: Section[] }

export default function MentionsLegalesPage() {
  const router = useRouter()
  const { lang } = useTranslation()

  const content: Record<string, PageContent> = {
    fr: {
      title: 'Mentions Légales',
      sections: [
      { heading: "Éditeur", body: "KIPAR SAS — Société par Actions Simplifiée au capital de 10 000 €. Siège social : France. Email : contact@kipar.app" },
      { heading: "Directeur de publication", body: "Le directeur de publication est le représentant légal de KIPAR SAS." },
      { heading: "Hébergement", body: "La plateforme est hébergée par des prestataires cloud certifiés ISO 27001, localisés dans l'Union Européenne." },
      { heading: "Propriété intellectuelle", body: "L'ensemble des éléments de la plateforme KIPAR (logo, design, code, contenus) sont la propriété exclusive de KIPAR SAS et protégés par le droit d'auteur." },
      { heading: "Liens hypertextes", body: "KIPAR ne saurait être tenu responsable du contenu des sites tiers vers lesquels des liens sont proposés." },
      { heading: "Contact", body: "Pour toute question : contact@kipar.app" },
    ]
    },
    en: {
      title: 'Legal Notice',
      sections: [
      { heading: "Publisher", body: "KIPAR SAS — Simplified Joint Stock Company with capital of €10,000. Registered office: France. Email: contact@kipar.app" },
      { heading: "Publication director", body: "The publication director is the legal representative of KIPAR SAS." },
      { heading: "Hosting", body: "The platform is hosted by ISO 27001 certified cloud providers located in the European Union." },
      { heading: "Intellectual property", body: "All elements of the KIPAR platform (logo, design, code, content) are the exclusive property of KIPAR SAS and protected by copyright." },
      { heading: "Hyperlinks", body: "KIPAR cannot be held responsible for the content of third-party sites to which links are provided." },
      { heading: "Contact", body: "For any question: contact@kipar.app" },
    ]
    },
    es: {
      title: 'Aviso Legal',
      sections: [
      { heading: "Editor", body: "KIPAR SAS — Sociedad por Acciones Simplificada con capital de 10.000 €. Domicilio social: Francia. Correo: contact@kipar.app" },
      { heading: "Director de publicación", body: "El director de publicación es el representante legal de KIPAR SAS." },
      { heading: "Alojamiento", body: "La plataforma está alojada por proveedores cloud certificados ISO 27001 ubicados en la Unión Europea." },
      { heading: "Propiedad intelectual", body: "Todos los elementos de la plataforma KIPAR (logo, diseño, código, contenidos) son propiedad exclusiva de KIPAR SAS y están protegidos por derechos de autor." },
      { heading: "Hipervínculos", body: "KIPAR no puede ser responsable del contenido de sitios de terceros a los que se proporcionan enlaces." },
      { heading: "Contacto", body: "Para cualquier consulta: contact@kipar.app" },
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
