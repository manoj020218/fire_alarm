/**
 * App root — routing with auth guards.
 * base='/app/' (vite.config.ts keeps this).
 * Public routes: /login, /signup, /kit
 * Protected: /dashboard (redirects to /login if no token)
 * Default '/' → /dashboard
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import KitGallery from './pages/KitGallery'
import Login from './pages/Login'
import Signup from './pages/Signup'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/kit" element={<KitGallery />} />
      </Routes>
    </BrowserRouter>
  )
}
