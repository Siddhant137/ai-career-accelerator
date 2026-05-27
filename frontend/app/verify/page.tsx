'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { authApi, getErrorMessage } from '@/lib/api'
import AuthShell from '@/components/ui/AuthShell'

type State = 'loading' | 'success' | 'error'

function VerifyContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const error = params.get('error')
    if (error) {
      setState('error')
      setMessage(decodeURIComponent(error))
      return
    }

    const token = params.get('token')
    if (!token) {
      setState('error')
      setMessage('No verification token in this link. Open the link from your email.')
      return
    }

    authApi
      .verifyEmail(token)
      .then(() => {
        setState('success')
        setMessage('Your email is verified. You can sign in and use all features.')
        setTimeout(() => router.push('/login?verified=1'), 2500)
      })
      .catch(err => {
        setState('error')
        setMessage(getErrorMessage(err))
      })
  }, [params, router])

  return (
    <AuthShell
      title={
        state === 'loading' ? 'Verifying…' : state === 'success' ? 'Email verified' : 'Verification failed'
      }
      subtitle={
        state === 'loading'
          ? 'Please wait while we confirm your email address.'
          : message
      }
    >
      <div className="flex flex-col items-center gap-6 py-4">
        {state === 'loading' && <Loader size={48} className="animate-spin text-purple-400" />}
        {state === 'success' && <CheckCircle size={52} className="text-green-400" />}
        {state === 'error' && <XCircle size={52} className="text-red-400" />}

        {state === 'success' && (
          <p className="text-slate-500 text-xs">Redirecting to sign in…</p>
        )}

        {state !== 'loading' && (
          <div className="flex flex-col gap-3 w-full">
            <Link href="/login" className="btn-primary text-center">
              Go to sign in
            </Link>
            {state === 'error' && (
              <Link href="/register" className="text-purple-400 text-sm text-center hover:text-purple-300">
                Create a new account
              </Link>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <VerifyContent />
    </Suspense>
  )
}
