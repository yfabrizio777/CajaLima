import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useProductsApi } from '../products/api'
import type { ProductSummary } from '../products/types'
import { KusiNote } from '../../components/ui/KusiNote'
import { Storefront } from '../../components/ui/Storefront'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()
  const api = useProductsApi()
  const [summary, setSummary] = useState<ProductSummary | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    api
      .summary(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setSummary(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [api])
  const metrics: {
    title: string
    value: string
    icon: IconName
    foot: string
  }[] = [
    {
      title: 'Ventas de hoy',
      value: '—',
      icon: 'bag',
      foot: 'Módulo próximamente',
    },
    {
      title: 'Productos',
      value: summary ? String(summary.activeProducts) : '—',
      icon: 'box',
      foot: summary
        ? `${summary.lowStockProducts} con poco stock · Productos activos`
        : failed
          ? 'No pudimos consultar. Revisa Productos.'
          : 'Consultando productos…',
    },
    {
      title: 'Ventas registradas',
      value: '—',
      icon: 'receipt',
      foot: 'Módulo próximamente',
    },
  ]
  const name = user?.name.split(/\s+/)[0] || 'qué gusto verte'
  return (
    <>
      <section className="dashboard-heading">
        <div>
          <span className="eyebrow">UN NUEVO COMIENZO</span>
          <h1>
            Hola, {name}
            <span className="hello-dot">.</span>
          </h1>
          <p>Tu CajaLima ya está lista. Vamos paso a paso.</p>
        </div>
        <span className="status-badge">
          <Icon name="check" />
          Tu cuenta está activa
        </span>
      </section>
      <div className="metrics-heading">
        <h2>Un vistazo a tu negocio</h2>
        <span>Productos reales · Ventas próximamente</span>
      </div>
      <section
        className="metrics-grid"
        aria-label="Resumen de productos y módulos futuros"
      >
        {metrics.map((metric, index) => (
          <article
            className={`metric-card ${index === 1 ? 'metric-featured' : ''}`}
            key={metric.title}
          >
            <div className="metric-label">
              <h3>{metric.title}</h3>
              <span className="metric-icon">
                <Icon name={metric.icon} />
              </span>
            </div>
            <p className="metric-number">{metric.value}</p>
            <span className="metric-foot">{metric.foot}</span>
          </article>
        ))}
      </section>
      <div className="dashboard-content">
        <section className="empty-panel">
          <div className="panel-heading">
            <h2>Aquí empieza tu próxima etapa</h2>
            <span className="soft-badge">Estamos construyendo</span>
          </div>
          <div className="empty-body">
            <Storefront />
            <h3>Todo listo para dar el primer paso.</h3>
            <p>
              Ya puedes organizar tus productos y sus existencias.
              <br className="desktop-break" /> Aquí encontrarás un resumen claro
              de tus próximas ventas.
            </p>
            <Link className="future-pill" to="/app/products">
              <Icon name="box" />
              Ver productos
            </Link>
          </div>
          <div className="empty-footer">
            <Icon name="info" />
            <span>
              Las ventas e importes de ventas aún no están disponibles.
            </span>
          </div>
        </section>
        <aside className="next-steps">
          <section className="steps-panel">
            <span className="eyebrow">SIN APURAR EL PASO</span>
            <h2>Vamos por partes.</h2>
            <p>Estamos preparando lo que tu negocio necesita.</p>
            <ol className="step-list">
              <li className="step-done">
                <span>
                  <Icon name="check" />
                </span>
                <div>
                  <h3>Tu cuenta, lista</h3>
                  <p>Ya tienes tu espacio en CajaLima.</p>
                  <small>Completado</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>Tus productos</h3>
                  <p>Un catálogo para tener todo a mano.</p>
                  <small>Disponible</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Tu primera venta</h3>
                  <p>Registra qué vendiste y cómo te pagaron.</p>
                  <small>Próximamente</small>
                </div>
              </li>
            </ol>
          </section>
          <KusiNote>
            Revisa tus existencias antes de empezar el día. En Productos
            encontrarás lo que necesita reposición.
          </KusiNote>
        </aside>
      </div>
    </>
  )
}
