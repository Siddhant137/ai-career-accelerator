'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { notificationsApi } from '@/lib/api'

export default function NotificationBell() {
  const router = useRouter()
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount()
      setCount(data.unread_count)
    } catch { /* not logged in yet */ }
  }, [])

  useEffect(() => {
    fetchCount()
    // Poll every 60 seconds
    const id = setInterval(fetchCount, 60_000)
    return () => clearInterval(id)
  }, [fetchCount])

  return (
    <button
      onClick={() => router.push('/notifications')}
      className="relative p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
      style={{ background: 'rgba(99,102,241,0.08)' }}
      title="Notifications"
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: '#7c3aed',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}