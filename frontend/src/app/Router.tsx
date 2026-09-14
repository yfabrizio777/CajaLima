import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { SetupPage } from '../features/auth/pages/SetupPage'
import { DashboardPage } from '../features/home/DashboardPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { NotFoundPage } from './NotFoundPage'

function PrivateRoute() {
  return useAuth().user ? <Outlet /> : <Navigate to="/login" replace />
}

export function AppRouter() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/setup': 'Configuremos CajaLima',
      '/login': 'Ingresar',
      '/app': 'Inicio',
      '/app/products': 'Productos',
    }
    document.title = `${titles[pathname] || 'CajaLima'} · Tu negocio, más claro.`
    document.getElementById('main')?.focus()
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
        </Route>
        <Route path="/app/*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
