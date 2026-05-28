'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { adminApi, analyticsApi, AdminUser, AdminJob, AdminStats, getErrorMessage } from '@/lib/api'
import toast from 'react-hot-toast'
import { Users, Briefcase, BarChart2, Shield, Search, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const CARD = { background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }
const TAB_STYLE = (active: boolean) => ({
  padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
  color: active ? '#a78bfa' : '#64748b',
  border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'transparent'}`,
  transition: 'all 0.2s',
})

export default function AdminPage() {
  const [tab, setTab]         = useState<'overview' | 'users' | 'jobs'>('overview')
  const [stats, setStats]     = useState<AdminStats | null>(null)
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [jobs, setJobs]       = useState<AdminJob[]>([])
  const [search, setSearch]   = useState('')
  const [roleFilter, setRole] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    analyticsApi.admin().then(r => setStats(r.data)).catch(() => {})
  }, [])

  const loadUsers = useCallback(() => {
    setLoading(true)
    adminApi.listUsers(1, 50, search, roleFilter)
      .then(r => setUsers(r.data.results))
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [search, roleFilter])

  const loadJobs = useCallback(() => {
    setLoading(true)
    adminApi.listJobs(1, 50)
      .then(r => setJobs(r.data.results))
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'jobs')  loadJobs()
  }, [tab, loadUsers, loadJobs])

  const toggleUser = async (id: number, current: boolean) => {
    try {
      await adminApi.toggleUser(id, !current)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u))
      toast.success(`User ${!current ? 'activated' : 'deactivated'}.`)
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  const deleteJob = async (id: number) => {
    if (!confirm('Delete this job? This cannot be undone.')) return
    try {
      await adminApi.deleteJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
      toast.success('Job deleted.')
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  return (
    <DashboardLayout>
      <PageHeader title="Admin Panel" subtitle="Manage users, jobs, and platform health" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['overview', 'users', 'jobs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            {[
              { label: 'Total Users',     value: stats.users.total,      icon: Users,    color: '#a78bfa' },
              { label: 'Candidates',      value: stats.users.candidates,  icon: Users,    color: '#38bdf8' },
              { label: 'Recruiters',      value: stats.users.recruiters,  icon: Shield,   color: '#4ade80' },
              { label: 'New (30d)',        value: stats.users.new_last_30d,icon: Users,   color: '#fbbf24' },
              { label: 'Total Jobs',      value: stats.jobs.total,        icon: Briefcase,color: '#f87171' },
              { label: 'Active Jobs',     value: stats.jobs.active,       icon: Briefcase,color: '#4ade80' },
              { label: 'Total Matches',   value: stats.matches.total,     icon: BarChart2,color: '#a78bfa' },
              { label: 'Avg Match Score', value: `${stats.matches.avg_score}/100`, icon: BarChart2, color: '#38bdf8' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: `${color}20`, borderRadius: 8, padding: 6 }}>
                    <Icon size={16} color={color} />
                  </div>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: '#fff' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ ...CARD, textAlign: 'center', color: '#475569' }}>
            <p style={{ fontSize: 13 }}>Total resume analyses on platform: <span style={{ color: '#a78bfa', fontWeight: 700 }}>{stats.analyses}</span></p>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers()}
                style={{ width: '100%', paddingLeft: 36, background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '9px 12px 9px 36px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
              />
            </div>
            <select value={roleFilter} onChange={e => setRole(e.target.value)}
              style={{ background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '9px 12px', color: '#e2e8f0', fontSize: 13 }}>
              <option value="">All roles</option>
              <option value="candidate">Candidate</option>
              <option value="recruiter">Recruiter</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={loadUsers} style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Search
            </button>
          </div>

          <div style={CARD}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>Loading…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                    {['ID', 'Name', 'Email', 'Role', 'Verified', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                      <td style={{ padding: '12px', color: '#475569', fontSize: 13 }}>{u.id}</td>
                      <td style={{ padding: '12px', color: '#e2e8f0', fontSize: 13 }}>{u.full_name}</td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: 12 }}>{u.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: u.role === 'admin' ? 'rgba(248,113,113,0.15)' : u.role === 'recruiter' ? 'rgba(56,189,248,0.15)' : 'rgba(167,139,250,0.15)',
                          color: u.role === 'admin' ? '#f87171' : u.role === 'recruiter' ? '#38bdf8' : '#a78bfa',
                          borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                        }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '12px', color: u.is_verified ? '#4ade80' : '#f87171', fontSize: 12 }}>
                        {u.is_verified ? '✓ Yes' : '✗ No'}
                      </td>
                      <td style={{ padding: '12px', color: u.is_active ? '#4ade80' : '#f87171', fontSize: 12 }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => toggleUser(u.id, u.is_active)} title={u.is_active ? 'Deactivate' : 'Activate'}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: u.is_active ? '#f87171' : '#4ade80' }}>
                          {u.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Jobs ── */}
      {tab === 'jobs' && (
        <div style={CARD}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                  {['ID', 'Title', 'Company', 'Status', 'Posted', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                    <td style={{ padding: '12px', color: '#475569', fontSize: 13 }}>{j.id}</td>
                    <td style={{ padding: '12px', color: '#e2e8f0', fontSize: 13 }}>{j.title}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: 13 }}>{j.company}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge status-${j.status}`}>{j.status}</span>
                    </td>
                    <td style={{ padding: '12px', color: '#475569', fontSize: 12 }}>
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => deleteJob(j.id)} title="Delete job"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}