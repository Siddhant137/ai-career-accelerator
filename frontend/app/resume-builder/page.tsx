'use client'

import { useState, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/ui/PageHeader'
import { Printer, Download, Plus, Trash2, Eye, EyeOff } from 'lucide-react'

interface WorkExp { id: number; company: string; role: string; period: string; bullets: string[] }
interface Education { id: number; institution: string; degree: string; period: string; gpa?: string }
interface Project { id: number; name: string; tech: string; desc: string; link?: string }

const DEFAULT: {
  name: string; email: string; phone: string; location: string; linkedin: string; github: string; website: string
  summary: string; skills: string[]; experience: WorkExp[]; education: Education[]; projects: Project[]
} = {
  name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '',
  summary: '',
  skills: [''],
  experience: [{ id: 1, company: '', role: '', period: '', bullets: [''] }],
  education:  [{ id: 1, institution: '', degree: '', period: '', gpa: '' }],
  projects:   [{ id: 1, name: '', tech: '', desc: '', link: '' }],
}

let idSeq = 10

function Input({ label, value, onChange, placeholder = '', type = 'text' }: any) {
  return (
    <div>
      <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3, placeholder = '' }: any) {
  return (
    <div>
      <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width: '100%', background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical' }} />
    </div>
  )
}

// ── Print-ready resume template ────────────────────────────────────────────────
function ResumePreview({ data }: { data: typeof DEFAULT }) {
  const filledSkills = data.skills.filter(Boolean)
  return (
    <div id="resume-print" style={{ fontFamily: 'Georgia, serif', color: '#111', background: '#fff', padding: '40px 48px', maxWidth: 800, margin: '0 auto', fontSize: 13, lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1e1e2e', paddingBottom: 14, marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{data.name || 'Your Name'}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 16px', color: '#555', fontSize: 12 }}>
          {data.email    && <span>{data.email}</span>}
          {data.phone    && <span>{data.phone}</span>}
          {data.location && <span>{data.location}</span>}
          {data.linkedin && <span>{data.linkedin}</span>}
          {data.github   && <span>{data.github}</span>}
          {data.website  && <span>{data.website}</span>}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 6 }}>Summary</h2>
          <p style={{ margin: 0, color: '#333' }}>{data.summary}</p>
        </div>
      )}

      {/* Skills */}
      {filledSkills.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 6 }}>Skills</h2>
          <p style={{ margin: 0, color: '#333' }}>{filledSkills.join(' · ')}</p>
        </div>
      )}

      {/* Experience */}
      {data.experience.some(e => e.company) && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 8 }}>Experience</h2>
          {data.experience.filter(e => e.company).map(e => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{e.role}</strong>
                <span style={{ color: '#555' }}>{e.period}</span>
              </div>
              <div style={{ color: '#555', fontStyle: 'italic', marginBottom: 4 }}>{e.company}</div>
              <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i} style={{ color: '#333', marginBottom: 2 }}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {data.projects.some(p => p.name) && (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 8 }}>Projects</h2>
          {data.projects.filter(p => p.name).map(p => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{p.name}</strong>
                {p.link && <span style={{ color: '#555', fontSize: 12 }}>{p.link}</span>}
              </div>
              {p.tech && <div style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>{p.tech}</div>}
              <p style={{ margin: '2px 0 0', color: '#333' }}>{p.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education.some(e => e.institution) && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 8 }}>Education</h2>
          {data.education.filter(e => e.institution).map(e => (
            <div key={e.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{e.institution}</strong>
                <span style={{ color: '#555' }}>{e.period}</span>
              </div>
              <div style={{ color: '#555' }}>{e.degree}{e.gpa ? ` · GPA: ${e.gpa}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResumeBuilderPage() {
  const [data, setData]     = useState(DEFAULT)
  const [preview, setPreview] = useState(false)
  const printRef            = useRef<HTMLDivElement>(null)

  const set = (key: string, value: any) => setData(d => ({ ...d, [key]: value }))

  const print = () => {
    const content = document.getElementById('resume-print')
    if (!content) return
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>${data.name || 'Resume'}</title>
      <style>body{margin:0;padding:0;font-family:Georgia,serif;}@media print{@page{margin:0.5in;}}</style>
      </head><body>${content.innerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const addExp  = () => setData(d => ({ ...d, experience: [...d.experience, { id: ++idSeq, company: '', role: '', period: '', bullets: [''] }] }))
  const addEdu  = () => setData(d => ({ ...d, education:  [...d.education,  { id: ++idSeq, institution: '', degree: '', period: '', gpa: '' }] }))
  const addProj = () => setData(d => ({ ...d, projects:   [...d.projects,   { id: ++idSeq, name: '', tech: '', desc: '', link: '' }] }))

  const SECTION = { background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24, marginBottom: 20 }
  const SEC_TITLE = { fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#e2e8f0', fontSize: 16, marginBottom: 16 }
  const GRID2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
  const ADD_BTN = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a78bfa', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', marginTop: 12 }
  const DEL_BTN = { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }

  return (
    <DashboardLayout requiredRole="candidate">
      <PageHeader
        title="Resume Builder"
        subtitle="Build a clean, printable resume. Edit everything inline."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPreview(!preview)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.3)', color: '#94a3b8', borderRadius: 12, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
              {preview ? <EyeOff size={15} /> : <Eye size={15} />} {preview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={print}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        }
      />

      {preview ? (
        <div style={{ background: '#f5f5f5', borderRadius: 16, padding: 20, overflowX: 'auto' }}>
          <ResumePreview data={data} />
        </div>
      ) : (
        <div>
          {/* Personal info */}
          <div style={SECTION}>
            <p style={SEC_TITLE}>Personal Info</p>
            <div style={{ ...GRID2, marginBottom: 14 }}>
              <Input label="Full Name"  value={data.name}     onChange={(v: string) => set('name', v)}     placeholder="Jane Doe" />
              <Input label="Email"      value={data.email}    onChange={(v: string) => set('email', v)}    placeholder="jane@example.com" type="email" />
              <Input label="Phone"      value={data.phone}    onChange={(v: string) => set('phone', v)}    placeholder="+1 234 567 8901" />
              <Input label="Location"   value={data.location} onChange={(v: string) => set('location', v)} placeholder="San Francisco, CA" />
              <Input label="LinkedIn"   value={data.linkedin} onChange={(v: string) => set('linkedin', v)} placeholder="linkedin.com/in/janedoe" />
              <Input label="GitHub"     value={data.github}   onChange={(v: string) => set('github', v)}   placeholder="github.com/janedoe" />
              <Input label="Website"    value={data.website}  onChange={(v: string) => set('website', v)}  placeholder="janedoe.dev" />
            </div>
            <Textarea label="Professional Summary" value={data.summary} onChange={(v: string) => set('summary', v)}
              placeholder="Brief 2-3 sentence summary of your background and goals." rows={3} />
          </div>

          {/* Skills */}
          <div style={SECTION}>
            <p style={SEC_TITLE}>Skills</p>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>One skill per line — or comma-separated.</p>
            <Textarea label="" value={data.skills.join('\n')}
              onChange={(v: string) => set('skills', v.split('\n'))}
              placeholder="React, TypeScript, Node.js&#10;PostgreSQL, Redis&#10;AWS, Docker" rows={5} />
          </div>

          {/* Experience */}
          <div style={SECTION}>
            <p style={SEC_TITLE}>Work Experience</p>
            {data.experience.map((exp, i) => (
              <div key={exp.id} style={{ border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>Position {i + 1}</span>
                  {data.experience.length > 1 && (
                    <button onClick={() => setData(d => ({ ...d, experience: d.experience.filter(e => e.id !== exp.id) }))} style={DEL_BTN}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div style={{ ...GRID2, marginBottom: 12 }}>
                  <Input label="Company" value={exp.company} onChange={(v: string) => setData(d => ({ ...d, experience: d.experience.map(e => e.id === exp.id ? { ...e, company: v } : e) }))} placeholder="Acme Corp" />
                  <Input label="Role"    value={exp.role}    onChange={(v: string) => setData(d => ({ ...d, experience: d.experience.map(e => e.id === exp.id ? { ...e, role:    v } : e) }))} placeholder="Software Engineer" />
                  <Input label="Period"  value={exp.period}  onChange={(v: string) => setData(d => ({ ...d, experience: d.experience.map(e => e.id === exp.id ? { ...e, period:  v } : e) }))} placeholder="Jan 2022 – Present" />
                </div>
                <label style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Bullet Points</label>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input value={b} onChange={e => setData(d => ({ ...d, experience: d.experience.map(ex => ex.id === exp.id ? { ...ex, bullets: ex.bullets.map((bx, bxi) => bxi === bi ? e.target.value : bx) } : ex) }))}
                      placeholder={`• Achievement ${bi + 1}`}
                      style={{ flex: 1, background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
                    {exp.bullets.length > 1 && (
                      <button onClick={() => setData(d => ({ ...d, experience: d.experience.map(ex => ex.id === exp.id ? { ...ex, bullets: ex.bullets.filter((_, bxi) => bxi !== bi) } : ex) }))} style={DEL_BTN}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setData(d => ({ ...d, experience: d.experience.map(ex => ex.id === exp.id ? { ...ex, bullets: [...ex.bullets, ''] } : ex) }))} style={ADD_BTN}>
                  <Plus size={13} /> Add bullet
                </button>
              </div>
            ))}
            <button onClick={addExp} style={ADD_BTN}><Plus size={13} /> Add position</button>
          </div>

          {/* Projects */}
          <div style={SECTION}>
            <p style={SEC_TITLE}>Projects</p>
            {data.projects.map((proj, i) => (
              <div key={proj.id} style={{ border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 600 }}>Project {i + 1}</span>
                  {data.projects.length > 1 && (
                    <button onClick={() => setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== proj.id) }))} style={DEL_BTN}><Trash2 size={13} /></button>
                  )}
                </div>
                <div style={{ ...GRID2, marginBottom: 12 }}>
                  <Input label="Project Name" value={proj.name} onChange={(v: string) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, name: v } : p) }))} placeholder="CareerAI" />
                  <Input label="Tech Stack"   value={proj.tech} onChange={(v: string) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, tech: v } : p) }))} placeholder="React, FastAPI, PostgreSQL" />
                  <Input label="Link"         value={proj.link ?? ''} onChange={(v: string) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, link: v } : p) }))} placeholder="github.com/you/project" />
                </div>
                <Textarea label="Description" value={proj.desc} rows={2}
                  onChange={(v: string) => setData(d => ({ ...d, projects: d.projects.map(p => p.id === proj.id ? { ...p, desc: v } : p) }))}
                  placeholder="What it does, impact, scale." />
              </div>
            ))}
            <button onClick={addProj} style={ADD_BTN}><Plus size={13} /> Add project</button>
          </div>

          {/* Education */}
          <div style={SECTION}>
            <p style={SEC_TITLE}>Education</p>
            {data.education.map((edu, i) => (
              <div key={edu.id} style={{ border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>Education {i + 1}</span>
                  {data.education.length > 1 && (
                    <button onClick={() => setData(d => ({ ...d, education: d.education.filter(e => e.id !== edu.id) }))} style={DEL_BTN}><Trash2 size={13} /></button>
                  )}
                </div>
                <div style={GRID2}>
                  <Input label="Institution" value={edu.institution} onChange={(v: string) => setData(d => ({ ...d, education: d.education.map(e => e.id === edu.id ? { ...e, institution: v } : e) }))} placeholder="MIT" />
                  <Input label="Degree"      value={edu.degree}      onChange={(v: string) => setData(d => ({ ...d, education: d.education.map(e => e.id === edu.id ? { ...e, degree:      v } : e) }))} placeholder="B.S. Computer Science" />
                  <Input label="Period"      value={edu.period}      onChange={(v: string) => setData(d => ({ ...d, education: d.education.map(e => e.id === edu.id ? { ...e, period:      v } : e) }))} placeholder="2019 – 2023" />
                  <Input label="GPA"         value={edu.gpa ?? ''}   onChange={(v: string) => setData(d => ({ ...d, education: d.education.map(e => e.id === edu.id ? { ...e, gpa:         v } : e) }))} placeholder="3.9 / 4.0" />
                </div>
              </div>
            ))}
            <button onClick={addEdu} style={ADD_BTN}><Plus size={13} /> Add education</button>
          </div>

          {/* Bottom print button */}
          <div style={{ textAlign: 'center', paddingBottom: 40 }}>
            <button onClick={print}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 36px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif', boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
              <Download size={18} /> Export as PDF
            </button>
            <p style={{ color: '#334155', fontSize: 12, marginTop: 10 }}>Opens print dialog — choose "Save as PDF"</p>
          </div>
        </div>
      )}

      {/* Hidden preview for printing (always rendered) */}
      {!preview && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <ResumePreview data={data} />
        </div>
      )}
    </DashboardLayout>
  )
}