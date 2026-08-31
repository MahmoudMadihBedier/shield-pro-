import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/application/providers/AppProviders'
import { pingAppwrite } from '@/infrastructure/appwrite/health/ping'
import { ErrorBoundary } from '@/presentation/components/ErrorBoundary'

import { App } from './App'
import './index.css'

// Confirm the Appwrite setup once at startup so the connection is verifiable
// from the console the moment the app boots (per the setup brief).
void pingAppwrite().then((result) => {
  if (result.ok) {
    console.info(
      `[appwrite] ping ok — ${Math.round(result.value.latencyMs)}ms @ ${result.value.checkedAt}`,
    )
  } else {
    console.error(`[appwrite] ping failed — ${result.error.code}: ${result.error.message}`)
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
