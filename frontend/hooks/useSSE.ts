import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'

export interface NotifItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export function useSSE(token: string | null) {
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const { unreadCount, setUnreadCount: updateUnread } = useAuthStore()
  const esRef = useRef<EventSource | null>(null)

  // Charge les notifs existantes au montage
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (!token) return
    fetchedRef.current = false
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications || [])
        updateUnread(data.unread_count || 0)
        fetchedRef.current = true
      })
      .catch(() => {})
  }, [token])

  // SSE — nouvelles notifs en temps réel
  useEffect(() => {
    if (!token) return
    const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream?token=${token}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      if (e.data === 'ping') return
      try {
        const notif: NotifItem = JSON.parse(e.data)
        setNotifications(prev => [{ ...notif, is_read: false }, ...prev])
        updateUnread(prev => prev + 1)
      } catch {}
    }

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
    }
  }, [token])

  const markAllRead = async () => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    updateUnread(0)
  }

  const markOneRead = async (id: string) => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id)
      if (notif && !notif.is_read) updateUnread(c => Math.max(0, c - 1))
      return prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    })
  }

  const deleteOne = async (id: string) => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id)
      if (notif && !notif.is_read) updateUnread(c => Math.max(0, c - 1))
      return prev.filter(n => n.id !== id)
    })
  }

  const deleteRead = async () => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.filter(n => !n.is_read))
  }

  return { notifications, unreadCount, markAllRead, markOneRead, deleteOne, deleteRead }
}
