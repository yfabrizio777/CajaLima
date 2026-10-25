import { Link, useSearchParams } from 'react-router'
import { SpendingList } from './SpendingList'
import { PurchasesPage } from './PurchasesPage'
export function ExpensesPage() {
  const [params] = useSearchParams(),
    purchases = params.get('tab') === 'purchases'
  return (
    <>
      <nav className="spending-tabs" aria-label="Gastos y compras">
        <Link to="/app/expenses" aria-current={!purchases ? 'page' : undefined}>
          Gastos
        </Link>
        <Link
          to="/app/expenses?tab=purchases"
          aria-current={purchases ? 'page' : undefined}
        >
          Compras
        </Link>
      </nav>
      {purchases ? (
        <PurchasesPage />
      ) : (
        <SpendingList key="expenses" kind="expenses" />
      )}
    </>
  )
}
