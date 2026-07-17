/**
 * App root — routing with auth guards.
 * base='/app/' (vite.config.ts keeps this).
 * Public routes: /login, /signup, /kit
 * Protected: /dashboard, /gateways, /alarms, /trends, /reports, /settings
 * Default '/' → /dashboard
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Gateways from './pages/Gateways'
import Alarms from './pages/Alarms'
import Trends from './pages/Trends'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
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
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/gateways" element={<RequireAuth><Gateways /></RequireAuth>} />
        <Route path="/alarms" element={<RequireAuth><Alarms /></RequireAuth>} />
        <Route path="/trends" element={<RequireAuth><Trends /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/kit" element={<KitGallery />} />
      </Routes>
    </BrowserRouter>
  )
}
