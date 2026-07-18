/**
 * Auth context + hook.
 * Provides: login(), logout(), isAuthenticated, user, siteId.
 * Persists tokens + user to localStorage (keys: fg_token, fg_refresh_token, fg_user).
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api } from './api'
import { unregisterPush } from './push'
import type { AuthUser, LoginResponse } from './types'

// ── Storage keys ──────────────────────────────────────────────────────────────
const TOKEN_KEY = 'fg_token'
const REFRESH_KEY = 'fg_refresh_token'
const USER_KEY = 'fg_user'

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function saveSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** Returns null on success; error message string on failure. */
  login: (email: string, password: string) => Promise<string | null>
  /** Sign in with a Google ID token. Returns null on success; error message on failure. */
  loginWithGoogle: (idToken: string) => Promise<string | null>
  logout: () => void
  /** First siteId from the user's profile (null for super roles with no site). */
  siteId: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
      saveSession(data.accessToken, data.refreshToken, data.user)
      setUser(data.user)
      return null
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { status?: number } }).response?.status === 'number' &&
        (err as { response: { status: number } }).response.status === 401
      ) {
        return 'Invalid email or password.'
      }
      return 'Login failed. Please try again.'
    }
  }, [])

  const loginWithGoogle = useCallback(async (idToken: string): Promise<string | null> => {
    try {
      const { data } = await api.post<LoginResponse>('/auth/google', { idToken })
      saveSession(data.accessToken, data.refreshToken, data.user)
      setUser(data.user)
      return null
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined
      if (status === 404) {
        return 'No FireGuard account for this Google email. Please sign up first.'
      }
      if (status === 401) {
        return 'Google sign-in could not be verified. Please try again.'
      }
      return 'Google sign-in failed. Please try again.'
    }
  }, [])

  const logout = useCallback(() => {
    void unregisterPush().finally(() => {
      clearSession()
      setUser(null)
      window.location.href = '/app/login'
    })
  }, [])

  const siteId = user?.siteIds?.[0] ?? null

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, loginWithGoogle, logout, siteId }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
