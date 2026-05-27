'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── WebGL Shader Background ────────────────────────────────────────────────────
function ShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const vert = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `
    const frag = `
      precision highp float;
      uniform float u_time;
      uniform vec2  u_res;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 6; i++) { v += a*noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / min(u_res.x, u_res.y);
        float t = u_time * 0.15;

        // Animated nebula
        vec2 q = vec2(fbm(uv + t*0.3), fbm(uv + vec2(1.7,9.2)));
        vec2 r = vec2(fbm(uv + 2.0*q + vec2(1.7+t*0.1, 9.2)), fbm(uv + 2.0*q + vec2(8.3, 2.8+t*0.05)));
        float f = fbm(uv + 2.2*r);

        // Purple/blue/teal palette
        vec3 col = mix(vec3(0.02, 0.02, 0.05), vec3(0.15, 0.05, 0.35), clamp(f*f*4.0, 0.0, 1.0));
        col = mix(col, vec3(0.05, 0.10, 0.40), clamp(f*2.0, 0.0, 1.0));
        col = mix(col, vec3(0.02, 0.25, 0.45), clamp(length(q)*1.5, 0.0, 1.0));

        // Glowing orbs
        float d1 = length(uv - vec2(sin(t*0.7)*0.4, cos(t*0.5)*0.3));
        float d2 = length(uv - vec2(cos(t*0.4)*0.5, sin(t*0.6)*0.25));
        float d3 = length(uv - vec2(sin(t*0.9+1.0)*0.3, cos(t*0.3+2.0)*0.4));

        col += 0.06 * vec3(0.6, 0.2, 1.0) / (d1*d1 + 0.01);
        col += 0.04 * vec3(0.1, 0.4, 1.0) / (d2*d2 + 0.01);
        col += 0.03 * vec3(0.0, 0.8, 0.9) / (d3*d3 + 0.01);

        // Vignette
        float vig = 1.0 - smoothstep(0.5, 1.5, length(uv));
        col *= vig;

        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog); gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes  = gl.getUniformLocation(prog, 'u_res')

    let start = performance.now()
    const tick = () => {
      const t = (performance.now() - start) / 1000
      gl.uniform1f(uTime, t)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.85 }}
    />
  )
}

// ── Floating Particles ─────────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x:  Math.random() * 100,
    y:  Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    dur:  Math.random() * 15 + 8,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.5 + 0.1,
  }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left:  `${p.x}%`,
            top:   `${p.y}%`,
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.id % 3 === 0 ? '#a78bfa' : p.id % 3 === 1 ? '#38bdf8' : '#818cf8',
            opacity: p.opacity,
            animation: `floatUp ${p.dur}s ${p.delay}s infinite linear`,
            boxShadow: `0 0 ${p.size * 3}px currentColor`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-120vh) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── 3D Tilt Card ───────────────────────────────────────────────────────────────
function TiltCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent) => {
    const el   = ref.current!
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    el.style.transform = `perspective(800px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale3d(1.02,1.02,1.02)`
  }
  const onLeave = () => {
    ref.current!.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ transition: 'transform 0.15s ease', transformStyle: 'preserve-3d', ...style }}
    >
      {children}
    </div>
  )
}

