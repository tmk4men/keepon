import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { Capacitor } from '@capacitor/core'

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通知以外の機能は動くので握りつぶす
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
