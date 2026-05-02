'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { CHARCOAL, TAUPE, WHITE, BORDER, RED, SAND } from '@/lib/theme'

type ModalVariant = 'default' | 'danger'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  variant?: ModalVariant
  /**
   * Désactive la fermeture (par backdrop, Esc, ou bouton X).
   * Utile quand une action est en cours et qu'on ne veut pas que l'user
   * puisse fermer le modal avant la fin de la requête.
   */
  closeDisabled?: boolean
}

/**
 * Modal réutilisable, basé sur les conventions KIPAR.
 *
 * @example
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="Modifier">
 *     <p>Contenu</p>
 *   </Modal>
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  variant = 'default',
  closeDisabled = false,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Lock body scroll + Esc handler
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)

    // Focus le premier input/button du contenu (UX form)
    const focusable = contentRef.current?.querySelector<HTMLElement>(
      'input, textarea, button:not([data-modal-close])'
    )
    focusable?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, closeDisabled])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !closeDisabled) {
      onClose()
    }
  }

  const isDanger = variant === 'danger'

  return (
    <div
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
        animation: 'kipar-fade-in 0.2s ease',
      }}
      className="md:items-center"
    >
      <div
        ref={contentRef}
        style={{
          background: WHITE,
          borderRadius: 20,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          animation: 'kipar-slide-up 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 20px 12px',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            {isDanger && (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(220, 0, 41, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} color={RED} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="modal-title"
                style={{
                  fontFamily: 'var(--font-syne, Syne)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: isDanger ? RED : CHARCOAL,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h2>
              {description && (
                <p
                  style={{
                    fontSize: 13,
                    color: TAUPE,
                    margin: '4px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {!closeDisabled && (
            <button
              type="button"
              onClick={onClose}
              data-modal-close
              aria-label="Fermer"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: SAND,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: TAUPE,
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = BORDER
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = SAND
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '8px 20px 20px' }}>{children}</div>
      </div>

      {/* Animations CSS via styled-jsx (scope auto) */}
      <style jsx global>{`
        @keyframes kipar-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kipar-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}