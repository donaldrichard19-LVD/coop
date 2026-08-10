import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider'

// capture_pageview: 'history_change' is required because react-router never
// triggers a full page load, so the default posthog-js pageview (which only
// fires once on script init) would miss every client-side route change.
const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  capture_pageview: 'history_change',
  person_profiles: 'identified_only',
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PostHogProvider apiKey={import.meta.env.VITE_POSTHOG_KEY} options={posthogOptions}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </PostHogProvider>
  </StrictMode>,
)
