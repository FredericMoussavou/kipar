'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED } from '@/lib/theme'

type Section = { heading: string; body: string }
type PageContent = { title: string; sections: Section[] }

export default function PrivacyPage() {
  const router = useRouter()
  const { lang } = useTranslation()

  const content: Record<string, PageContent> = {
    fr: {
      title: 'Politique de Confidentialité',
      sections: [
      { heading: "Responsable du traitement", body: "KIPAR SAS est responsable du traitement de vos données personnelles collectées via la plateforme. Contact DPO : privacy@kipar.app" },
      { heading: "Données collectées", body: "Nous collectons : nom, prénom, email, numéro de téléphone, adresse IP, données de navigation, informations de paiement (via prestataire sécurisé), et documents KYC si applicable." },
      { heading: "Finalités", body: "Vos données sont utilisées pour : gérer votre compte, traiter les réservations, assurer la sécurité des transactions, respecter nos obligations légales, et améliorer nos services." },
      { heading: "Base légale", body: "Le traitement est fondé sur l'exécution du contrat (art. 6.1.b RGPD), le respect d'obligations légales (art. 6.1.c RGPD), et notre intérêt légitime à sécuriser la plateforme (art. 6.1.f RGPD)." },
      { heading: "Conservation", body: "Vos données sont conservées pendant la durée de votre compte, puis 3 ans après sa suppression pour les obligations comptables et légales." },
      { heading: "Vos droits", body: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez vos droits via : privacy@kipar.app ou via les paramètres de votre compte." },
      { heading: "Transferts internationaux", body: "Certains de nos prestataires sont situés hors UE. Ces transferts sont encadrés par des clauses contractuelles types approuvées par la Commission européenne." },
      { heading: "Contact", body: "Pour toute question relative à la protection de vos données : privacy@kipar.app. Vous pouvez également introduire une réclamation auprès de la CNIL." },
    ]
    },
    en: {
      title: 'Privacy Policy',
      sections: [
      { heading: "Data controller", body: "KIPAR SAS is the data controller for your personal data collected via the platform. DPO contact: privacy@kipar.app" },
      { heading: "Data collected", body: "We collect: name, email, phone number, IP address, browsing data, payment information (via secure provider), and KYC documents if applicable." },
      { heading: "Purposes", body: "Your data is used to: manage your account, process bookings, ensure transaction security, comply with legal obligations, and improve our services." },
      { heading: "Legal basis", body: "Processing is based on contract performance (Art. 6.1.b GDPR), legal obligations (Art. 6.1.c GDPR), and our legitimate interest in securing the platform (Art. 6.1.f GDPR)." },
      { heading: "Retention", body: "Your data is retained for the duration of your account, then 3 years after deletion for accounting and legal obligations." },
      { heading: "Your rights", body: "Under GDPR, you have the right to access, rectify, erase, port and object to your data. Exercise your rights via: privacy@kipar.app or your account settings." },
      { heading: "International transfers", body: "Some of our providers are located outside the EU. These transfers are governed by standard contractual clauses approved by the European Commission." },
      { heading: "Contact", body: "For any question about your data protection: privacy@kipar.app. You may also file a complaint with your local data protection authority." },
    ]
    },
    es: {
      title: 'Política de Privacidad',
      sections: [
      { heading: "Responsable del tratamiento", body: "KIPAR SAS es responsable del tratamiento de sus datos personales recopilados a través de la plataforma. Contacto DPO: privacy@kipar.app" },
      { heading: "Datos recopilados", body: "Recopilamos: nombre, correo electrónico, número de teléfono, dirección IP, datos de navegación, información de pago (a través de proveedor seguro) y documentos KYC si corresponde." },
      { heading: "Finalidades", body: "Sus datos se utilizan para: gestionar su cuenta, procesar reservas, garantizar la seguridad de las transacciones, cumplir con las obligaciones legales y mejorar nuestros servicios." },
      { heading: "Base legal", body: "El tratamiento se basa en la ejecución del contrato (Art. 6.1.b RGPD), obligaciones legales (Art. 6.1.c RGPD) y nuestro interés legítimo en asegurar la plataforma (Art. 6.1.f RGPD)." },
      { heading: "Conservación", body: "Sus datos se conservan durante la vigencia de su cuenta, luego 3 años después de su eliminación por obligaciones contables y legales." },
      { heading: "Sus derechos", body: "Conforme al RGPD, tiene derecho de acceso, rectificación, supresión, portabilidad y oposición. Ejerza sus derechos en: privacy@kipar.app o desde la configuración de su cuenta." },
      { heading: "Transferencias internacionales", body: "Algunos de nuestros proveedores están ubicados fuera de la UE. Estas transferencias están reguladas por cláusulas contractuales tipo aprobadas por la Comisión Europea." },
      { heading: "Contacto", body: "Para cualquier consulta sobre protección de datos: privacy@kipar.app. También puede presentar una reclamación ante su autoridad de protección de datos local." },
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
