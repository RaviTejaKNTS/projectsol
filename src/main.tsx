import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// If you placed AuthProvider at src/contexts/AuthProvider.tsx (from the auth kit), use this relative import:
import { AuthProvider } from './contexts/AuthProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
