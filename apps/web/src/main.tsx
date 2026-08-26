/** Web entry with an authentication gate around the existing shell bootstrap. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { AppWebEntry } from '@deepseek-ai/dsh-client-web'
import { AuthBar, AuthGate, logoutAuth, type AuthUser } from './auth.tsx'
import './auth.css'

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')

function AuthenticatedApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }): React.ReactElement {
  const [mount] = React.useState(() => {
    const node = document.createElement('div')
    node.className = 'auth-app-mount'
    return node
  })
  React.useEffect(() => {
    const entry = new AppWebEntry(mount)
    void entry.run()
    return () => { void entry.dispose() }
  }, [mount])
  return <><AuthBar user={user} onLogout={onLogout} /><div className="auth-app-host" ref={(node) => { if (node !== null && !node.contains(mount)) node.append(mount) }} /></>
}

function Shell(): React.ReactElement {
  const [user, setUser] = React.useState<AuthUser>()
  if (user === undefined) return <AuthGate onAuthenticated={setUser} />
  return <AuthenticatedApp user={user} onLogout={() => { void logoutAuth(); setUser(undefined) }} />
}

createRoot(el).render(<Shell />)
