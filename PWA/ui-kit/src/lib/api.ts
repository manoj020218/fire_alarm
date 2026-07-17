/**
 * Axios API client.
 * baseURL '/api' — same-origin relative, works at https://fireguard.iotsoft.in/app + /api.
 * Request interceptor: attaches Bearer token from localStorage.
 * Response interceptor: on 401 (non-auth URL) clears token and redirects to /app/login.
 */
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Request: attach token ─────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fg_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response: handle 401 ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.startsWith('/auth')
    ) {
      localStorage.removeItem('fg_token')
      localStorage.removeItem('fg_refresh_token')
      localStorage.removeItem('fg_user')
      window.location.href = '/app/login'
    }
    return Promise.reject(error)
  }
)
