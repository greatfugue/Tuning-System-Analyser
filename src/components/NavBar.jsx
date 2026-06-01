import { Link, useLocation } from 'react-router-dom'

const TC = {
  bg:      '#1e1e2e',
  panel:   '#2a2a3e',
  fg:      '#e0e0f0',
  fg_dim:  '#888899',
  accent:  '#5e9bff',
  sep:     '#3a3a50',
}

export default function NavBar() {
  const location = useLocation()
  const onApp = location.pathname === '/app'

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: '48px',
      background: TC.bg,
      borderBottom: `1px solid ${TC.sep}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 200,
      boxSizing: 'border-box',
    }}>
      <Link to="/" style={{
        color: TC.fg,
        textDecoration: 'none',
        fontFamily: 'Helvetica, sans-serif',
        fontWeight: 'bold',
        fontSize: '15px',
        letterSpacing: '0.01em',
      }}>
        Circle of Fifths
      </Link>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to="/" style={{
          color: onApp ? TC.fg_dim : TC.accent,
          textDecoration: 'none',
          fontFamily: 'Helvetica, sans-serif',
          fontSize: '13px',
          padding: '4px 10px',
          borderRadius: '4px',
        }}>
          About
        </Link>
        <Link to="/app" style={{
          color: '#ffffff',
          background: onApp ? TC.panel : TC.accent,
          textDecoration: 'none',
          fontFamily: 'Helvetica, sans-serif',
          fontSize: '13px',
          fontWeight: 'bold',
          padding: '6px 14px',
          borderRadius: '4px',
        }}>
          Launch App
        </Link>
      </div>
    </nav>
  )
}