'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft } from 'lucide-react'
import { authApi, getErrorMessage } from '@/lib/api'
import AuthShell from '@/components/ui/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={sent ? 'Check your inbox' : 'Forgot password?'}
      subtitle={
        sent
          ? 'If that email is registered, you will receive a reset link within a few minutes.'
          : 'Enter your email and we will send you a secure reset link.'
      }
    >
      {!sent ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Email</label>
            <input
              className="input-field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-slate-400 hover:text-purple-300 text-sm"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </form>
      ) : (
        <div className="text-center py-2">
          <div className="empty-state-icon mx-auto mb-4">
            <Mail size={28} className="text-purple-400" />
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Sent to <span className="text-purple-300">{email}</span> if an account exists.
          </p>
          <Link href="/login" className="btn-primary block text-center">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
