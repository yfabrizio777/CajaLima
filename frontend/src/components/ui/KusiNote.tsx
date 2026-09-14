import type { ReactNode } from 'react'
import kusi from '../../assets/brand/kusi-placeholder.svg'

export function KusiNote({ children }: { children: ReactNode }) {
  return (
    <aside className="kusi-note">
      <img
        src={kusi}
        alt="Kusi, nuestra vizcacha guía"
        width="64"
        height="75"
      />
      <div>
        <span className="kusi-label">Un consejo de Kusi</span>
        <p>{children}</p>
      </div>
    </aside>
  )
}
