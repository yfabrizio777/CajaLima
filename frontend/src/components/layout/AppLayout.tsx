import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/AuthContext'
import { formatDate } from '../../lib/locale'
import { Brand } from '../ui/Brand'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

const modules: { name: string; icon: IconName }[] = [
  { name: 'Ventas', icon: 'bag' },

  { name: 'Clientes', icon: 'people' },
  { name: 'Gastos', icon: 'receipt' },
  { name: 'Reportes', icon: 'chart' },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación principal" className="app-nav">
      <NavLink
        end
        to="/app"
        className={({ isActive }) => (isActive ? 'nav-active' : 'nav-link')}
        onClick={onNavigate}
      >
        <Icon name="home" />
        <span>Inicio</span>
      </NavLink>
      <NavLink
        to="/app/products"
        className={({ isActive }) => (isActive ? 'nav-active' : 'nav-link')}
        onClick={onNavigate}
      >
        <Icon name="box" />
        <span>Productos</span>
      </NavLink>{' '}
      {modules.map((module) => (
        <div key={module.name} className="nav-future" aria-disabled="true">
          <Icon name={module.icon} />
          <span>{module.name}</span>
          <span className="nav-soon">Próximamente</span>
        </div>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [menuOpen])
  const initials = user?.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="desktop-sidebar">
        <Link to="/app">
          <Brand />
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Icon name="bag" />
          </span>
          <div>
            <strong>Mi negocio</strong>
            <span>Mi espacio en CajaLima</span>
          </div>
        </div>
        <p className="nav-caption">TU DÍA A DÍA</p>
        <Navigation />
        <div className="sidebar-bottom">
          <p>
            Hecho para los que
            <br />
            <strong>hacen crecer su negocio.</strong>
          </p>
          <button className="signout" onClick={signOut}>
            <Icon name="logout" />
            Cerrar sesión
          </button>
          <span className="sidebar-origin">Con cariño, desde Lima.</span>
        </div>
      </aside>
      <div className="app-area">
        <header className="app-topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            Mi negocio <span>/</span>{' '}
            <strong>
              {pathname.startsWith('/app/products') ? 'Productos' : 'Inicio'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today">
              <Icon name="calendar" />
              {formatDate(new Date())}
            </span>
            <div className="user-badge">
              <span className="avatar">{initials}</span>
              <div>
                <strong>{user?.name}</strong>
                <span>
                  {user?.role === 'ADMIN' ? 'Administrador' : 'Colaborador'}
                </span>
              </div>
            </div>
          </div>
          <button
            ref={menuButton}
            className="mobile-menu-button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </header>
        {menuOpen && (
          <div id="mobile-menu" className="mobile-menu">
            <Navigation onNavigate={() => setMenuOpen(false)} />
            <button className="signout" onClick={signOut}>
              <Icon name="logout" />
              Cerrar sesión
            </button>
          </div>
        )}
        <main id="main" className="app-main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>CajaLima · Tu negocio, más claro.</span>
          <span>Hecho en Perú.</span>
        </footer>
      </div>
    </div>
  )
}
