import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  BarChart3,
  Settings,
  Users,
  TrendingUp,
  Clock,
  Layers
} from 'lucide-react'
import { experimentAPI, analysisAPI, trafficAPI } from '../services/api'

const statusConfig = {
  RUNNING: { badge: 'badge-running', text: '运行中' },
  DRAFT: { badge: 'badge-draft', text: '草稿' },
  PAUSED: { badge: 'badge-paused', text: '已暂停' },
  STOPPED: { badge: 'badge-stopped', text: '已停止' },
}

export default function ExperimentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [mabSummary, setMabSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [expRes, statsRes] = await Promise.all([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id).catch(() => null)
      ])
      setExperiment(expRes.data)
      setStatistics(statsRes?.data)
      
      // 尝试加载MAB数据
      try {
        const mabRes = await trafficAPI.getMABSummary(id)
        setMabSummary(mabRes.data)
      } catch (e) {
        console.log('MAB data not available')
      }
    } catch (error) {
      console.error('Failed to load experiment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    try {
      switch (action) {
        case 'start':
          await experimentAPI.start(id)
          break
        case 'pause':
          await experimentAPI.pause(id)
          break
        case 'resume':
          await experimentAPI.resume(id)
          break
        case 'stop':
          await experimentAPI.stop(id)
          break
      }
      loadData()
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-slate-700/30 rounded-lg animate-shimmer" />
        <div className="h-64 bg-slate-700/30 rounded-xl animate-shimmer" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 mb-4">实验不存在</p>
        <button onClick={() => navigate('/experiments')} className="btn-primary">
          返回列表
        </button>
      </div>
    )
  }

  const status = statusConfig[experiment.status] || statusConfig.DRAFT

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/experiments')}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-white">{experiment.name}</h1>
            <span className={`badge ${status.badge}`}>{status.text}</span>
          </div>
          <p className="text-slate-400 text-sm font-mono mt-1">{experiment.id}</p>
        </div>
        <div className="flex gap-2">
          {experiment.status === 'DRAFT' && (
            <button onClick={() => handleAction('start')} className="btn-primary flex items-center gap-2">
              <Play size={16} /> 启动
            </button>
          )}
          {experiment.status === 'RUNNING' && (
            <>
              <button onClick={() => handleAction('pause')} className="btn-secondary flex items-center gap-2">
                <Pause size={16} /> 暂停
              </button>
              <button onClick={() => handleAction('stop')} className="btn-secondary flex items-center gap-2 text-red-400">
                <Square size={16} /> 停止
              </button>
            </>
          )}
          {experiment.status === 'PAUSED' && (
            <>
              <button onClick={() => handleAction('resume')} className="btn-primary flex items-center gap-2">
                <RotateCcw size={16} /> 恢复
              </button>
              <button onClick={() => handleAction('stop')} className="btn-secondary flex items-center gap-2 text-red-400">
                <Square size={16} /> 停止
              </button>
            </>
          )}
          <Link to={`/analysis/${id}`} className="btn-secondary flex items-center gap-2">
            <BarChart3 size={16} /> 详细分析
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-pisces-500/20">
              <Clock size={20} className="text-pisces-400" />
            </div>
            <span className="text-slate-400">实验时间</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">开始时间</span>
              <span className="text-white">
                {experiment.startTime ? new Date(experiment.startTime).toLocaleString() : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">结束时间</span>
              <span className="text-white">
                {experiment.endTime ? new Date(experiment.endTime).toLocaleString() : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-accent-purple/20">
              <Layers size={20} className="text-accent-purple" />
            </div>
            <span className="text-slate-400">实验组</span>
          </div>
          <div className="space-y-2">
            {experiment.groups && Object.entries(experiment.groups).map(([groupId, group]) => (
              <div key={groupId} className="flex items-center justify-between text-sm">
                <span className="text-white">{group.name || groupId}</span>
                <span className="text-slate-400">
                  {(group.trafficRatio * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Settings size={20} className="text-emerald-400" />
            </div>
            <span className="text-slate-400">流量配置</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">分配策略</span>
              <span className="text-white">{experiment.traffic?.strategy || 'HASH'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">总流量</span>
              <span className="text-white">
                {((experiment.traffic?.totalTraffic || 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {statistics && statistics.groupStatistics && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-pisces-400" />
            实时统计
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(statistics.groupStatistics).map(([groupId, stats]) => (
              <div key={groupId} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-white">{stats.groupName || groupId}</span>
                  {stats.isBaseline && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-600/50 text-slate-300">基准组</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">访客数</p>
                    <p className="text-lg font-semibold text-white">{stats.userCount?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">转化率</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {((stats.conversionRate || 0) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">点击数</p>
                    <p className="text-white">{stats.clickCount?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">转化数</p>
                    <p className="text-white">{stats.conversionCount?.toLocaleString() || 0}</p>
                  </div>
                </div>
                {stats.liftRate !== undefined && stats.liftRate !== null && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">相对提升</span>
                      <span className={stats.liftRate >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {stats.liftRate >= 0 ? '+' : ''}{(stats.liftRate * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAB Summary */}
      {mabSummary && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-accent-purple" />
            多臂老虎机算法状态
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-slate-500 text-sm">总实验次数</p>
              <p className="text-2xl font-bold text-white">{mabSummary.totalTrials?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-slate-500 text-sm">领先变体</p>
              <p className="text-2xl font-bold text-accent-purple">{mabSummary.leadingGroup || '-'}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-slate-500 text-sm">是否收敛</p>
              <p className={`text-2xl font-bold ${mabSummary.converged ? 'text-emerald-400' : 'text-amber-400'}`}>
                {mabSummary.converged ? '已收敛' : '未收敛'}
              </p>
            </div>
          </div>
          {mabSummary.recommendation && (
            <div className="p-4 rounded-xl bg-pisces-500/10 border border-pisces-500/30">
              <p className="text-pisces-400">{mabSummary.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {experiment.description && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">实验描述</h2>
          <p className="text-slate-400">{experiment.description}</p>
        </div>
      )}
    </div>
  )
}
