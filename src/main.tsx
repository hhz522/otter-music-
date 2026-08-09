import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/global.css'
import RootLayout from './Layout'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeLogger } from './lib/logger'
// 导入 storage-manager 以触发启动时的迁移（Download/QingtingMusic 等）
import '@/lib/storage-manager'

initializeLogger()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootLayout>
        <App />
      </RootLayout>
    </ErrorBoundary>
  </StrictMode>,
)
