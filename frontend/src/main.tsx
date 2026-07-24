import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AIChatProvider } from './context/AIChatContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AIChatProvider>
      <App />
    </AIChatProvider>
  </StrictMode>,
)
