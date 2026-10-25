import { useEffect, useRef, useId } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="product-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Cerrar formulario"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  )
}
