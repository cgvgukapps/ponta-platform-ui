import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { AppProvider } from './state/app'
import { TooltipProvider } from './components/ui/overlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
