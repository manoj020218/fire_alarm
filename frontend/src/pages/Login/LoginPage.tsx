import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdFireplace, MdEmail, MdLock, MdWarning } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { mockLogin } from '@/services/auth';
import { ROUTES } from '@/utils/constants';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) { navigate(ROUTES.DASHBOARD, { replace: true }); return null; }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await mockLogin(email, password);
      login(user, token);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-sidebar">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 p-16 gap-6">
        <div className="w-20 h-20 bg-brand-red rounded-2xl flex items-center justify-center mb-4">
          <MdFireplace className="text-white text-5xl" />
        </div>
        <h1 className="text-4xl font-bold text-white">JENIX FireGuard</h1>
        <p className="text-slate-400 text-center text-lg max-w-sm">
          Smart Fire Fighting System Monitoring — Real-time RS485 equipment dashboard for fire safety professionals.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-sm">
          {[
            { label: 'Equipment Types', value: '14+' },
            { label: 'Real-time Updates', value: '10s' },
            { label: 'User Roles', value: '5' },
            { label: 'Alarm Response', value: 'Instant' },
          ].map((s) => (
            <div key={s.label} className="bg-sidebar-accent rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col justify-center items-center flex-1 p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center">
              <MdFireplace className="text-white text-2xl" />
            </div>
            <div>
              <p className="font-bold text-slate-800">JENIX FireGuard</p>
              <p className="text-xs text-slate-500">Smart Fire Monitoring</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">Sign in</h2>
          <p className="text-slate-500 text-sm mb-8">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@abctowers.com"
                  required
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2.5 rounded-lg border border-red-200">
                <MdWarning className="flex-shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-base mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">Demo credentials (all use Pass@123)</p>
            <div className="space-y-1">
              {[
                'admin@jenix.io',
                'admin@abctowers.com',
                'maint@abctowers.com',
                'viewer@abctowers.com',
              ].map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmail(e); setPassword('Pass@123'); }}
                  className="text-xs text-blue-600 hover:text-blue-800 block hover:underline"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
