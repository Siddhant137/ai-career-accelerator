'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Zap, Mail, ArrowLeft } from 'lucide-react'
import { authApi, getErrorMessage } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', borderRadius: 8, padding: 8 }}>
              <Zap size={20} color="white" />
            </div>
            <span className="font-bold text-xl" style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CareerAI
            </span>
          </div>
          <h1 className="font-bold text-3xl text-white mb-2">Forgot password?</h1>
          <p className="text-slate-400 text-sm">We'll send a reset link to your email.</p>
        </div>

        <div className="card">
          {!sent ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email Address</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <Link href="/login" className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 text-sm mt-1">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div style={{ background: 'rgba(167,139,250,0.1)', borderRadius: '50%', padding: 20 }}>
                <Mail size={32} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <h2 className="font-bold text-xl text-white mb-2">Check your inbox</h2>
                <p className="text-slate-400 text-sm">
                  If <span className="text-purple-400">{email}</span> is registered, you'll receive a reset link shortly.
                </p>
                <p className="text-slate-500 text-xs mt-2">Don't see it? Check your spam folder.</p>
              </div>
              <Link href="/login" className="btn-primary w-full text-center">Back to Login</Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}