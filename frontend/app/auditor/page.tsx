'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader, Plus, Trash2, ShieldAlert, Play, ChevronRight } from 'lucide-react'

import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { api, getErrorMessage } from '@/lib/api'

type EvaluationBreakdown = {
  experience_and_education_score: number
  skills_match_score: number
  project_verification_score: number
  red_flags: string[]
}

type EvaluateCandidateResponse = {
  composite_score: number
  evaluation: EvaluationBreakdown
  interrogation_questions: [string, string, string]
  hiring_verdict: string
}

function scoreColor(score: number) {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function ScoreRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = 46
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - v / 100)
  const color = scoreColor(v)

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-3xl font-extrabold" style={{ color }}>
          {v}
        </div>
        <div className="text-[11px] text-slate-500 -mt-0.5">Composite</div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value)
  return (
    <div className="stat-card">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="font-display text-2xl font-bold" style={{ color }}>
          {value}
        </p>
        <div
          className="h-2 w-24 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.max(0, Math.min(100, value))}%`,
              background: `linear-gradient(135deg, ${color}, rgba(56,189,248,0.85))`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function LiveVerificationInterview({ questions }: { questions: [string, string, string] }) {
  const [started, setStarted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [locked, setLocked] = useState(false)
  const [answers, setAnswers] = useState<string[]>(['', '', ''])

  const question = questions[idx]
  const done = idx >= questions.length

  useEffect(() => {
    if (!started) return
    if (done) return

    setSecondsLeft(60)
    setLocked(false)
    setAnswers(a => {
      const copy = [...a]
      copy[idx] = copy[idx] ?? ''
      return copy
    })
  }, [started, idx, done])

  useEffect(() => {
    if (!started) return
    if (done) return
    if (locked) return

    const timer = window.setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) return 0
        return s - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [started, done, locked])

  useEffect(() => {
    if (!started) return
    if (done) return
    if (secondsLeft > 0) return

    setLocked(true)
    const t = window.setTimeout(() => {
      setIdx(i => Math.min(i + 1, questions.length))
    }, 400)
    return () => window.clearTimeout(t)
  }, [secondsLeft, started, done, questions.length])

  const progressLabel = useMemo(() => {
    if (!started) return 'Not started'
    if (done) return 'Completed'
    return `Question ${idx + 1} of ${questions.length}`
  }, [started, done, idx, questions.length])

  return (
    <div className="card card-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Interrogation ambush</p>
          <h3 className="font-display text-xl font-bold text-white mt-1">Start Live Verification Interview</h3>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed">
            60 seconds per question. Copy/paste is disabled to force manual typing. When time ends, input locks and the next
            question begins automatically.
          </p>
        </div>
        {!started ? (
          <button type="button" className="btn-primary !w-auto" onClick={() => setStarted(true)}>
            <span className="inline-flex items-center gap-2">
              <Play size={16} />
              Start
            </span>
          </button>
        ) : (
          <div className="text-right">
            <p className="text-[11px] text-slate-500">{progressLabel}</p>
            {!done && (
              <p className="font-display text-2xl font-extrabold mt-1" style={{ color: secondsLeft <= 10 ? '#f87171' : '#a78bfa' }}>
                {secondsLeft}s
              </p>
            )}
          </div>
        )}
      </div>

      {started && !done && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-[rgba(10,10,20,0.55)]">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Question</p>
              <p className="text-slate-200 text-sm mt-2 leading-relaxed">{question}</p>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Auto-advance at 0</span>
              <span className={locked ? 'text-red-400' : 'text-slate-500'}>{locked ? 'Locked' : 'Live'}</span>
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="text-[11px] uppercase tracking-wider text-slate-500">Candidate answer</label>
            <textarea
              className="input-field mt-2 min-h-[180px]"
              placeholder="Type your answer…"
              value={answers[idx] ?? ''}
              disabled={locked}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) =>
                setAnswers((prev) => {
                  const next = [...prev]
                  next[idx] = e.target.value
                  return next
                })
              }
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIdx((i) => Math.min(i + 1, questions.length))}
                disabled={locked}
                title="Skip to next (disabled once locked)"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {started && done && (
        <div className="mt-6 p-4 rounded-xl border border-green-500/20 bg-[rgba(16,185,129,0.06)]">
          <p className="font-display font-bold text-white">Interview complete</p>
          <p className="text-slate-400 text-sm mt-1">
            Answers are stored locally on this page (not sent to the server yet).
          </p>
        </div>
      )}
    </div>
  )
}

