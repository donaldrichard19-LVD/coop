import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider'
import { DealsProvider } from './data/DealsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <DealsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DealsProvider>
    </ThemeProvider>
  </StrictMode>,
)
