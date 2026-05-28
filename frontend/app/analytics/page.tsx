'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { analyticsApi, CandidateAnalytics } from '@/lib/api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Award, Target, BarChart2 } from 'lucide-react'

const CARD = { background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }
const TOOLTIP_STYLE = { background: '#0f0f1a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e2e8f0' }

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ background: `${color}20`, borderRadius: 10, padding: 8 }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#fff' }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData]     = useState<CandidateAnalytics | null>(null)
  const [days, setDays]     = useState(90)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.candidate(days)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [days])

  const improvIcon = !data ? null
    : data.improvement > 0 ? <TrendingUp size={16} color="#4ade80" />
    : data.improvement < 0 ? <TrendingDown size={16} color="#f87171" />
    : <Minus size={16} color="#94a3b8" />

  const improvColor = !data ? '#94a3b8'
    : data.improvement > 0 ? '#4ade80'
    : data.improvement < 0 ? '#f87171'
    : '#94a3b8'

  const skillColors = ['#a78bfa', '#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#818cf8', '#34d399', '#fb923c', '#e879f9', '#22d3ee']

  return (
    <DashboardLayout requiredRole="candidate">
      <PageHeader
        title="Your Analytics"
        subtitle="Track your score progress and skill gaps over time"
        action={
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{ background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '8px 12px', color: '#e2e8f0', fontSize: 13 }}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
        }
      />

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ ...CARD, height: 100, animation: 'pulse 2s infinite' }} />)}
        </div>
      ) : !data || data.total_analyses === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 64 }}>
          <BarChart2 size={48} color="#1e293b" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#475569', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>No data yet</p>
          <p style={{ color: '#334155', fontSize: 14, marginTop: 8 }}>Score some resumes to see your analytics.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            <StatCard label="Total Analyses" value={data.total_analyses} icon={BarChart2} color="#a78bfa" />
            <StatCard label="Average Score"  value={data.avg_score}      icon={Target}   color="#38bdf8" sub="out of 100" />
            <StatCard label="Best Score"     value={data.best_score}     icon={Award}    color="#4ade80" sub="personal best" />
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ background: `${improvColor}20`, borderRadius: 10, padding: 8 }}>{improvIcon}</div>
                <span style={{ color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Improvement</span>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: improvColor }}>
                {data.improvement > 0 ? '+' : ''}{data.improvement}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>pts vs. earlier scores</div>
            </div>
          </div>

          {/* Score trend chart */}
          {data.score_trend.length > 1 && (
            <div style={CARD}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', marginBottom: 24, fontSize: 16 }}>
                Score Over Time
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.score_trend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: any) => [`${v}/100`, 'Score']}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Line
                    type="monotone" dataKey="score" stroke="#a78bfa"
                    strokeWidth={2.5} dot={{ fill: '#a78bfa', r: 4 }}
                    activeDot={{ r: 6, fill: '#7c3aed' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Skill gaps chart */}
          {data.skill_gaps.length > 0 && (
            <div style={CARD}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', marginBottom: 24, fontSize: 16 }}>
                Most Frequent Skill Gaps
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.skill_gaps} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={75} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Times missing']} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {data.skill_gaps.map((_, i) => (
                      <Cell key={i} fill={skillColors[i % skillColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Match status breakdown */}
          {Object.keys(data.match_stats).length > 0 && (
            <div style={CARD}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', marginBottom: 16, fontSize: 16 }}>
                Match Status Breakdown
              </h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(data.match_stats).map(([status, count]) => {
                  const colors: Record<string, string> = { pending: '#fbbf24', reviewed: '#38bdf8', shortlisted: '#4ade80', rejected: '#f87171' }
                  const color = colors[status] ?? '#94a3b8'
                  return (
                    <div key={status} style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                      <div style={{ color, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28 }}>{count}</div>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{status}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  )
}