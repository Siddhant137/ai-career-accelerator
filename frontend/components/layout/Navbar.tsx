'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout, getRole } from '@/lib/auth'
import {
  Zap, LogOut, User, Briefcase, FileText, Star, Home, PlusCircle, Upload, Menu, X, Bell, BarChart3, FilePen, Shield,
} from 'lucide-react'
import NotificationBell from '@/components/ui/NotificationBell'

export default function Navbar() {
  const pathname = usePathname()
  const role = getRole()
  const [mobileOpen, setMobileOpen] = useState(false)

  const candidateLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/score', label: 'Score', icon: FileText },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/resumes', label: 'My Resumes', icon: Upload },
    { href: '/resume-builder', label: 'Resume Builder', icon: FilePen },
    { href: '/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/matches', label: 'Matches', icon: Star },
    { href: '/notifications', label: 'Alerts', icon: Bell },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  const recruiterLinks = [
    { href: '/recruiter/dashboard', label: 'Dashboard', icon: Home },
    { href: '/recruiter/jobs', label: 'My Jobs', icon: Briefcase },
    { href: '/recruiter/jobs/new', label: 'Post Job', icon: PlusCircle },
    { href: '/notifications', label: 'Alerts', icon: Bell },
  ]

  const adminLinks = [{ href: '/admin', label: 'Admin Panel', icon: Shield }]
  const baseLinks = role === 'recruiter' ? recruiterLinks : candidateLinks
  const links = role === 'admin' ? [...baseLinks, ...adminLinks] : baseLinks
  const homeHref = role === 'recruiter' ? '/recruiter/dashboard' : '/dashboard'

  const isActive = (href: string) =>
    pathname === href || (href !== homeHref && pathname.startsWith(href + '/'))

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
        isActive(href) ? 'nav-link-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={15} />
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 border-b border-indigo-500/20 bg-[rgba(10,10,15,0.92)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href={homeHref} className="flex items-center gap-2 shrink-0">
          <div className="logo-badge" style={{ padding: 6 }}>
            <Zap size={18} color="white" />
          </div>
          <span className="font-display font-bold text-lg gradient-text hidden sm:inline">CareerAI</span>
        </Link>

        <div className="hidden lg:flex items-center gap-0.5">
          {links.map(link => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <span
            className="hidden sm:inline text-xs px-2 py-1 rounded-full capitalize"
            style={{
              background: role === 'recruiter' ? 'rgba(56,189,248,0.15)' : 'rgba(167,139,250,0.15)',
              color: role === 'recruiter' ? '#38bdf8' : '#a78bfa',
              border: `1px solid ${role === 'recruiter' ? 'rgba(56,189,248,0.3)' : 'rgba(167,139,250,0.3)'}`,
            }}
          >
            {role}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 transition-all"
          >
            <LogOut size={15} />
            Logout
          </button>
          <button
            type="button"
            className="lg:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-indigo-500/20 px-4 py-3 flex flex-col gap-1 bg-[rgba(10,10,15,0.98)]">
          {links.map(link => (
            <NavLink key={link.href} {...link} />
          ))}
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 mt-2"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </nav>
  )
}