// ── Animated Counter ───────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      let start = 0
      const step = to / 60
      const tick = () => {
        start = Math.min(start + step, to)
        setVal(Math.floor(start))
        if (start < to) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ── Typewriter ─────────────────────────────────────────────────────────────────
function Typewriter({ words }: { words: string[] }) {
  const [idx, setIdx]   = useState(0)
  const [txt, setTxt]   = useState('')
  const [del, setDel]   = useState(false)

  useEffect(() => {
    const word = words[idx]
    const timeout = setTimeout(() => {
      if (!del) {
        setTxt(word.slice(0, txt.length + 1))
        if (txt.length + 1 === word.length) setTimeout(() => setDel(true), 1800)
      } else {
        setTxt(word.slice(0, txt.length - 1))
        if (txt.length === 0) { setDel(false); setIdx((idx + 1) % words.length) }
      }
    }, del ? 40 : 80)
    return () => clearTimeout(timeout)
  }, [txt, del, idx, words])

  return (
    <span style={{ color: '#a78bfa' }}>
      {txt}
      <span style={{ animation: 'blink 1s step-end infinite', borderRight: '2px solid #a78bfa', marginLeft: 2 }} />
    </span>
  )
}

// ── Main Landing Page ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const features = [
    { icon: '⚡', title: 'AI Resume Scoring', desc: 'Gemini-powered analysis scores your resume against any job in seconds with missing skills and project recommendations.' },
    { icon: '🎯', title: 'Auto Matching', desc: 'Our engine continuously matches candidates to jobs, notifying top performers instantly when a perfect role appears.' },
    { icon: '🔔', title: 'Smart Notifications', desc: 'Real-time alerts for matches, shortlists, and rejections — in-app and by email, so you never miss an opportunity.' },
    { icon: '🏢', title: 'Recruiter Dashboard', desc: 'Post jobs, browse AI-ranked candidates, leave notes, and manage your hiring pipeline all in one place.' },
    { icon: '📈', title: 'Skill Tracking', desc: 'Know exactly what to learn next. Track your progress on in-demand skills with curated resources.' },
    { icon: '🤖', title: 'AI Career Coach', desc: 'Chat with an AI coach trained on thousands of career paths. Get personalised advice, mock interviews, and guidance.' },
  ]

  const stats = [
    { val: 12400, suffix: '+', label: 'Candidates' },
    { val: 840,   suffix: '+', label: 'Companies' },
    { val: 97,    suffix: '%', label: 'Match Accuracy' },
    { val: 3,     suffix: 's',  label: 'Avg. Score Time' },
  ]

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <ShaderCanvas />
      <Particles />

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrollY > 40 ? 'rgba(10,10,15,0.85)' : 'transparent',
        backdropFilter: scrollY > 40 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 40 ? '1px solid rgba(99,102,241,0.2)' : 'none',
        transition: 'all 0.4s ease',
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', borderRadius: 10, padding: 8, boxShadow: '0 0 20px rgba(124,58,237,0.5)' }}>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, background: 'linear-gradient(135deg,#e8e0ff,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CareerAI
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 8, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
            Sign in
          </Link>
          <Link href="/register" style={{
            background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white',
            textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '8px 20px',
            borderRadius: 10, boxShadow: '0 4px 20px rgba(124,58,237,0.4)', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,58,237,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)' }}>
            Get Started →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 50, padding: '6px 16px', marginBottom: 32,
          animation: 'fadeSlideDown 0.8s ease both',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500 }}>AI-Powered Talent Platform · Now Live</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 'clamp(48px, 8vw, 96px)', lineHeight: 1.05,
          margin: '0 0 24px', maxWidth: 900,
          animation: 'fadeSlideDown 0.8s 0.1s ease both',
        }}>
          <span style={{ background: 'linear-gradient(135deg,#ffffff 0%,#e8e0ff 40%,#a78bfa 70%,#38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Land your dream job
          </span>
          <br />
          <Typewriter words={['10x faster.', 'with AI.', 'smarter.', 'today.']} />
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: '#94a3b8', maxWidth: 560,
          lineHeight: 1.7, margin: '0 0 48px',
          animation: 'fadeSlideDown 0.8s 0.2s ease both',
        }}>
          Upload your resume, get an AI score, match with top companies — all in under 60 seconds.
          The platform that makes talent impossible to miss.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeSlideDown 0.8s 0.3s ease both' }}>
          <Link href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
            color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700,
            padding: '14px 32px', borderRadius: 14,
            boxShadow: '0 8px 40px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
            fontFamily: 'Syne, sans-serif', transition: 'all 0.3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 16px 50px rgba(124,58,237,0.7), 0 0 0 1px rgba(255,255,255,0.1) inset' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset' }}>
            <span>🚀</span> Start for free
          </Link>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
            textDecoration: 'none', fontSize: 16, fontWeight: 600,
            padding: '14px 32px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)', transition: 'all 0.3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'none' }}>
            Sign in →
          </Link>
        </div>

        {/* Floating 3D cards preview */}
        <div style={{ position: 'relative', marginTop: 80, width: '100%', maxWidth: 700, height: 180, animation: 'fadeSlideDown 0.8s 0.5s ease both' }}>
          {[
            { left: '0%',  top: 0,   rotate: -8,  label: '⚡ Match Score', val: '94/100', color: '#4ade80' },
            { left: '30%', top: -20, rotate: 2,   label: '🎯 Jobs Matched', val: '12 New', color: '#a78bfa' },
            { left: '60%', top: 10,  rotate: 6,   label: '🔔 Shortlisted',  val: '3 Today', color: '#38bdf8' },
          ].map((card, i) => (
            <div key={i} style={{
              position: 'absolute', left: card.left, top: card.top,
              background: 'rgba(15,15,30,0.85)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 16, padding: '16px 24px', backdropFilter: 'blur(20px)',
              transform: `rotate(${card.rotate}deg)`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset`,
              animation: `float ${3 + i * 0.7}s ${i * 0.3}s ease-in-out infinite alternate`,
              minWidth: 160,
            }}>
              <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</p>
              <p style={{ color: card.color, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'Syne, sans-serif' }}>{card.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '80px 24px', background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 48, background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Counter to={s.val} suffix={s.suffix} />
              </div>
              <div style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', margin: '0 0 16px', background: 'linear-gradient(135deg,#ffffff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Everything you need to win
          </h2>
          <p style={{ color: '#64748b', fontSize: 18, maxWidth: 500, margin: '0 auto' }}>
            One platform. Candidates, recruiters, and AI — working together.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {features.map((f, i) => (
            <TiltCard key={i} style={{
              background: 'rgba(15,15,30,0.7)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 20, padding: 28, backdropFilter: 'blur(10px)',
              cursor: 'default',
            }}>
              <div style={{ fontSize: 36, marginBottom: 16, display: 'block', filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.4))' }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#e2e8f0', margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              {/* Shimmer line */}
              <div style={{ marginTop: 20, height: 2, borderRadius: 1, background: `linear-gradient(90deg, transparent, rgba(167,139,250,${0.2 + i * 0.05}), transparent)` }} />
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '80px 24px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 700, margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.15))',
          border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 28, padding: '60px 40px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 0 80px rgba(124,58,237,0.2)',
        }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(28px,4vw,44px)', margin: '0 0 16px', color: '#fff' }}>
            Ready to accelerate your career?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 17, margin: '0 0 36px', lineHeight: 1.6 }}>
            Join thousands of candidates and recruiters who've found their perfect match.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register?role=candidate" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white',
              textDecoration: 'none', fontSize: 15, fontWeight: 700,
              padding: '13px 28px', borderRadius: 12,
              boxShadow: '0 8px 30px rgba(124,58,237,0.5)',
              fontFamily: 'Syne, sans-serif', transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              👤 I'm a Candidate
            </Link>
            <Link href="/register?role=recruiter" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', color: '#e2e8f0',
              textDecoration: 'none', fontSize: 15, fontWeight: 600,
              padding: '13px 28px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none' }}>
              🏢 I'm a Recruiter
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 10, padding: '32px 24px', textAlign: 'center', borderTop: '1px solid rgba(99,102,241,0.15)', color: '#334155', fontSize: 13 }}>
        © {new Date().getFullYear()} CareerAI · Built with ⚡ and AI
      </footer>

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          from { transform: translateY(0px) rotate(var(--r, 0deg)); }
          to   { transform: translateY(-14px) rotate(var(--r, 0deg)); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  )
}