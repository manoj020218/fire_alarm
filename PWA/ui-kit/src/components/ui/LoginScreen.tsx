import { useState } from 'react'
import Input from './Input'
import Button from './Button'
import Toggle from './Toggle'

interface Props {
  onLogin?: (email: string, password: string, remember: boolean) => void
  loading?: boolean
  error?: string
}

export default function LoginScreen({ onLogin, loading = false, error }: Props) {
  const [email, setEmail] = useState('admin@abctowers.com')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPass, setShowPass] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onLogin?.(email, password, remember)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-900/40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 2c0 4-4 6-3 10 1-1.5 2-4 5-4-1.5 3 0 6 1.5 7.5C15 13 18 12 17 8c-1 1.5-2.5 4-5 2C14 8 16 4 12 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">FireGuard</h1>
          <p className="text-slate-400 text-sm mt-1">by Jenix — Fire Safety Monitoring</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-xl p-7">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">Access your fire monitoring dashboard</p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" onClick={() => setShowPass(v => !v)} style={{ cursor: 'pointer' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />
            <div className="flex items-center justify-between">
              <Toggle checked={remember} onChange={setRemember} label="Remember me" />
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Forgot password?</button>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center mt-2">
              Sign in to FireGuard
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          FireGuard v1.0 · ABC Towers, Mumbai · SITE001
        </p>
      </div>
    </div>
  )
}
