/**
 * Login page — calls real /api/auth/login via useAuth().
 * Also offers "Sign in with Google" (existing accounts only) on the web.
 * On success redirects to /dashboard.
 */
import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../lib/auth'
import LoginScreen from '../components/ui/LoginScreen'
import GoogleSignInButton from '../components/ui/GoogleSignInButton'

// Public OAuth web client ID (safe to ship). Override per-deployment with
// VITE_GOOGLE_CLIENT_ID at build time (e.g. a client VPS with its own Google project).
const GOOGLE_CLIENT_ID =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID) ||
  '1096081783924-etthdttkand490a3s5p2v0g2ip6i9le6.apps.googleusercontent.com'

export default function Login() {
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(email: string, password: string) {
    setLoading(true)
    setError('')
    const err = await login(email, password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/dashboard', { replace: true })
  }

  const handleGoogle = useCallback(
    async (idToken: string) => {
      setLoading(true)
      setError('')
      const err = await loginWithGoogle(idToken)
      setLoading(false)
      if (err) setError(err)
      else navigate('/dashboard', { replace: true })
    },
    [loginWithGoogle, navigate]
  )

  // GIS web flow is blocked inside the native app webview — show it on web only.
  const googleFooter = !Capacitor.isNativePlatform() ? (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} onCredential={handleGoogle} />
    </div>
  ) : null

  return (
    <div className="relative">
      <LoginScreen onLogin={handleLogin} loading={loading} error={error} footer={googleFooter} />
      <div className="fixed bottom-6 left-0 right-0 flex justify-center">
        <p className="text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
