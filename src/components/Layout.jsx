import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  FlaskConical,
  Lightbulb,
  Menu,
  Sparkles,
  X
} from 'lucide-react'
import { Suspense, useMemo, useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { path: '/ai-center', label: '工作台', icon: BarChart3, description: '优先处理事项与实验进展' },
  { path: '/ai-design', label: '新建实验', icon: Lightbulb, description: '支持直接填写，也可先生成方案' },
  { path: '/experiments', label: '实验列表', icon: FlaskConical, description: '查看状态、配置与结论流转' },
  { path: '/applications', label: '应用管理', icon: Building2, description: '管理应用、配额与审批策略' },
  { path: '/variants-lab', label: '生成方案', icon: Sparkles, description: '生成文案和图片候选方案' },
]

const pageMap = {
  '/ai-center': {
    title: '工作台',
    subtitle: '先看需要关注的实验，再决定下一步推进动作。'
  },
  '/ai-design': {
    title: '新建实验',
    subtitle: '支持直接填写实验配置，也可以先生成方案后再调整。'
  },
  '/experiments': {
    title: '实验列表',
    subtitle: '集中查看实验进展、结论状态和后续处理入口。'
  },
  '/applications': {
    title: '应用管理',
    subtitle: '集中管理应用归属、实验额度和配置/启动审批策略。'
  },
  '/variants-lab': {
    title: '生成方案',
    subtitle: '围绕明确目标生成可进入实验的候选文案与图片。'
  }
}

const matchPageMeta = (pathname) => {
  if (pathname.startsWith('/experiments/') && pathname.endsWith('/decision')) {
    return {
      title: '实验分析',
      subtitle: '查看当前表现、风险提示和建议动作。'
    }
  }
  if (pathname.startsWith('/experiments/')) {
    return {
      title: '实验详情',
      subtitle: '查看实验配置、运行状态和下一步入口。'
    }
  }
  return pageMap[pathname] || pageMap['/ai-center']
}

const RouteLoading = () => (
  <div className="space-y-5" role="status" aria-label="正在加载页面">
    <div className="h-28 rounded-[1.2rem] border border-slate-200 bg-white/80 animate-pulse" />
    <div className="grid gap-5 lg:grid-cols-3">
      {[1, 2, 3].map(item => (
        <div key={item} className="h-32 rounded-[1.2rem] border border-slate-200 bg-white/80 animate-pulse" />
      ))}
    </div>
    <div className="h-72 rounded-[1.2rem] border border-slate-200 bg-white/80 animate-pulse" />
  </div>
)

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pageMeta = useMemo(() => matchPageMeta(location.pathname), [location.pathname])

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-900 lg:flex">
      <button
        className="fixed left-4 top-4 z-50 rounded-xl bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? '关闭导航' : '打开导航'}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-[236px] border-r border-blue-100 bg-[rgba(248,251,255,0.96)] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <Link to="/ai-center" className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-base font-bold text-white">
                P
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pisces</p>
                <h1 className="text-xl font-bold tracking-[-0.04em] text-slate-900">实验决策台</h1>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                title={item.description}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-200',
                  location.pathname.startsWith(item.path)
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-transparent hover:border-slate-200 hover:bg-white'
                )}
              >
                <div
                  className={clsx(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                    location.pathname.startsWith(item.path)
                      ? 'bg-blue-100 text-[var(--brand)]'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <item.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="min-h-screen flex-1">
        <div className="w-full px-4 pb-8 pt-5 lg:px-6">
          <header className="mb-4 flex flex-col gap-2 rounded-[1.2rem] border border-blue-100 bg-[rgba(255,255,255,0.88)] px-4 py-3 lg:hidden">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-900">{pageMeta.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{pageMeta.subtitle}</p>
            </div>
          </header>

          <Suspense fallback={<RouteLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
