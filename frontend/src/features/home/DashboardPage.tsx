import { KusiNote } from '../../components/ui/KusiNote'
import { Storefront } from '../../components/ui/Storefront'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { useAuth } from '../auth/AuthContext'
import { formatMoney } from '../../lib/locale'

const metrics: { title: string; value: string; icon: IconName }[] = [
  { title: 'Ventas de hoy', value: formatMoney(0), icon: 'bag' },
  { title: 'Productos', value: '0', icon: 'box' },
  { title: 'Ventas registradas', value: '0', icon: 'receipt' },
]

export function DashboardPage() {
  const { user } = useAuth()
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
        <span>Vista inicial · Sin datos de negocio</span>
      </div>
      <section
        className="metrics-grid"
        aria-label="Resumen inicial, módulos todavía no disponibles"
      >
        {metrics.map((metric, index) => (
          <article
            className={`metric-card ${index === 0 ? 'metric-featured' : ''}`}
            key={metric.title}
          >
            <div className="metric-label">
              <h3>{metric.title}</h3>
              <span className="metric-icon">
                <Icon name={metric.icon} />
              </span>
            </div>
            <p className="metric-number">{metric.value}</p>
            <span className="metric-foot">Módulo próximamente</span>
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
              Pronto podrás agregar tus productos y registrar tus ventas.
              <br className="desktop-break" /> Aquí encontrarás un resumen claro
              de cada día.
            </p>
            <span className="future-pill">
              <Icon name="box" />
              Productos y ventas · Próximamente
            </span>
          </div>
          <div className="empty-footer">
            <Icon name="info" />
            <span>
              Este espacio aún no muestra operaciones ni importes reales.
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
                  <small>Próximamente</small>
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
            Todo negocio empieza con la primera venta. Cuando agreguemos
            productos, aquí verás cómo va tu día.
          </KusiNote>
        </aside>
      </div>
    </>
  )
}
