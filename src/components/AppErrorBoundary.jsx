import { Component } from 'react'
import { Home, RefreshCw, TriangleAlert } from 'lucide-react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('页面渲染失败', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReturnHome = () => {
    window.location.assign('/ai-center')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-5 py-10">
        <section className="w-full max-w-xl rounded-[1.4rem] border border-slate-200 bg-white p-8 shadow-[var(--surface-shadow)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <TriangleAlert size={24} />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">当前页面未能正常显示</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            页面数据或组件加载发生异常。可以重新加载当前页面，或者返回工作台继续操作。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={this.handleReload}>
              <RefreshCw size={17} />
              重新加载
            </button>
            <button type="button" className="btn-secondary" onClick={this.handleReturnHome}>
              <Home size={17} />
              返回工作台
            </button>
          </div>
        </section>
      </main>
    )
  }
}
