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
  TrendingUp,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react'
import { experimentAPI, analysisAPI, trafficAPI } from '../services/api'

const statusConfig = {
  RUNNING: { badge: 'badge-running', text: '运行中' },
  DRAFT: { badge: 'badge-draft', text: '草稿' },
  PAUSED: { badge: 'badge-paused', text: '已暂停' },
  STOPPED: { badge: 'badge-stopped', text: '已停止' }
}

const conclusionStatusConfig = {
  NOT_READY: {
    label: '未就绪',
    className: 'bg-slate-500/15 text-slate-200 border-slate-500/20',
  },
  RUNNING: {
    label: '运行中',
    className: 'bg-blue-500/15 text-blue-200 border-blue-400/20',
  },
  READY_FOR_REVIEW: {
    label: '待审核',
    className: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  },
  GRADUATED: {
    label: '已毕业',
    className: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  },
  REJECTED: {
    label: '已拒绝',
    className: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  },
}

const getAllowedConclusionStatuses = (status) => {
  switch (status) {
    case 'NOT_READY':
      return ['RUNNING']
    case 'RUNNING':
      return ['READY_FOR_REVIEW']
    case 'READY_FOR_REVIEW':
      return ['GRADUATED', 'REJECTED']
    default:
      return []
  }
}

const formatConfigValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export default function ExperimentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [mabSummary, setMabSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [conclusionStatusDraft, setConclusionStatusDraft] = useState('')
  const [conclusionSaving, setConclusionSaving] = useState(false)
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      setStatsError('')

      const [expRes, statsRes] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id)
      ])

      if (expRes.status === 'fulfilled') {
        const expData = expRes.value.data || expRes.value
        setExperiment(expData)
        const candidateStatuses = getAllowedConclusionStatuses(expData?.conclusionStatus)
        setConclusionStatusDraft(candidateStatuses[0] || '')
      } else {
        throw expRes.reason
      }

      if (statsRes.status === 'fulfilled') {
        setStatistics(statsRes.value.data || statsRes.value)
      } else {
        setStatistics(null)
        setStatsError(statsRes.reason?.response?.data?.message || statsRes.reason?.message || '暂无统计数据')
      }

      try {
        const mabRes = await trafficAPI.getMABSummary(id)
        setMabSummary(mabRes.data || mabRes)
      } catch (error) {
        console.log('MAB data not available')
        setMabSummary(null)
      }
    } catch (error) {
      console.error('Failed to load experiment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    try {
      setActionLoading(true)
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
      await loadData()
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateData = async () => {
    try {
      setActionLoading(true)
      const response = await experimentAPI.simulateData(id, {
        visitorCount: 150,
        daysAgo: 7
      })
      alert(response.message || '实验数据生成完成')
      await loadData()
    } catch (error) {
      alert('生成实验数据失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const handleConclusionStatusUpdate = async () => {
    if (!conclusionStatusDraft) {
      return
    }

    try {
      setConclusionSaving(true)
      await experimentAPI.updateConclusionStatus(id, conclusionStatusDraft, 'frontend')
      await loadData()
    } catch (error) {
      alert('更新结论状态失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setConclusionSaving(false)
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
  const currentConclusionStatus = experiment.conclusionStatus || 'NOT_READY'
  const suggestedConclusionStatus = experiment.suggestedConclusionStatus || '-'
  const allowedConclusionStatuses = getAllowedConclusionStatuses(currentConclusionStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/experiments')}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{experiment.name}</h1>
            <span className={`badge ${status.badge}`}>{status.text}</span>
          </div>
          <p className="page-subtitle font-mono mt-2">{experiment.id}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {experiment.status === 'DRAFT' && (
            <button disabled={actionLoading} onClick={() => handleAction('start')} className="btn-primary flex items-center gap-2 disabled:opacity-60">
              <Play size={16} /> 启动
            </button>
          )}
          {experiment.status === 'RUNNING' && (
            <>
              <button disabled={actionLoading} onClick={() => handleAction('pause')} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
                <Pause size={16} /> 暂停
              </button>
              <button disabled={actionLoading} onClick={() => handleAction('stop')} className="btn-secondary flex items-center gap-2 text-red-400 disabled:opacity-60">
                <Square size={16} /> 停止
              </button>
            </>
          )}
          {experiment.status === 'PAUSED' && (
            <>
              <button disabled={actionLoading} onClick={() => handleAction('resume')} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                <RotateCcw size={16} /> 恢复
              </button>
              <button disabled={actionLoading} onClick={() => handleAction('stop')} className="btn-secondary flex items-center gap-2 text-red-400 disabled:opacity-60">
                <Square size={16} /> 停止
              </button>
            </>
          )}
          <button disabled={actionLoading} onClick={handleGenerateData} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
            <Sparkles size={16} /> 生成实验数据
          </button>
          <Link to={`/analysis/${id}`} className="btn-secondary flex items-center gap-2">
            <BarChart3 size={16} /> 详细分析
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-pisces-500/20">
              <Clock size={20} className="text-pisces-400" />
            </div>
            <span className="text-slate-400">实验时间</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">开始时间</span>
              <span className="text-white text-right">
                {experiment.startTime ? new Date(experiment.startTime).toLocaleString() : '-'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">结束时间</span>
              <span className="text-white text-right">
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
          <div className="space-y-3">
            {experiment.groups && Object.entries(experiment.groups).map(([groupId, group]) => (
              <div key={groupId} className="rounded-xl border border-white/5 bg-slate-800/40 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-white font-medium">{group.name || groupId}</span>
                  <span className="text-slate-400">{((group.trafficRatio || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {group.config && Object.keys(group.config).length > 0 ? (
                    Object.entries(group.config).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-slate-950/40 border border-white/5 px-3 py-2">
                        <p className="text-slate-500 mb-1">{key}</p>
                        <p className="text-slate-100 break-words">{formatConfigValue(value)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-sm">暂无变体参数</div>
                  )}
                </div>
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
              <span className="text-white">{((experiment.traffic?.totalTraffic || 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">结论状态</h2>
              <span className={`badge border ${conclusionStatusConfig[currentConclusionStatus]?.className || conclusionStatusConfig.NOT_READY.className}`}>
                {conclusionStatusConfig[currentConclusionStatus]?.label || currentConclusionStatus}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
                <p className="text-slate-500 mb-1">当前人工状态</p>
                <p className="text-white font-medium">
                  {conclusionStatusConfig[currentConclusionStatus]?.label || currentConclusionStatus}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.conclusionUpdatedAt ? new Date(experiment.conclusionUpdatedAt).toLocaleString() : '暂无更新时间'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
                <p className="text-slate-500 mb-1">系统建议状态</p>
                <p className="text-white font-medium">
                  {suggestedConclusionStatus !== '-' 
                    ? (conclusionStatusConfig[suggestedConclusionStatus]?.label || suggestedConclusionStatus)
                    : '-'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.suggestedConclusionUpdatedAt ? new Date(experiment.suggestedConclusionUpdatedAt).toLocaleString() : '暂无建议更新时间'}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-[280px] w-full lg:w-80">
            <label className="block text-sm text-slate-400 mb-2">更新人工结论状态</label>
            <select
              className="input mb-3"
              value={conclusionStatusDraft}
              onChange={(e) => setConclusionStatusDraft(e.target.value)}
              disabled={allowedConclusionStatuses.length === 0}
            >
              {allowedConclusionStatuses.length === 0 ? (
                <option value="">当前状态不可继续迁移</option>
              ) : (
                allowedConclusionStatuses.map(statusKey => (
                  <option key={statusKey} value={statusKey}>
                    {conclusionStatusConfig[statusKey]?.label || statusKey}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={conclusionSaving || !conclusionStatusDraft}
              onClick={handleConclusionStatusUpdate}
              className="btn-primary w-full disabled:opacity-60"
            >
              {conclusionSaving ? '保存中...' : '保存结论状态'}
            </button>
            <p className="text-xs text-slate-500 mt-2 leading-5">
              仅允许按状态机流转，不会自动回写为快照结论。
            </p>
          </div>
        </div>
      </div>

      {statistics?.groupStatistics ? (
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
                    <p className="text-lg font-semibold text-emerald-400">{((stats.conversionRate || 0) * 100).toFixed(2)}%</p>
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
      ) : (
        <div className="glass-card p-8 text-center">
          <Sparkles size={40} className="mx-auto text-slate-600 mb-4" />
          <p className="text-white font-medium mb-2">还没有真实统计数据</p>
          <p className="text-slate-400 text-sm mb-4">{statsError || '先生成实验数据，再查看实验表现。'}</p>
          <button disabled={actionLoading} onClick={handleGenerateData} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
            <Sparkles size={16} /> 立即生成数据
          </button>
        </div>
      )}

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

      {experiment.description && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">实验描述</h2>
          <p className="text-slate-400">{experiment.description}</p>
        </div>
      )}
    </div>
  )
}
