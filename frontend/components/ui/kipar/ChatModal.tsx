'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, MessageCircle, Lock } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/api'
import { CHARCOAL, CHARCOAL2, TAUPE, SAND, BORDER, WHITE, RED } from '@/lib/theme'

interface ChatMessage {
  id: string
  sender_id: string
  content: string
  translated_content?: string
  sender_lang?: string
  created_at: string
  local?: boolean
}

interface Conversation {
  id: string
  booking_id: string
  sender_id: string
  carrier_id: string
  receiver_id?: string
  sender_first_name?: string
  carrier_first_name?: string
  receiver_first_name?: string
  messages: Array<{
    id: string
    sender_id: string
    content: string
    created_at: string
  }>
}

interface ChatModalProps {
  bookingId: string
  bookingStatus: string
  onClose: () => void
}

const WRITABLE_STATUSES = ['accepted', 'paid', 'in_transit']
const READONLY_STATUSES = ['delivered', 'refused', 'cancelled']

export default function ChatModal({ bookingId, bookingStatus, onClose }: ChatModalProps) {
  const { t } = useTranslation()
  const { user, token } = useAuthStore()
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [wsError, setWsError] = useState(false)
  const [participants, setParticipants] = useState<Record<string, string>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isReadonly = READONLY_STATUSES.includes(bookingStatus)
  const isWritable = WRITABLE_STATUSES.includes(bookingStatus)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  // Charge ou crée la conversation
  useEffect(() => {
    if (!isWritable && !isReadonly) return
    const init = async () => {
      setLoading(true)
      try {
        // Tente de créer (idempotent — retourne l'existante si déjà créée)
        const res = await api.post(`/conversations/${bookingId}`)
        const data: Conversation = res.data
        setConv(data)
        const p: Record<string, string> = {}
        if (data.sender_id && data.sender_first_name) p[data.sender_id] = data.sender_first_name
        if (data.carrier_id && data.carrier_first_name) p[data.carrier_id] = data.carrier_first_name
        if (data.receiver_id && data.receiver_first_name) p[data.receiver_id] = data.receiver_first_name
        setParticipants(p)
        setMessages(data.messages.map(m => ({
          id: m.id,
          sender_id: m.sender_id,
          content: m.content,
          created_at: m.created_at,
        })))
        scrollToBottom()
      } catch {
        // Si le booking n'est plus dans un statut créable, tente un GET via booking
        setWsError(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [bookingId])

  // Connexion WebSocket
  useEffect(() => {
    if (!conv || !token || isReadonly) return
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/v1$/, '')
    const wsBase = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')
    const ws = new WebSocket(`${wsBase}/api/v1/conversations/${conv.id}/ws?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.error) return
        setMessages(prev => {
          // Évite les doublons par id réel
          if (prev.find(m => m.id === msg.id)) return prev
          // Remplace le message optimiste local si c'est notre propre message
          const localIdx = prev.findIndex(m => m.local && m.sender_id === msg.sender_id)
          if (localIdx !== -1) {
            const next = [...prev]
            next[localIdx] = msg
            return next
          }
          return [...prev, msg]
        })
        scrollToBottom()
      } catch {}
    }

    ws.onerror = () => setWsError(true)
    ws.onclose = () => {}

    return () => { ws.close() }
  }, [conv, token, isReadonly])

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(input.trim())
    // Affichage optimiste
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      sender_id: user?.id || '',
      content: input.trim(),
      created_at: new Date().toISOString(),
      local: true,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    scrollToBottom()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: WHITE, width: '100%', maxWidth: 640,
        borderRadius: '20px 20px 0 0', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '80vh', minHeight: 400,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: '1px solid ' + BORDER,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} color={RED} />
            <span style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, fontFamily: 'var(--font-syne,Syne)' }}>
              {t.chat.title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isReadonly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: SAND, borderRadius: 99, padding: '4px 10px' }}>
                <Lock size={11} color={TAUPE} />
                <span style={{ fontSize: 11, color: TAUPE, fontWeight: 500 }}>{t.chat.readonly_notice}</span>
              </div>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: SAND, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color={CHARCOAL} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <p style={{ textAlign: 'center', fontSize: 13, color: TAUPE, margin: 'auto' }}>{t.chat.loading}</p>
          )}
          {!loading && messages.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: TAUPE, margin: 'auto' }}>—</p>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id
            const prevMsg = idx > 0 ? messages[idx - 1] : null
            const showName = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
            const senderName = participants[msg.sender_id] || null
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {showName && senderName && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: TAUPE, marginBottom: 2, paddingLeft: 4 }}>{senderName}</span>
                )}
                <div style={{
                  maxWidth: '75%', padding: '9px 13px',
                  background: isMe ? CHARCOAL : SAND,
                  color: isMe ? WHITE : CHARCOAL,
                  borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  fontSize: 13, lineHeight: 1.45,
                }}>
                  {msg.content}
                  {msg.translated_content && (
                    <p style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.6)' : TAUPE, marginTop: 4, fontStyle: 'italic' }}>
                      {msg.translated_content}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 10, color: TAUPE, marginTop: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                  {isMe ? t.chat.you : ''} {formatTime(msg.created_at)}
                </span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!isReadonly && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid ' + BORDER,
            display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t.chat.placeholder}
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid ' + BORDER,
                borderRadius: 12, padding: '10px 12px', fontSize: 13,
                color: CHARCOAL, background: SAND, outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 100,
                overflowY: 'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: input.trim() ? RED : SAND,
                border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <Send size={16} color={input.trim() ? WHITE : TAUPE} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
