'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getErrorMessage } from '@/lib/api'
import { saveTokens, getRole } from '@/lib/auth'
import AuthShell from '@/components/ui/AuthShell'
import { Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('verified') === '1') {
      toast.success('Email verified! Sign in to continue.')
    }
  }, [params])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      saveTokens(data.access_token, data.refresh_token)
      toast.success('Welcome back!')
      router.push(getRole() === 'recruiter' ? '/recruiter/dashboard' : '/dashboard')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to score resumes, match jobs, and track your career progress.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-wider">Password</label>
            <Link href="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              className="input-field pr-10"
              type={show ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="text-center text-slate-400 text-sm mt-5">
        No account?{' '}
        <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium">
          Create one
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}
