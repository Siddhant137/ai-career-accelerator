'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getErrorMessage } from '@/lib/api'
import AuthShell from '@/components/ui/AuthShell'
import { User, Briefcase, Mail } from 'lucide-react'

function RegisterForm() {
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'candidate' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (params.get('role') === 'recruiter') setForm(f => ({ ...f, role: 'recruiter' }))
  }, [params])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      setDone(true)
      toast.success(data.message || 'Check your email to verify your account.')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="We sent a verification link to your email. Click it to activate your account, then sign in."
      >
        <div className="text-center py-4">
          <div className="empty-state-icon mx-auto mb-4">
            <Mail size={32} className="text-purple-400" />
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Sent to <span className="text-purple-300 font-medium">{form.email}</span>
          </p>
          <Link href="/login" className="btn-primary block text-center">
            Go to Sign In
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Join candidates and recruiters on the AI-powered talent platform.">
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['candidate', 'recruiter'] as const).map(role => (
          <button
            key={role}
            type="button"
            onClick={() => setForm(f => ({ ...f, role }))}
            className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
            style={{
              border: `1px solid ${form.role === role ? '#a78bfa' : 'rgba(99,102,241,0.2)'}`,
              background: form.role === role ? 'rgba(167,139,250,0.1)' : 'transparent',
            }}
          >
            {role === 'candidate' ? (
              <User size={22} color={form.role === role ? '#a78bfa' : '#475569'} />
            ) : (
              <Briefcase size={22} color={form.role === role ? '#a78bfa' : '#475569'} />
            )}
            <span
              className="text-sm font-medium capitalize"
              style={{ color: form.role === role ? '#a78bfa' : '#475569' }}
            >
              {role}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Full name</label>
          <input
            className="input-field"
            placeholder="Your full name"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email</label>
          <input
            className="input-field"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Password</label>
          <input
            className="input-field"
            type="password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <p className="text-center text-slate-400 text-sm mt-5">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  )
}
