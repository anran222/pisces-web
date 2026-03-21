import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  FlaskConical,
  Lightbulb,
  Menu,
  Sparkles,
  X
} from 'lucide-react'
import { useMemo, useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { path: '/ai-center', label: '工作台', icon: BarChart3, description: '优先处理事项与实验进展' },
  { path: '/ai-design', label: '新建实验', icon: Lightbulb, description: '支持直接填写，也可先生成方案' },
  { path: '/experiments', label: '实验列表', icon: FlaskConical, description: '查看状态、配置与结论流转' },
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

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pageMeta = useMemo(() => matchPageMeta(location.pathname), [location.pathname])

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-900 lg:flex">
      <button
        className="fixed left-4 top-4 z-50 rounded-xl bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-[280px] border-r border-blue-100 bg-[rgba(248,251,255,0.96)] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-7">
            <Link to="/ai-center" className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-bold text-white">
                P
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pisces</p>
                <h1 className="text-2xl font-bold tracking-[-0.04em] text-slate-900">实验决策台</h1>
              </div>
            </Link>
          </div>

          <div className="px-4 py-5">
            <div className="decision-banner">
              <p className="decision-banner-label">本周重点</p>
              <p className="decision-banner-title">先处理高优先级实验</p>
              <p className="decision-banner-desc">把需要继续观察、需要处理风险、可以推进审核的实验放在一起看。</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'group flex items-start gap-3 rounded-2xl border px-4 py-4 transition-all duration-200',
                  location.pathname.startsWith(item.path)
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-transparent hover:border-slate-200 hover:bg-white'
                )}
              >
                <div
                  className={clsx(
                    'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl',
                    location.pathname.startsWith(item.path)
                      ? 'bg-blue-100 text-[var(--brand)]'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <item.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
              </Link>
            ))}
          </nav>

          <div className="border-t border-slate-200 px-4 py-4">
            <div className="shell-panel p-4">
              <p className="text-sm font-semibold text-slate-900">使用建议</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">先从工作台看优先事项，再进入对应实验查看详情和建议动作。</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="min-h-screen flex-1">
        <div className="w-full px-4 pb-10 pt-5 lg:px-6 lg:pt-5">
          <header className="mb-5 flex flex-col gap-3 rounded-[1.2rem] border border-blue-100 bg-[rgba(255,255,255,0.88)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="eyebrow mb-3">Workspace</div>
              <h2 className="page-title">{pageMeta.title}</h2>
              <p className="mt-2 max-w-3xl page-subtitle">{pageMeta.subtitle}</p>
            </div>
          </header>

          <Outlet />
        </div>
      </main>
    </div>
  )
}
