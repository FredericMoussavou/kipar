import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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

  // 1. CHARGEMENT INITIAL
  useEffect(() => {
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications || [])
        updateUnread(data.unread_count || 0)
      })
      .catch(err => console.error("Initial fetch failed", err))
  }, [token, updateUnread])

  // 2. RÉCEPTION TEMPS RÉEL (SSE)
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
        updateUnread((prev) => prev + 1)
      } catch (err) {
        console.error("SSE parse error", err)
      }
    }

    return () => es.close()
  }, [token, updateUnread])

  // 3. ACTIONS
  const markOneRead = useCallback(async (id: string) => {
    if (!token) return
    
    const isAlreadyRead = notifications.find(n => n.id === id)?.is_read

    if (!isAlreadyRead) {
      updateUnread((prev) => Math.max(0, prev - 1))
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error("Failed to mark as read", err)
    }
  }, [token, notifications, updateUnread])

  const markAllRead = useCallback(async () => {
    if (!token) return
    
    updateUnread(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }, [token, updateUnread])

  const deleteOne = useCallback(async (id: string) => {
    if (!token) return

    const notif = notifications.find(n => n.id === id)
    if (notif && !notif.is_read) {
      updateUnread((prev) => Math.max(0, prev - 1))
    }
    setNotifications(prev => prev.filter(n => n.id !== id))

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error("Failed to delete notification", err)
    }
  }, [token, notifications, updateUnread])

  const deleteRead = useCallback(async () => {
    if (!token) return

    setNotifications(prev => prev.filter(n => !n.is_read))

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error("Failed to delete read notifications", err)
    }
  }, [token])

  return useMemo(() => ({ 
    notifications, 
    unreadCount, 
    markAllRead, 
    markOneRead, 
    deleteOne, 
    deleteRead 
  }), [notifications, unreadCount, markAllRead, markOneRead, deleteOne, deleteRead])
}