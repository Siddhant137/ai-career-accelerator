'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bell, CheckCheck, Zap, Star, Briefcase, XCircle, Trophy, BookOpen, RefreshCw } from 'lucide-react'
import { notificationsApi, Notification, getErrorMessage } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'

// ── Icon per notification type ─────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    match_created:   { icon: <Zap size={16} />,       color: '#a78bfa' },
    shortlisted:     { icon: <Star size={16} />,       color: '#4ade80' },
    rejected:        { icon: <XCircle size={16} />,    color: '#f87171' },
    job_posted:      { icon: <Briefcase size={16} />,  color: '#38bdf8' },
    score_complete:  { icon: <Trophy size={16} />,     color: '#fbbf24' },
    skill_completed: { icon: <BookOpen size={16} />,   color: '#34d399' },
  }
  const entry = map[type] ?? { icon: <Bell size={16} />, color: '#94a3b8' }
  return (
    <div style={{ background: `${entry.color}20`, color: entry.color, borderRadius: '50%', padding: 8, flexShrink: 0 }}>
      {entry.icon}
    </div>
  )
}

// ── Time formatter ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [total, setTotal]                 = useState(0)
  const [page, setPage]                   = useState(1)
  const [loading, setLoading]             = useState(true)
  const [unreadOnly, setUnreadOnly]       = useState(false)
  const [marking, setMarking]             = useState(false)

  const load = useCallback(async (p = 1, unread = unreadOnly) => {
    setLoading(true)
    try {
      const { data } = await notificationsApi.list(p, 20, unread)
      setNotifications(p === 1 ? data.results : prev => [...prev, ...data.results])
      setUnreadCount(data.unread_count)
      setTotal(data.total)
      setPage(p)
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => { load(1) }, [unreadOnly])

  const markOne = async (id: number) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch { /* silent */ }
  }

  const markAll = async () => {
    setMarking(true)
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read.')
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setMarking(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-2xl text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span style={{ background: '#7c3aed', borderRadius: 12, padding: '2px 10px', fontSize: 12, color: 'white', fontWeight: 600 }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(1)}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(99,102,241,0.1)' }}
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                disabled={marking}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#a78bfa' }}
              >
                <CheckCheck size={16} />
                {marking ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { label: 'All',    value: false },
            { label: 'Unread', value: true  },
          ].map(tab => (
            <button
              key={tab.label}
              onClick={() => setUnreadOnly(tab.value)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background:  unreadOnly === tab.value ? 'rgba(167,139,250,0.15)' : 'transparent',
                color:       unreadOnly === tab.value ? '#a78bfa' : '#64748b',
                border:      `1px solid ${unreadOnly === tab.value ? 'rgba(167,139,250,0.4)' : 'transparent'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {loading && notifications.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card animate-pulse" style={{ height: 72 }} />
            ))
          ) : notifications.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-16 text-center">
              <Bell size={40} style={{ color: '#334155' }} />
              <p className="text-slate-400">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markOne(notif.id)}
                className="card flex items-start gap-3 cursor-pointer transition-all hover:border-purple-500/30"
                style={{
                  borderColor: notif.is_read ? 'rgba(99,102,241,0.15)' : 'rgba(167,139,250,0.3)',
                  background:  notif.is_read ? 'rgba(15,15,26,0.6)' : 'rgba(167,139,250,0.05)',
                  padding: '14px 16px',
                }}
              >
                <NotifIcon type={notif.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white leading-snug">{notif.title}</p>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{timeAgo(notif.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                </div>
                {!notif.is_read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            ))
          )}
        </div>

        {/* Load more */}
        {notifications.length < total && (
          <button
            onClick={() => load(page + 1)}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'transparent' }}
          >
            {loading ? 'Loading…' : `Load more (${total - notifications.length} remaining)`}
          </button>
        )}

      </div>
    </DashboardLayout>
  )
}