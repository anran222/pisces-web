import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FlaskConical,
  Users,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
  Play,
  Pause,
  CheckCircle
} from 'lucide-react'
import { experimentAPI, analysisAPI } from '../services/api'
import { buildDashboardMetrics } from '../utils/experimentMetrics'

const StatCard = ({ title, value, subtitle, icon: Icon, color, delay }) => (
  <div
    className="glass-card p-6 animate-fade-in"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm mb-1">{title}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${color.includes('pisces') ? 'from-pisces-500/20 to-pisces-600/20' : 'from-accent-purple/20 to-accent-pink/20'}`}>
        <Icon size={24} className={color} />
      </div>
    </div>
  </div>
)

const ExperimentRow = ({ experiment, index }) => {
  const statusConfig = {
    RUNNING: { badge: 'badge-running', icon: Play, text: '运行中' },
    DRAFT: { badge: 'badge-draft', icon: Activity, text: '草稿' },
    PAUSED: { badge: 'badge-paused', icon: Pause, text: '已暂停' },
    STOPPED: { badge: 'badge-stopped', icon: CheckCircle, text: '已停止' }
  }

  const status = statusConfig[experiment.status] || statusConfig.DRAFT

  return (
    <Link
      to={`/experiments/${experiment.id}`}
      className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-700/30 transition-all group animate-slide-up"
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pisces-500/20 to-accent-purple/20 flex items-center justify-center">
          <FlaskConical size={20} className="text-pisces-400" />
        </div>
        <div>
          <p className="font-medium text-white group-hover:text-pisces-400 transition-colors">
            {experiment.name}
          </p>
          <p className="text-sm text-slate-500">{experiment.id}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`badge ${status.badge}`}>
          <status.icon size={12} className="mr-1 inline" />
          {status.text}
        </span>
        <ArrowRight size={16} className="text-slate-500 group-hover:text-pisces-400 transition-colors" />
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    visitors: 0,
    conversions: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await experimentAPI.list()
      const experimentList = response.data || response || []
      setExperiments(experimentList)

      const statsResults = await Promise.allSettled(
        experimentList.map(async experiment => {
          const statsResponse = await analysisAPI.getStatistics(experiment.id)
          return [experiment.id, statsResponse.data || statsResponse]
        })
      )

      const statisticsByExperiment = statsResults.reduce((accumulator, result) => {
        if (result.status === 'fulfilled') {
          const [experimentId, statistic] = result.value
          accumulator[experimentId] = statistic
        }
        return accumulator
      }, {})

      setStats(buildDashboardMetrics(experimentList, statisticsByExperiment))
    } catch (error) {
      console.error('Failed to load experiments:', error)
      setStats({ total: 0, running: 0, visitors: 0, conversions: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">仪表盘</h1>
          <p className="text-slate-400 mt-1">欢迎回来，查看您的实验概览</p>
        </div>
        <Link to="/experiments/create" className="btn-primary flex items-center gap-2">
          <Sparkles size={18} />
          创建实验
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="总实验数" value={stats.total} subtitle="所有实验" icon={FlaskConical} color="text-pisces-400" delay={0} />
        <StatCard title="运行中" value={stats.running} subtitle="正在进行" icon={Activity} color="text-emerald-400" delay={100} />
        <StatCard title="总访客数" value={stats.visitors.toLocaleString()} subtitle="真实累计参与" icon={Users} color="text-accent-purple" delay={200} />
        <StatCard title="总转化数" value={stats.conversions.toLocaleString()} subtitle="真实累计转化" icon={TrendingUp} color="text-accent-pink" delay={300} />
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">最近实验</h2>
          <Link to="/experiments" className="text-pisces-400 hover:text-pisces-300 text-sm flex items-center gap-1">
            查看全部 <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-700/30 animate-shimmer" />
            ))}
          </div>
        ) : experiments.length === 0 ? (
          <div className="text-center py-12">
            <FlaskConical size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 mb-4">还没有任何实验</p>
            <Link to="/experiments/create" className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={18} />
              创建第一个实验
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {experiments.slice(0, 5).map((experiment, index) => (
              <ExperimentRow key={experiment.id} experiment={experiment} index={index} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/variants" className="glass-card p-6 group">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-pink/20">
              <Sparkles size={24} className="text-accent-purple" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-accent-purple transition-colors">
                AI 变体生成
              </h3>
              <p className="text-slate-400 text-sm">使用 AI 智能生成实验变体</p>
            </div>
          </div>
        </Link>

        <Link to="/experiments" className="glass-card p-6 group">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-pisces-500/20 to-pisces-600/20">
              <FlaskConical size={24} className="text-pisces-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-pisces-400 transition-colors">
                实验管理
              </h3>
              <p className="text-slate-400 text-sm">查看和管理所有实验</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
