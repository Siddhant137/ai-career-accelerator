'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import VerificationBanner from '@/components/ui/VerificationBanner'
import PageHeader from '@/components/ui/PageHeader'
import { candidateApi, jobsApi, CandidateProfile, AnalysisSummary, Match } from '@/lib/api'
import { FileText, Briefcase, Star, TrendingUp, ArrowRight, Upload, Zap } from 'lucide-react'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-slate-400">Match score</span>
        <span className="font-display font-bold text-lg" style={{ color }}>{score}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 6 }}>
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            borderRadius: 100,
            background: `linear-gradient(90deg, ${color}, #38bdf8)`,
          }}
        />
      </div>
    </div>
  )
}

export default function CandidateDashboard() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [history, setHistory] = useState<AnalysisSummary[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [jobCount, setJobCount] = useState(0)

  useEffect(() => {
    candidateApi.getProfile().then(r => setProfile(r.data)).catch(() => {})
    candidateApi.getHistory(1, 3).then(r => setHistory(r.data.results)).catch(() => {})
    jobsApi.myMatches(1, 3).then(r => setMatches(r.data.results)).catch(() => {})
    jobsApi.list(1, 1).then(r => setJobCount(r.data.total)).catch(() => {})
  }, [])

  const avgScore = history.length
    ? Math.round(history.reduce((a, h) => a + h.score, 0) / history.length)
    : 0

  const quickActions = [
    { href: '/score', label: 'Score resume', desc: 'AI match vs job description', icon: Zap, color: '#a78bfa' },
    { href: '/resumes', label: 'Role resumes', desc: 'Upload backend, frontend, etc.', icon: Upload, color: '#38bdf8' },
    { href: '/jobs', label: 'Browse jobs', desc: 'Apply with one click', icon: Briefcase, color: '#4ade80' },
  ]

  return (
    <DashboardLayout requiredRole="candidate">
      <VerificationBanner />

      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'there'} 👋`}
        subtitle={profile?.headline || 'Complete your profile and upload role-specific resumes for better matches'}
        action={
          <Link href="/profile" className="btn-secondary text-sm">
            Edit profile
          </Link>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {quickActions.map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href} className="quick-action card-interactive">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}22` }}
            >
              <Icon size={20} color={color} />
            </div>
            <div>
              <p className="font-display font-semibold text-white text-sm">{label}</p>
              <p className="text-slate-500 text-xs">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-slate-600 ml-auto shrink-0" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Analyses', value: history.length, icon: FileText, color: '#a78bfa' },
          { label: 'Avg score', value: avgScore || '—', icon: TrendingUp, color: '#4ade80' },
          { label: 'Open jobs', value: jobCount, icon: Briefcase, color: '#38bdf8' },
          { label: 'Matches', value: matches.length, icon: Star, color: '#fbbf24' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}20` }}
              >
                <Icon size={16} color={color} />
              </div>
              <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="font-display font-bold text-2xl text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card card-glow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-semibold text-white">Recent scores</h2>
            <Link href="/score" className="text-purple-400 text-sm hover:text-purple-300 flex items-center gap-1">
              Score <ArrowRight size={14} />
            </Link>
          </div>
          {history.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">
              No analyses yet.{' '}
              <Link href="/score" className="text-purple-400">Score your first resume →</Link>
            </p>
          ) : (
            history.map(h => (
              <div key={h.id} className="mb-4 pb-4 border-b border-indigo-500/10 last:border-0 last:mb-0 last:pb-0">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-300 truncate">{h.original_filename || 'Resume'}</span>
                  <span className="text-xs text-slate-500">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
                <ScoreBar score={h.score} />
              </div>
            ))
          )}
        </div>

        <div className="card card-glow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-semibold text-white">Recent matches</h2>
            <Link href="/matches" className="text-purple-400 text-sm hover:text-purple-300 flex items-center gap-1">
              All <ArrowRight size={14} />
            </Link>
          </div>
          {matches.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">
              No matches yet.{' '}
              <Link href="/jobs" className="text-purple-400">Browse jobs →</Link>
            </p>
          ) : (
            matches.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between mb-3 pb-3 border-b border-indigo-500/10 last:border-0"
              >
                <div>
                  <p className="text-sm text-white font-medium">{m.job_title || `Job #${m.job_id}`}</p>
                  <p className="text-xs text-slate-400">{m.job_company}</p>
                </div>
                <div className="text-right">
                  <div
                    className="font-display font-bold text-xl"
                    style={{
                      color: m.score >= 75 ? '#4ade80' : m.score >= 50 ? '#fbbf24' : '#f87171',
                    }}
                  >
                    {m.score}
                  </div>
                  <span className={`status-badge status-${m.status}`}>{m.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
