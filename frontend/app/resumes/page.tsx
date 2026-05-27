'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import VerificationBanner from '@/components/ui/VerificationBanner'
import { candidateApi, CandidateResume, getErrorMessage } from '@/lib/api'
import toast from 'react-hot-toast'
import { Upload, Trash2, FileText } from 'lucide-react'

export default function ResumesPage() {
  const [resumes, setResumes] = useState<CandidateResume[]>([])
  const [roleTypes, setRoleTypes] = useState<string[]>([])
  const [roleType, setRoleType] = useState('general')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [resumesRes, typesRes] = await Promise.all([
        candidateApi.listResumes(),
        candidateApi.roleTypes(),
      ])
      setResumes(resumesRes.data)
      setRoleTypes(typesRes.data.role_types)
      if (typesRes.data.role_types.length && !typesRes.data.role_types.includes(roleType)) {
        setRoleType(typesRes.data.role_types[0])
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [roleType])

  useEffect(() => { load() }, [load])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Choose a PDF resume')
      return
    }
    setUploading(true)
    try {
      await candidateApi.uploadResume(file, roleType)
      toast.success(`Resume saved for ${roleType}`)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await candidateApi.deleteResume(id)
      toast.success('Resume removed')
      setResumes(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <DashboardLayout requiredRole="candidate">
      <VerificationBanner />
      <PageHeader
        title="Role-specific resumes"
        subtitle="One PDF per role (backend, frontend, data…). Matching picks your best score per job."
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-2 block uppercase tracking-wider">Role type</label>
              <select
                className="input-field"
                value={roleType}
                onChange={e => setRoleType(e.target.value)}
              >
                {roleTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block uppercase tracking-wider">PDF resume</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="input-field"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? 'Uploading…' : 'Save resume'}
            </button>
          </form>
        </div>

        <div className="card">
          <p className="text-xs text-purple-400 uppercase tracking-wider mb-4">Saved resumes</p>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : resumes.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={36} color="#334155" className="mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No role-specific resumes yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {resumes.map(r => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <div>
                    <p className="text-white font-medium capitalize">{r.role_type}</p>
                    <p className="text-slate-500 text-xs">{r.original_filename ?? 'resume.pdf'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="text-slate-500 hover:text-red-400 p-2"
                    aria-label="Delete resume"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