export default function AuditorPage() {
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [repos, setRepos] = useState<string[]>([''])

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvaluateCandidateResponse | null>(null)

  const addRepo = () => setRepos((r) => [...r, ''])
  const removeRepo = (idx: number) => setRepos((r) => r.filter((_, i) => i !== idx))
  const updateRepo = (idx: number, value: string) =>
    setRepos((r) => r.map((v, i) => (i === idx ? value : v)))

  const submit = async () => {
    setLoading(true)
    setResult(null)
    try {
      const github_urls = repos.map((r) => r.trim()).filter(Boolean)
      const { data } = await api.post<EvaluateCandidateResponse>('/api/v1/evaluate-candidate', {
        resume_text: resumeText,
        job_description: jobDescription,
        github_urls,
      })
      setResult(data)
      toast.success('Evaluation complete.')
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="AI Auditor"
        subtitle="Enterprise-grade, zero-leniency candidate evaluation with GitHub verification."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUT VIEW */}
        <div className="card card-glow">
          <h2 className="font-display text-xl font-bold text-white">Input</h2>
          <p className="text-slate-400 text-sm mt-1">
            Paste resume text, job description, and one or more GitHub repositories to cross-verify claims.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500">Resume</label>
              <textarea
                className="input-field mt-2 min-h-[180px]"
                placeholder="Paste the resume text here…"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500">Job Description</label>
              <textarea
                className="input-field mt-2 min-h-[180px]"
                placeholder="Paste the job description here…"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-[11px] uppercase tracking-wider text-slate-500">GitHub repositories</label>
                <button type="button" className="btn-secondary" onClick={addRepo}>
                  <Plus size={16} /> Add Repository
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {repos.map((value, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="input-field"
                      placeholder="https://github.com/owner/repo"
                      value={value}
                      onChange={(e) => updateRepo(i, e.target.value)}
                    />
                    {repos.length > 1 && (
                      <button
                        type="button"
                        className="btn-secondary !px-3"
                        onClick={() => removeRepo(i)}
                        title="Remove repository"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={loading || !resumeText.trim() || !jobDescription.trim()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {loading ? <Loader size={18} className="animate-spin" /> : null}
                {loading ? 'Evaluating…' : 'Run Audit'}
              </span>
            </button>
          </div>
        </div>

        {/* METRICS DASHBOARD VIEW */}
        <div className="space-y-6">
          <div className="card card-glow">
            <h2 className="font-display text-xl font-bold text-white">Metrics Dashboard</h2>
            <p className="text-slate-400 text-sm mt-1">
              Composite score, sub-scores, and red flags from the auditor.
            </p>

            {!result ? (
              <div className="mt-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center border border-indigo-500/20 bg-[rgba(167,139,250,0.06)]">
                  <ShieldAlert size={22} className="text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm mt-4">Run an audit to see results.</p>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  <ScoreRing value={result.composite_score} />
                  <div className="flex-1 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <MetricCard label="Experience / Education" value={result.evaluation.experience_and_education_score} />
                      <MetricCard label="Skills Match" value={result.evaluation.skills_match_score} />
                      <MetricCard label="Project Verification" value={result.evaluation.project_verification_score} />
                    </div>

                    <div className="mt-4 p-4 rounded-xl border border-indigo-500/20 bg-[rgba(10,10,20,0.55)]">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Hiring verdict</p>
                      <p className="text-slate-200 text-sm mt-2 leading-relaxed">{result.hiring_verdict}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-xl border border-amber-500/25 bg-[rgba(251,191,36,0.08)]">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-300" />
                    <p className="font-display font-bold text-amber-100">Red Flags</p>
                  </div>
                  {result.evaluation.red_flags?.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-200">
                      {result.evaluation.red_flags.map((rf, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-amber-300 mt-0.5">•</span>
                          <span className="text-slate-200">{rf}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 text-sm mt-3">No red flags reported.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* INTERROGATION AMBUSH COMPONENT */}
          {result?.interrogation_questions ? (
            <LiveVerificationInterview questions={result.interrogation_questions} />
          ) : (
            <div className="card card-glow">
              <h3 className="font-display text-lg font-bold text-white">Start Live Verification Interview</h3>
              <p className="text-slate-400 text-sm mt-1">
                Run an audit first to generate the 3 high-specificity questions.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

