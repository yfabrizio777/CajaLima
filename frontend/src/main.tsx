import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/inter/wght.css'
import './styles/index.css'
import './styles/products.css'
import { AuthProvider } from './app/AuthProvider'
import { AppRouter } from './app/Router'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el contenedor de la aplicación.')
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
