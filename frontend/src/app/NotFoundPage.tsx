import { Link } from 'react-router'
import { Brand } from '../components/ui/Brand'
import { Icon } from '../components/ui/Icon'
import kusi from '../assets/brand/kusi-placeholder.svg'
export function NotFoundPage() {
  return (
    <div className="not-found">
      <header>
        <Link to="/">
          <Brand />
        </Link>
      </header>
      <main id="main" tabIndex={-1}>
        <img src={kusi} alt="Kusi te ayuda a volver" width="100" height="117" />
        <span className="eyebrow">PÁGINA NO ENCONTRADA · 404</span>
        <h1>Uy, por acá no era.</h1>
        <p>
          Esta página no existe o cambió de lugar.
          <br />
          Volvamos a un lugar conocido.
        </p>
        <Link className="button button-primary" to="/">
          Volver al inicio
          <Icon name="arrow" />
        </Link>
      </main>
      <footer>CajaLima · Tu negocio, más claro.</footer>
    </div>
  )
}
