'use client'

import { createContext, useContext } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useSSE, NotifItem } from '@/hooks/useSSE'

interface NotificationsContextType {
  notifications: NotifItem[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markOneRead: (id: string) => Promise<void>
  deleteOne: (id: string) => Promise<void>
  deleteRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: async () => {},
  markOneRead: async () => {},
  deleteOne: async () => {},
  deleteRead: async () => {},
})

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  const value = useSSE(token)

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
