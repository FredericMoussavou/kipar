import { useEffect, useRef, useState } from 'react'

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
  const [unreadCount, setUnreadCount] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  // Charge les notifs existantes au montage
  useEffect(() => {
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
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
        setUnreadCount(prev => prev + 1)
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
    setUnreadCount(0)
  }

  const markOneRead = async (id: string) => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const deleteOne = async (id: string) => {
    if (!token) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id)
      if (notif && !notif.is_read) setUnreadCount(c => Math.max(0, c - 1))
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
