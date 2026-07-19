/**
 * Signup page — self-serve account creation.
 * POSTs to /api/public/signup (same-origin proxy).
 * On success: shows credentials card with copy button.
 * On 409: "account already exists" inline error.
 * On 502: "temporarily unavailable" inline error.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import axios from 'axios'
import type { SignupPayload, SignupSuccess } from '../lib/types'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState<SignupPayload>({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
  })
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<SignupSuccess | null>(null)
  const [copied, setCopied] = useState(false)

  function setField(field: keyof SignupPayload) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')

    try {
      const { data } = await api.post<SignupSuccess>('/public/signup', form)
      setResult(data)
      setState('success')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setErrorMsg('An account already exists for this email or phone. Please sign in.')
        } else {
          const msg = (err.response?.data as { error?: string })?.error
          setErrorMsg(msg ?? 'Signup is temporarily unavailable, please try again.')
        }
      } else {
        setErrorMsg('Signup is temporarily unavailable, please try again.')
      }
      setState('error')
    }
  }

  function copyPassword() {
    if (!result) return
    void navigator.clipboard.writeText(result.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (state === 'success' && result) {
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

          {/* Success card */}
          <div className="bg-white rounded-2xl shadow-xl p-7">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Account created!</h2>
            </div>

            <p className="text-sm text-slate-600 mb-5">
              Your FireGuard account is ready. Save your temporary password — you&apos;ll be asked to change it on first login.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{result.email}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-mono font-medium text-slate-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                    {result.tempPassword}
                  </p>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {result.trialEndsAt ? (
                <div className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  Trial active until {new Date(result.trialEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              ) : (
                <div className="text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                  {result.trialNote ?? 'Your 3-month free trial starts when you add your first gateway.'}
                </div>
              )}
            </div>

            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              Save your password now — it will not be shown again.
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full justify-center mt-5"
              onClick={() => navigate('/login')}
            >
              Continue to login →
            </Button>
          </div>
        </div>
      </div>
    )
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
          <h2 className="text-lg font-bold text-slate-800 mb-1">Create free account</h2>
          <p className="text-sm text-slate-500 mb-6">3 months free · no card required</p>

          {(state === 'error') && errorMsg && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
            <Input
              label="Company / Building name"
              type="text"
              value={form.companyName}
              onChange={setField('companyName')}
              placeholder="ABC Towers"
              required
            />
            <Input
              label="Contact name"
              type="text"
              value={form.contactName}
              onChange={setField('contactName')}
              placeholder="Your name"
              required
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={setField('phone')}
              placeholder="+91 98765 43210"
              required
            />
            <Input
              label="Email address"
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="you@example.com"
              required
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={state === 'loading'}
              className="w-full justify-center mt-2"
            >
              Start free trial
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          FireGuard v1.0 · by Jenix / IOT Soft
        </p>
      </div>
    </div>
  )
}
