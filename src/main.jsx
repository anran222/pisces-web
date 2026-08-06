import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import './index.css'

const renderApplication = async () => {
  let application = <App />

  if (import.meta.env.DEV) {
    try {
      const [{ DevSupport }, { ComponentPreviews, useInitial }] = await Promise.all([
        import('@react-buddy/ide-toolbox'),
        import('./dev/index.js'),
      ])
      application = (
        <DevSupport ComponentPreviews={ComponentPreviews} useInitialHook={useInitial}>
          {application}
        </DevSupport>
      )
    } catch (error) {
      console.warn('开发辅助工具加载失败，已使用标准模式启动', error)
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AppErrorBoundary>
        {application}
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}

renderApplication()
