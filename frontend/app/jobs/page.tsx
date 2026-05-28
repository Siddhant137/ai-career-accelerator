'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { jobsApi, JobPosting, getErrorMessage } from '@/lib/api'
import toast from 'react-hot-toast'
import { Search, MapPin, Briefcase, DollarSign, ChevronDown, ChevronUp, Zap, X } from 'lucide-react'
import Link from 'next/link'

const JOB_TYPES       = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Remote']
const EXP_LEVELS      = ['Entry level', 'Mid level', 'Senior', 'Lead', 'Manager', 'Director']
const CARD = { background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }

interface Filters {
  search: string; location: string; job_type: string
  experience_level: string; salary_contains: string
}

const DEFAULT_FILTERS: Filters = { search: '', location: '', job_type: '', experience_level: '', salary_contains: '' }

export default function JobsPage() {
  const [jobs, setJobs]         = useState<JobPosting[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [filters, setFilters]   = useState<Filters>(DEFAULT_FILTERS)
  const [draft, setDraft]       = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [matching, setMatching] = useState<number | null>(null)

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const load = useCallback(async (p: number, f: Filters) => {
    setLoading(true)
    try {
      const { data } = await jobsApi.list(p, 12, {
        search:           f.search           || undefined,
        location:         f.location         || undefined,
        job_type:         f.job_type         || undefined,
        experience_level: f.experience_level || undefined,
        salary_contains:  f.salary_contains  || undefined,
      })
      setJobs(p === 1 ? data.results : prev => [...prev, ...data.results])
      setTotal(data.total)
      setPage(p)
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1, filters) }, [filters])

  const applyFilters = () => { setFilters(draft); setShowFilters(false) }
  const clearFilters = () => { setDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS) }

  const matchMe = async (jobId: number) => {
    setMatching(jobId)
    try {
      await jobsApi.matchMe(jobId)
      toast.success('Matched! Check your matches page.')
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setMatching(null)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Browse Jobs"
        subtitle={`${total} active positions`}
      />

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            placeholder="Search title, company, or description…"
            value={draft.search}
            onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            style={{ width: '100%', background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '10px 12px 10px 38px', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: showFilters ? 'rgba(167,139,250,0.15)' : 'rgba(15,15,30,0.8)', border: `1px solid ${showFilters ? 'rgba(167,139,250,0.4)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 10, padding: '10px 16px', color: showFilters ? '#a78bfa' : '#94a3b8', fontSize: 14, cursor: 'pointer' }}
        >
          {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          Filters {activeFilterCount > 0 && <span style={{ background: '#7c3aed', borderRadius: 10, padding: '1px 7px', fontSize: 11, color: 'white' }}>{activeFilterCount}</span>}
        </button>
        <button onClick={applyFilters} style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Search
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13, cursor: 'pointer' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ ...CARD, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {[
            { label: 'Location', key: 'location', icon: MapPin, placeholder: 'e.g. Remote, New York' },
            { label: 'Salary', key: 'salary_contains', icon: DollarSign, placeholder: 'e.g. 80k, 100k+' },
          ].map(({ label, key, icon: Icon, placeholder }) => (
            <div key={key}>
              <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <Icon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  placeholder={placeholder}
                  value={(draft as any)[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,10,20,0.6)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 10px 8px 28px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          ))}
          <div>
            <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Job Type</label>
            <select value={draft.job_type} onChange={e => setDraft(d => ({ ...d, job_type: e.target.value }))}
              style={{ width: '100%', background: 'rgba(10,10,20,0.6)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 13 }}>
              <option value="">Any type</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Experience</label>
            <select value={draft.experience_level} onChange={e => setDraft(d => ({ ...d, experience_level: e.target.value }))}
              style={{ width: '100%', background: 'rgba(10,10,20,0.6)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 13 }}>
              <option value="">Any level</option>
              {EXP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Job cards */}
      {loading && jobs.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ ...CARD, height: 200, animation: 'pulse 2s infinite' }} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 64 }}>
          <Briefcase size={48} color="#1e293b" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#475569', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>No jobs found</p>
          <p style={{ color: '#334155', fontSize: 14, marginTop: 8 }}>Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
            {jobs.map(job => (
              <article key={job.id} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.2s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)')}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', fontSize: 16, margin: 0 }}>{job.title}</h3>
                    <p style={{ color: '#a78bfa', fontSize: 13, marginTop: 3 }}>{job.company}</p>
                  </div>
                  <span className={`status-badge status-${job.status}`}>{job.status}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {job.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
                      <MapPin size={11} /> {job.location}
                    </span>
                  )}
                  {job.job_type && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
                      <Briefcase size={11} /> {job.job_type}
                    </span>
                  )}
                  {job.salary_range && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80', fontSize: 12 }}>
                      <DollarSign size={11} /> {job.salary_range}
                    </span>
                  )}
                </div>

                {(job.required_skills?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(job.required_skills ?? []).slice(0, 4).map(s => (
                      <span key={s} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', borderRadius: 50, padding: '2px 10px', fontSize: 11 }}>{s}</span>
                    ))}
                    {(job.required_skills?.length ?? 0) > 4 && (
                      <span style={{ color: '#475569', fontSize: 11, padding: '2px 4px' }}>+{(job.required_skills?.length ?? 0) - 4} more</span>
                    )}
                  </div>
                )}

                <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, flex: 1 }}>
                  {(job.description ?? '').slice(0, 120) || 'No description provided.'}
                  {(job.description ?? '').length > 0 ? '…' : ''}
                </p>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <Link href={`/jobs/${job.id}`}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                    View details
                  </Link>
                  <button onClick={() => matchMe(job.id)} disabled={matching === job.id}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: matching === job.id ? 0.7 : 1 }}>
                    <Zap size={13} /> {matching === job.id ? 'Matching…' : 'Match me'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {jobs.length < total && (
            <button onClick={() => load(page + 1, filters)} disabled={loading}
              style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
              {loading ? 'Loading…' : `Load more (${total - jobs.length} remaining)`}
            </button>
          )}
        </>
      )}
    </DashboardLayout>
  )
}