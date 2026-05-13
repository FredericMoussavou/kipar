'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { CHARCOAL, TAUPE, BORDER, WHITE, RED } from '@/lib/theme'

type Section = { heading: string; body: string }
type PageContent = { title: string; sections: Section[] }

export default function CguPage() {
  const router = useRouter()
  const { lang } = useTranslation()

  const content: Record<string, PageContent> = {
    fr: {
      title: "Conditions Générales d'Utilisation",
      sections: [
      { heading: "Objet", body: "Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de la plateforme KIPAR, marketplace de transport de colis entre particuliers. En vous inscrivant, vous acceptez sans réserve les présentes conditions." },
      { heading: "Description du service", body: "KIPAR met en relation des expéditeurs souhaitant envoyer des colis avec des transporteurs effectuant des trajets en avion. KIPAR n'est pas transporteur et n'intervient pas dans la relation contractuelle entre expéditeur et transporteur." },
      { heading: "Inscription et compte", body: "L'accès aux services nécessite la création d'un compte. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les actions effectuées depuis votre compte." },
      { heading: "Obligations des utilisateurs", body: "Vous vous engagez à ne pas transporter de marchandises illicites, dangereuses ou prohibées. Tout manquement entraîne la suspension immédiate du compte et peut faire l'objet de poursuites judiciaires." },
      { heading: "Tarification et commissions", body: "KIPAR perçoit une commission sur chaque transaction finalisée. Les frais applicables sont affichés avant toute confirmation de réservation. Aucun frais caché n'est appliqué." },
      { heading: "Responsabilité", body: "KIPAR ne peut être tenu responsable des dommages causés par les utilisateurs entre eux. En cas de litige, KIPAR propose une médiation via son système de disputes intégré." },
      { heading: "Modification des CGU", body: "KIPAR se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par email. L'utilisation continue du service vaut acceptation des nouvelles conditions." },
      { heading: "Droit applicable", body: "Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence des tribunaux français." },
    ]
    },
    en: {
      title: 'Terms of Service',
      sections: [
      { heading: "Purpose", body: "These Terms of Service govern access to and use of the KIPAR platform, a peer-to-peer parcel transport marketplace. By registering, you unconditionally accept these terms." },
      { heading: "Service description", body: "KIPAR connects senders wishing to ship parcels with carriers travelling by plane. KIPAR is not a carrier and does not intervene in the contractual relationship between sender and carrier." },
      { heading: "Registration and account", body: "Access to services requires creating an account. You are responsible for the confidentiality of your credentials and all actions taken from your account." },
      { heading: "User obligations", body: "You agree not to transport illegal, dangerous or prohibited goods. Any breach results in immediate account suspension and may be subject to legal proceedings." },
      { heading: "Pricing and commissions", body: "KIPAR charges a commission on each completed transaction. Applicable fees are displayed before any booking confirmation. No hidden fees are applied." },
      { heading: "Liability", body: "KIPAR cannot be held liable for damages caused by users to each other. In case of dispute, KIPAR offers mediation through its integrated dispute system." },
      { heading: "Changes to Terms", body: "KIPAR reserves the right to modify these Terms at any time. Users will be notified by email. Continued use of the service constitutes acceptance of the new terms." },
      { heading: "Applicable law", body: "These Terms are governed by French law. Any dispute falls under the jurisdiction of French courts." },
    ]
    },
    es: {
      title: 'Términos de Servicio',
      sections: [
      { heading: "Objeto", body: "Los presentes Términos de Servicio rigen el acceso y uso de la plataforma KIPAR, un marketplace de transporte de paquetes entre particulares. Al registrarse, acepta sin reservas estos términos." },
      { heading: "Descripción del servicio", body: "KIPAR conecta a remitentes que desean enviar paquetes con transportistas que realizan viajes en avión. KIPAR no es transportista y no interviene en la relación contractual entre remitente y transportista." },
      { heading: "Registro y cuenta", body: "El acceso a los servicios requiere la creación de una cuenta. Usted es responsable de la confidencialidad de sus credenciales y de todas las acciones realizadas desde su cuenta." },
      { heading: "Obligaciones del usuario", body: "Usted se compromete a no transportar mercancías ilegales, peligrosas o prohibidas. Cualquier incumplimiento conlleva la suspensión inmediata de la cuenta y puede ser objeto de acciones legales." },
      { heading: "Precios y comisiones", body: "KIPAR cobra una comisión por cada transacción completada. Las tarifas aplicables se muestran antes de cualquier confirmación de reserva. No se aplican cargos ocultos." },
      { heading: "Responsabilidad", body: "KIPAR no puede ser responsable de los daños causados por los usuarios entre sí. En caso de disputa, KIPAR ofrece mediación a través de su sistema integrado de disputas." },
      { heading: "Modificación de los Términos", body: "KIPAR se reserva el derecho de modificar estos Términos en cualquier momento. Los usuarios serán notificados por correo electrónico. El uso continuado del servicio implica la aceptación de las nuevas condiciones." },
      { heading: "Ley aplicable", body: "Estos Términos se rigen por la ley francesa. Cualquier disputa es competencia de los tribunales franceses." },
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
