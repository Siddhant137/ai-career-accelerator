'use client'

import { useEffect, useState } from 'react'
import { authApi, getErrorMessage } from '@/lib/api'
import { Mail, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VerificationBanner() {
  const [unverified, setUnverified] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    authApi.me()
      .then(r => setUnverified(!r.data.is_verified))
      .catch(() => setUnverified(false))
  }, [])

  const resend = async () => {
    setSending(true)
    try {
      const { data } = await authApi.resendVerification()
      toast.success(data.message || 'Verification email sent!')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (!unverified) return null

  return (
    <div className="verification-banner mb-6 flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl">
      <div className="flex items-start gap-3 flex-1">
        <Mail size={22} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-100 text-sm font-semibold">Verify your email to unlock the platform</p>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Scoring resumes, applying to jobs, and uploading role-specific resumes require a verified address.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="btn-secondary shrink-0 w-full sm:w-auto"
      >
        {sending ? <Loader size={16} className="animate-spin" /> : null}
        {sending ? 'Sending…' : 'Resend email'}
      </button>
    </div>
  )
}
