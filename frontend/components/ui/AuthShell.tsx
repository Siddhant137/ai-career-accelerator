'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="auth-orb auth-orb-1" aria-hidden />
      <div className="auth-orb auth-orb-2" aria-hidden />
      <div className="auth-orb auth-orb-3" aria-hidden />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="logo-badge">
              <Zap size={20} color="white" />
            </div>
            <span className="font-display font-bold text-xl gradient-text">CareerAI</span>
          </Link>
          <h1 className="font-display font-bold text-3xl text-white mb-2">{title}</h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">{subtitle}</p>
        </div>
        <div className="card card-glow">{children}</div>
        <p className="text-center mt-6">
          <Link href="/" className="text-slate-500 text-sm hover:text-purple-400 transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
