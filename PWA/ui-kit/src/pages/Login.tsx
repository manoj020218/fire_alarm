/**
 * Login page — calls real /api/auth/login via useAuth().
 * On success redirects to /dashboard.
 * Shows error on 401.
 * Includes "Create an account" link to /signup.
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import LoginScreen from '../components/ui/LoginScreen'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(email: string, password: string) {
    setLoading(true)
    setError('')
    const err = await login(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className="relative">
      <LoginScreen onLogin={handleLogin} loading={loading} error={error} />
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
