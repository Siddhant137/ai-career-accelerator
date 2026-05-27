'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Zap, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { authApi, getErrorMessage } from '@/lib/api'

function ResetPasswordForm() {
  const router  = useRouter()
  const params  = useSearchParams()
  const token   = params.get('token') ?? ''

  const [form, setForm]       = useState({ password: '', confirm: '' })
  const [show, setShow]       = useState({ password: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing reset token.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.')
      return
    }
    if (!token) {
      toast.error('Invalid reset link. Please request a new one.')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const strength = (() => {
    const p = form.password
    if (!p) return null
    const score = [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)].filter(Boolean).length
    if (score <= 1) return { label: 'Weak',   color: '#f87171', width: '25%' }
    if (score === 2) return { label: 'Fair',   color: '#fbbf24', width: '50%' }
    if (score === 3) return { label: 'Good',   color: '#38bdf8', width: '75%' }
    return             { label: 'Strong', color: '#4ade80', width: '100%' }
  })()

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', borderRadius: 8, padding: 8 }}>
              <Zap size={20} color="white" />
            </div>
            <span className="font-bold text-xl" style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CareerAI
            </span>
          </div>
          <h1 className="font-bold text-3xl text-white mb-2">Reset password</h1>
          <p className="text-slate-400 text-sm">Enter your new password below.</p>
        </div>

        <div className="card">
          {!done ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* New password */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <input
                    className="input-field pr-10"
                    type={show.password ? 'text' : 'password'}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, password: !s.password }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {show.password ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar */}
                {strength && (
                  <div className="mt-2">
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: strength.width, background: strength.color, height: '100%', transition: 'all 0.3s' }} />
                    </div>
                    <span style={{ color: strength.color }} className="text-xs mt-1 block">{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <input
                    className="input-field pr-10"
                    type={show.confirm ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    required
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.confirm && form.password !== form.confirm && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match.</p>
                )}
              </div>

              <button type="submit" disabled={loading || !token} className="btn-primary mt-2">
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>

              <Link href="/login" className="text-center text-slate-400 hover:text-slate-300 text-sm">
                Back to login
              </Link>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <CheckCircle size={48} style={{ color: '#4ade80' }} />
              <div>
                <h2 className="font-bold text-xl text-white mb-2">Password reset!</h2>
                <p className="text-slate-400 text-sm">Your password has been updated. Redirecting to login…</p>
              </div>
              <Link href="/login" className="btn-primary w-full text-center">Go to Login</Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}