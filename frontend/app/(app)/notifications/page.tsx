'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, X, CheckCheck } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useNotifications } from '@/contexts/notifications.context'
import { CHARCOAL, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'

export default function NotificationsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { notifications, unreadCount, markAllRead, markOneRead, deleteOne, deleteRead } = useNotifications()

  const hasRead = notifications.some(n => n.is_read)

  return (
    <div style={{ background: 'rgba(240,237,232,0.2)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: WHITE, borderBottom: '1px solid ' + BORDER, padding: '0 16px', height: 64, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30 }}>
        <button onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: SAND, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={16} color={CHARCOAL} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, fontFamily: 'var(--font-syne,Syne)', flex: 1 }}>
          {t.notifications.title}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              <CheckCheck size={14} />
              {t.notifications.mark_all_read}
            </button>
          )}
          {hasRead && (
            <button onClick={deleteRead}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: TAUPE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              <Trash2 size={14} />
              {t.notifications.delete_read}
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div style={{ padding: '12px 16px 80px' }} className="md:max-w-2xl md:mx-auto">
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 14, color: TAUPE }}>{t.notifications.empty}</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id}
            style={{
              background: WHITE, border: '1px solid ' + BORDER, borderRadius: 14,
              marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px',
              opacity: n.is_read ? 0.7 : 1,
            }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? 'transparent' : RED, marginTop: 5, flexShrink: 0 }} />
            <div
              onClick={() => { markOneRead(n.id); if (n.link) router.push(n.link) }}
              style={{ flex: 1, minWidth: 0, cursor: n.link ? 'pointer' : 'default' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL, margin: '0 0 2px' }}>{n.title}</p>
              <p style={{ fontSize: 12, color: TAUPE, margin: 0 }}>{n.body}</p>
              <p style={{ fontSize: 11, color: TAUPE, margin: '4px 0 0' }}>
                {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={() => deleteOne(n.id)}
              style={{ width: 28, height: 28, borderRadius: '50%', background: SAND, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={13} color={TAUPE} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
