'use client'
import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import { useIsMobile } from '@/hooks/useIsMobile'
import { RED, CHARCOAL, TAUPE, BORDER, WHITE, SAND } from '@/lib/theme'
import SenderPublishTab from './SenderPublishTab'
import CarrierPublishTab from './CarrierPublishTab'

type Tab = 'sender' | 'carrier'

/**
 * Formulaire public de publication (landing), a 2 onglets :
 *  - Annonce (sender) : par defaut / premier
 *  - Transporteur (carrier)
 *
 * Detecte si l'utilisateur est connecte (isAuthenticated) pour masquer
 * les blocs user/connexion dans les onglets (gere en interne par chaque onglet).
 */
export default function PublishForm() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('sender')

  const isVisitor = !isAuthenticated()

  const tabBtn = (active: boolean) => ({
    flex: 1,
    padding: '14px 16px',
    border: 'none',
    background: active ? CHARCOAL : 'transparent',
    color: active ? WHITE : TAUPE,
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as const)

  return (
    <div style={{
      background: WHITE,
      borderRadius: 16,
      border: `1px solid ${BORDER}`,
      boxShadow: '0 16px 50px rgba(26,26,26,0.16)',
      overflow: 'hidden',
      width: '100%',
    }}>
      {/* En-tete onglets */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        <button type="button" onClick={() => setTab('sender')} style={tabBtn(tab === 'sender')}>
          {t.publish?.tab_sender ?? 'Envoyer un colis'}
        </button>
        <button type="button" onClick={() => setTab('carrier')} style={tabBtn(tab === 'carrier')}>
          {t.publish?.tab_carrier ?? 'Proposer un trajet'}
        </button>
      </div>

      {/* Contenu */}
      <div style={{ padding: isMobile ? 20 : 28 }}>
        {tab === 'sender'
          ? <SenderPublishTab isVisitor={isVisitor} isMobile={isMobile} />
          : <CarrierPublishTab isVisitor={isVisitor} isMobile={isMobile} />}
      </div>
    </div>
  )
}