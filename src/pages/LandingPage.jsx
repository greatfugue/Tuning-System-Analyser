import { useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar.jsx'

const TC = {
  bg:      '#1e1e2e',
  panel:   '#2a2a3e',
  card:    '#313145',
  fg:      '#e0e0f0',
  fg_dim:  '#888899',
  accent:  '#5e9bff',
  sep:     '#3a3a50',
  pure:    '#50fa7b',
}

const DOWNLOAD_URL = 'https://github.com/greatfugue/Tuning-System-Analyser/blob/main/COF.py'
const GITHUB_URL    = 'https://github.com/greatfugue/Tuning-System-Analyser'
const FORMSPREE_URL = 'https://formspree.io/f/xykvvnkv'

function Section({ children, style }) {
  return (
    <section style={{ maxWidth: '720px', margin: '0 auto', padding: '64px 24px', ...style }}>
      {children}
    </section>
  )
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${TC.sep}`, margin: '0 24px' }} />
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: 'Helvetica, sans-serif',
      fontSize: '13px',
      fontWeight: 'bold',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: TC.fg_dim,
      marginTop: 0,
      marginBottom: '24px',
    }}>
      {children}
    </h2>
  )
}

function BodyText({ children, style }) {
  return (
    <p style={{
      fontFamily: 'Helvetica, sans-serif',
      fontSize: '16px',
      lineHeight: '1.75',
      color: TC.fg,
      margin: '0 0 16px 0',
      ...style,
    }}>
      {children}
    </p>
  )
}

function CodeBlock({ children }) {
  return (
    <pre style={{
      background: TC.card,
      border: `1px solid ${TC.sep}`,
      borderRadius: '6px',
      padding: '14px 18px',
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: TC.fg,
      overflowX: 'auto',
      margin: '8px 0 16px 0',
      lineHeight: '1.6',
    }}>
      {children}
    </pre>
  )
}

function ContactForm() {
  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    const data = new FormData(e.target)
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) e.target.reset()
    } catch {
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%',
    background: TC.card,
    border: `1px solid ${TC.sep}`,
    borderRadius: '5px',
    color: TC.fg,
    fontFamily: 'Helvetica, sans-serif',
    fontSize: '14px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: '12px',
    display: 'block',
  }

  const labelStyle = {
    fontFamily: 'Helvetica, sans-serif',
    fontSize: '12px',
    color: TC.fg_dim,
    display: 'block',
    marginBottom: '4px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }

  return (
    <form onSubmit={handleSubmit} encType="multipart/form-data">
      <label style={labelStyle}>Name</label>
      <input name="name" required style={inputStyle} />

      <label style={labelStyle}>Email</label>
      <input name="email" type="email" required style={inputStyle} />

      <label style={labelStyle}>Message</label>
      <textarea name="message" required rows={5} style={{ ...inputStyle, resize: 'vertical' }} />

      <label style={labelStyle}>Attachment (optional)</label>
      <input name="attachment" type="file" multiple style={{
        ...inputStyle,
        color: TC.fg_dim,
        padding: '8px 12px',
        cursor: 'pointer',
      }} />

      <button type="submit" disabled={status === 'sending'} style={{
        marginTop: '8px',
        background: status === 'sending' ? TC.panel : TC.accent,
        color: '#ffffff',
        border: 'none',
        borderRadius: '5px',
        fontFamily: 'Helvetica, sans-serif',
        fontWeight: 'bold',
        fontSize: '14px',
        padding: '10px 24px',
        cursor: status === 'sending' ? 'default' : 'pointer',
      }}>
        {status === 'sending' ? 'Sending…' : 'Send'}
      </button>

      {status === 'success' && (
        <p style={{ color: TC.pure, fontFamily: 'Helvetica, sans-serif', fontSize: '14px', marginTop: '12px' }}>
          Sent. Thank you.
        </p>
      )}
      {status === 'error' && (
        <p style={{ color: '#ff5555', fontFamily: 'Helvetica, sans-serif', fontSize: '14px', marginTop: '12px' }}>
          Something went wrong. Try again or email directly.
        </p>
      )}
    </form>
  )
}

export default function LandingPage() {
  return (
    <div style={{ background: TC.bg, minHeight: '100vh', color: TC.fg }}>
      <NavBar />

      {/* ── Hero ── */}
      <Section style={{ paddingTop: '120px', paddingBottom: '80px', textAlign: 'center' }}>
        <p style={{
          fontFamily: 'Helvetica, sans-serif',
          fontSize: '13px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: TC.accent,
          marginBottom: '16px',
          marginTop: 0,
        }}>
          Circle of Fifths
        </p>
        <h1 style={{
          fontFamily: 'Helvetica, sans-serif',
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 'bold',
          color: TC.fg,
          margin: '0 0 24px 0',
          lineHeight: 1.1,
        }}>
          Interactive Tuning<br />System Analyser
        </h1>
        <p style={{
          fontFamily: 'Helvetica, sans-serif',
          fontSize: '18px',
          color: TC.fg_dim,
          maxWidth: '480px',
          margin: '0 auto 40px auto',
          lineHeight: 1.6,
        }}>
          Explore, compare, and analyse musical tuning systems
          through their circle of fifths structure.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/app" style={{
            background: TC.accent,
            color: '#ffffff',
            textDecoration: 'none',
            fontFamily: 'Helvetica, sans-serif',
            fontWeight: 'bold',
            fontSize: '15px',
            padding: '12px 28px',
            borderRadius: '6px',
          }}>
            Launch App
          </Link>
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" style={{
            background: TC.card,
            color: TC.fg,
            textDecoration: 'none',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: '15px',
            padding: '12px 28px',
            borderRadius: '6px',
            border: `1px solid ${TC.sep}`,
          }}>
            Download Python Version
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={{
            background: 'transparent',
            color: TC.fg_dim,
            textDecoration: 'none',
            fontFamily: 'Helvetica, sans-serif',
            fontSize: '15px',
            padding: '12px 28px',
            borderRadius: '6px',
            border: `1px solid ${TC.sep}`,
          }}>
            View on GitHub
          </a>
        </div>
      </Section>

      <Divider />

      {/* ── About ── */}
      <Section>
        <SectionTitle>About</SectionTitle>
        <BodyText>
          This app started as a visualising tool for a school project, where I needed
          to explain the history and physics of tuning systems and their drawbacks.
          Nothing like this existed online, so I ended up building the app in Python
          with AI assistance, which was easier than expected. It became a labour of love.
        </BodyText>
        <BodyText>
          You can find the original Python code attached here, but the code found its
          real home as a JavaScript website. The source code will always be fully open
          and fully free, and I would be overjoyed if people would write and/or modify
          existing code and send these additions to me. I will naturally incorporate
          them into the app.
        </BodyText>
        <BodyText>
          One obvious direction nobody has tackled yet: a Tonnetz / lattice visualiser
          for 5-limit JI and beyond. Please also let me know if any of the maths is wrong.
        </BodyText>
      </Section>

      <Divider />

      {/* ── Python version ── */}
      <Section>
        <SectionTitle>Python Version</SectionTitle>
        <BodyText>
          The original app runs as a desktop application. It has the same analytical
          core as this website and works on macOS, Windows, and Linux.
        </BodyText>
        <BodyText style={{ color: TC.fg_dim, fontSize: '14px' }}>Requirements: Python 3.8 or later</BodyText>
        <CodeBlock>pip install customtkinter matplotlib numpy</CodeBlock>
        <BodyText style={{ color: TC.fg_dim, fontSize: '14px', marginTop: '8px' }}>Then run:</BodyText>
        <CodeBlock>python3 COF.py</CodeBlock>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" style={{ color: TC.accent, fontFamily: 'Helvetica, sans-serif', fontSize: '14px' }}>
            Download COFNew.py
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={{ color: TC.accent, fontFamily: 'Helvetica, sans-serif', fontSize: '14px' }}>
            View source on GitHub
          </a>
        </div>
      </Section>

      <Divider />

      {/* ── AI Disclosure ── */}
      <Section>
        <SectionTitle>A note on AI</SectionTitle>
        <BodyText style={{ color: TC.fg_dim }}>
          All code in this tool is AI-generated. All ideas, design decisions, music
          theory, as well as the framework for analysis come from a human brain. Some
          of those ideas were refined or stress-tested through conversation with AI.
        </BodyText>
      </Section>

      <Divider />

      {/* ── Contact ── */}
      <Section>
        <SectionTitle>Get in touch / Contribute</SectionTitle>
        <BodyText>
          Have a contribution, a bug report, or a correction to the maths? Send it here.
        </BodyText>
        <ContactForm />
      </Section>

      {/* ── Footer ── */}
      <div style={{
        borderTop: `1px solid ${TC.sep}`,
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: '12px',
        color: TC.fg_dim,
      }}>
        Circle of Fifths · Interactive Tuning System Analyser ·{' '}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={{ color: TC.fg_dim }}>
          Open source
        </a>
      </div>
    </div>
  )
}