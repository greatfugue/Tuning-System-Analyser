import NavBar from '../components/NavBar.jsx'
import App from '../App.jsx'

export default function AppPage() {
  return (
    <div style={{
      paddingTop: '48px',
      height: '100vh',
      overflow: 'hidden',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <NavBar />
      <div style={{ flex: 1, minHeight: 0 }}>
        <App />
      </div>
    </div>
  )
}