'use client'

import { useEffect, useState, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { candidateApi, CandidateResume, getErrorMessage } from '@/lib/api'
import toast from 'react-hot-toast'
import { Upload, Trash2, FileText, Plus, CheckCircle } from 'lucide-react'

const CARD = { background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24 }

const ROLE_COLORS: Record<string, string> = {
  backend:    '#a78bfa', frontend:   '#38bdf8', fullstack: '#4ade80',
  data:       '#fbbf24', ml:         '#f87171', devops:    '#34d399',
  mobile:     '#818cf8', design:     '#e879f9', product:   '#fb923c',
  management: '#22d3ee',
}

export default function ResumesPage() {
  const [resumes, setResumes]   = useState<CandidateResume[]>([])
  const [roleTypes, setRoleTypes] = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const fileRef                 = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      candidateApi.listResumes().then(r => setResumes(r.data)),
      candidateApi.roleTypes().then(r => setRoleTypes(r.data.role_types)),
    ]).finally(() => setLoading(false))
  }, [])

  const upload = async () => {
    if (!file || !selectedRole) { toast.error('Select a role type and PDF file.'); return }
    setUploading(selectedRole)
    try {
      const { data } = await candidateApi.uploadResume(selectedRole, file)
      setResumes(prev => {
        const exists = prev.findIndex(r => r.role_type === selectedRole)
        return exists >= 0 ? prev.map((r, i) => i === exists ? data : r) : [...prev, data]
      })
      toast.success(`${selectedRole} resume uploaded!`)
      setShowUpload(false); setFile(null); setSelectedRole('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(null)
    }
  }

  const remove = async (id: number, role: string) => {
    if (!confirm(`Delete your ${role} resume?`)) return
    setDeleting(id)
    try {
      await candidateApi.deleteResume(id)
      setResumes(prev => prev.filter(r => r.id !== id))
      toast.success('Resume deleted.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  const uploadedRoles = new Set(resumes.map(r => r.role_type))

  return (
    <DashboardLayout requiredRole="candidate">
      <PageHeader
        title="Resume Library"
        subtitle="Upload one resume per role type. Auto-match uses your best resume for each job."
        action={
          <button onClick={() => setShowUpload(!showUpload)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Add Resume
          </button>
        }
      />

      {/* Upload panel */}
      {showUpload && (
        <div style={{ ...CARD, marginBottom: 24, borderColor: 'rgba(167,139,250,0.3)' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Upload Role Resume</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Role Type</label>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                style={{ width: '100%', background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }}>
                <option value="">Select role…</option>
                {roleTypes.map(t => (
                  <option key={t} value={t}>{t} {uploadedRoles.has(t) ? '(replace)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>PDF File</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${file ? '#a78bfa' : 'rgba(99,102,241,0.3)'}`, borderRadius: 10, padding: '10px 16px', cursor: 'pointer', background: file ? 'rgba(167,139,250,0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                {file ? <CheckCircle size={16} color="#a78bfa" /> : <Upload size={16} color="#475569" />}
                <span style={{ color: file ? '#a78bfa' : '#475569', fontSize: 13 }}>{file ? file.name : 'Click to upload PDF'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={upload} disabled={!!uploading || !file || !selectedRole}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!file || !selectedRole) ? 0.5 : 1 }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button onClick={() => { setShowUpload(false); setFile(null); setSelectedRole('') }}
              style={{ background: 'transparent', border: '1px solid rgba(99,102,241,0.3)', color: '#94a3b8', borderRadius: 10, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resume grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} style={{ ...CARD, height: 140, animation: 'pulse 2s infinite' }} />)}
        </div>
      ) : resumes.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 64 }}>
          <FileText size={48} color="#1e293b" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#475569', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>No resumes yet</p>
          <p style={{ color: '#334155', fontSize: 14, marginTop: 8, marginBottom: 20 }}>
            Upload a resume for each role you're targeting. The auto-match engine will use the best one for each job.
          </p>
          <button onClick={() => setShowUpload(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} /> Add your first resume
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16, marginBottom: 20 }}>
            {resumes.map(r => {
              const color = ROLE_COLORS[r.role_type] ?? '#94a3b8'
              return (
                <div key={r.id} style={{ ...CARD, borderColor: `${color}30`, position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}60`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}30`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: `${color}20`, borderRadius: 10, padding: 10 }}>
                      <FileText size={20} color={color} />
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', fontSize: 15, margin: 0, textTransform: 'capitalize' }}>{r.role_type}</p>
                      <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>Resume</p>
                    </div>
                  </div>
                  {r.filename && (
                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</p>
                  )}
                  <p style={{ color: '#334155', fontSize: 11, marginBottom: 16 }}>
                    Updated {new Date(r.updated_at).toLocaleDateString()}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setSelectedRole(r.role_type); setShowUpload(true) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: `${color}15`, border: `1px solid ${color}40`, color, borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Upload size={12} /> Replace
                    </button>
                    <button onClick={() => remove(r.id, r.role_type)} disabled={deleting === r.id}
                      style={{ padding: '7px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 8, cursor: 'pointer', opacity: deleting === r.id ? 0.5 : 1 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add more card */}
            {roleTypes.filter(t => !uploadedRoles.has(t)).length > 0 && (
              <button onClick={() => setShowUpload(true)}
                style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: '2px dashed rgba(99,102,241,0.2)', background: 'transparent', minHeight: 160 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)')}>
                <Plus size={24} color="#334155" />
                <span style={{ color: '#475569', fontSize: 13 }}>Add role resume</span>
              </button>
            )}
          </div>

          {/* Role coverage */}
          <div style={CARD}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', marginBottom: 16, fontSize: 14 }}>Role Coverage</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roleTypes.map(t => {
                const has = uploadedRoles.has(t)
                const color = ROLE_COLORS[t] ?? '#94a3b8'
                return (
                  <span key={t} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: has ? `${color}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${has ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                    color: has ? color : '#334155',
                    borderRadius: 50, padding: '4px 12px', fontSize: 12, fontWeight: 500,
                  }}>
                    {has ? '✓' : '+'} {t}
                  </span>
                )
              })}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}