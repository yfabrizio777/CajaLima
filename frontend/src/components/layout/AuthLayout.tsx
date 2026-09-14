import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '../ui/Brand'
import { Storefront } from '../ui/Storefront'
import { Icon } from '../ui/Icon'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="auth-header">
        <Link to="/" aria-label="CajaLima, inicio">
          <Brand />
        </Link>
        <span className="brand-origin">Hecho en Lima, pensado para ti.</span>
      </header>
      <div className="auth-body">
        <section className="auth-story" aria-label="Bienvenido a CajaLima">
          <span className="eyebrow">
            <span className="accent-line" /> PARA EL NEGOCIO DE CADA DÍA
          </span>
          <h2>
            Le pones el corazón.
            <br />
            <span>Nosotros, claridad.</span>
          </h2>
          <p>
            Tu bodega, tu cafetería, tu emprendimiento.
            <br className="desktop-break" /> Un solo lugar para empezar a
            ordenar tu negocio.
          </p>
          <Storefront />
          <div className="story-footer">
            <Icon name="check" />
            <span>Un paso a la vez, con las cuentas claras.</span>
          </div>
        </section>
        <main id="main" className="auth-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <footer className="auth-footer">
        <span>CajaLima · De Lima, para tu negocio.</span>
        <span>© 2026 Fabrizio Alamo</span>
      </footer>
    </div>
  )
}
