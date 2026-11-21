import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { account } = useApp()
  const location = useLocation()
  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { account } = useApp()
  const location = useLocation()
  if (!account) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (account.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
