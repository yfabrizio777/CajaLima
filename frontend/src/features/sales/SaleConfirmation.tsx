import { Dialog } from '../../components/ui/Dialog'
import { KusiNote } from '../../components/ui/KusiNote'
import { SaleDetail } from './SaleDetail'
import type { Sale } from './types'
export function SaleConfirmation({
  sale,
  onClose,
}: {
  sale: Sale
  onClose: () => void
}) {
  return (
    <Dialog title="Venta registrada" onClose={onClose}>
      <SaleDetail sale={sale} />
      <KusiNote>¡Listo! La venta ya quedó registrada.</KusiNote>
      <button
        className="button button-primary confirmation-close"
        onClick={onClose}
      >
        Nueva venta
      </button>
    </Dialog>
  )
}
