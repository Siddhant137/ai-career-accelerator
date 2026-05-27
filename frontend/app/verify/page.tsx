'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, CheckCircle, XCircle, Loader } from 'lucide-react'
import { authApi, getErrorMessage } from '@/lib/api'

type State = 'loading' | 'success' | 'error'

export default function VerifyPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const [state, setState]   = useState<State>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setState('error')
      setMessage('No verification token found in the link. Please check your email.')
      return
    }

    authApi.verifyEmail(token)
      .then(() => {
        setState('success')
        setMessage('Your email has been verified successfully!')
        setTimeout(() => router.push('/login'), 3000)
      })
      .catch((err) => {
        setState('error')
        setMessage(getErrorMessage(err))
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        {/* Logo */}
        <div className="inline-flex items-center gap-2 mb-8">
          <div style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', borderRadius: 8, padding: 8 }}>
            <Zap size={20} color="white" />
          </div>
          <span className="font-bold text-xl" style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CareerAI
          </span>
        </div>

        <div className="card flex flex-col items-center gap-6 py-10">
          {state === 'loading' && (
            <>
              <Loader size={48} className="animate-spin" style={{ color: '#a78bfa' }} />
              <div>
                <h1 className="font-bold text-2xl text-white mb-2">Verifying your email…</h1>
                <p className="text-slate-400 text-sm">Please wait a moment.</p>
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle size={48} style={{ color: '#4ade80' }} />
              <div>
                <h1 className="font-bold text-2xl text-white mb-2">Email Verified!</h1>
                <p className="text-slate-400 text-sm mb-1">{message}</p>
                <p className="text-slate-500 text-xs">Redirecting you to login in 3 seconds…</p>
              </div>
              <Link href="/login" className="btn-primary w-full text-center">Go to Login</Link>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle size={48} style={{ color: '#f87171' }} />
              <div>
                <h1 className="font-bold text-2xl text-white mb-2">Verification Failed</h1>
                <p className="text-slate-400 text-sm">{message}</p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Link href="/login" className="btn-primary w-full text-center">Go to Login</Link>
                <Link href="/register" className="text-purple-400 hover:text-purple-300 text-sm">
                  Create a new account
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}