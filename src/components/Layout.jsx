import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FlaskConical, 
  BarChart3, 
  Sparkles,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/experiments', label: '实验管理', icon: FlaskConical },
  { path: '/variants', label: 'AI变体生成', icon: Sparkles },
]

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 glass transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-700/50">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pisces-500 to-accent-purple flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-xl gradient-text">Pisces</h1>
                <p className="text-xs text-slate-400">AI驱动的A/B测试平台</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  location.pathname.startsWith(item.path)
                    ? 'bg-gradient-to-r from-pisces-600/20 to-accent-purple/20 text-white border border-pisces-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                )}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700/50">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-sm text-slate-300">系统状态</span>
              </div>
              <p className="text-xs text-slate-400">后端服务运行中</p>
              <p className="text-xs text-slate-500 mt-1">端口: 9990</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
