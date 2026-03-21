import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Download,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { analysisAPI, experimentAPI } from '../services/api'
import { buildTimelineChartData } from '../utils/analysisTransformers'
import { buildDecisionWorkspaceModel } from '../utils/aiDecisionTransformers'
import { resolvePrimaryMetricDefinition } from '../utils/experimentDetailUtils'

const CHART_COLORS = ['#ff8b5d', '#4cc9f0', '#a78bfa', '#34d399', '#facc15']

const getDecisionClassName = (decision) => {
  if (decision === 'GRADUATE') {
    return 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
  }
  if (decision === 'ROLLBACK') {
    return 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
  }
  return 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
}

const getGuardrailClassName = (status) => {
  if (status === 'PASS') {
    return 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
  }
  if (status === 'BLOCKED') {
    return 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
  }
  return 'border-blue-200 bg-blue-50 text-[var(--brand)]'
}

const formatMetricChartValue = (value, aggregationType) => {
  const numericValue = Number(value || 0)
  if (aggregationType === 'RATE') {
    return Number((numericValue * 100).toFixed(2))
  }
  return Number(numericValue.toFixed(2))
}

const buildGroupChartData = (statistics, primaryMetricDefinition) => {
  const primaryMetricKey = primaryMetricDefinition?.key
  const aggregationType = primaryMetricDefinition?.aggregationType

  return Object.values(statistics?.groupStatistics || {}).map(group => ({
    group: group.groupName || group.groupId,
    primaryMetric: primaryMetricKey
      ? formatMetricChartValue(group.metricValues?.[primaryMetricKey], aggregationType)
      : Number(((group.conversionRate || 0) * 100).toFixed(2)),
    liftRate: Number(((group.liftRate || 0) * 100).toFixed(2)),
    visitors: group.userCount || 0
  }))
}

export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)
  const [graduation, setGraduation] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [experimentRes, statisticsRes, diagnosisRes, graduationRes] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id),
        analysisAPI.getAIDiagnosis(id),
        analysisAPI.getAIGraduationDecision(id)
      ])

      const experimentData = experimentRes.status === 'fulfilled' ? (experimentRes.value.data || experimentRes.value) : null
      const statisticsData = statisticsRes.status === 'fulfilled' ? (statisticsRes.value.data || statisticsRes.value) : null
      const primaryMetricDefinition = resolvePrimaryMetricDefinition(experimentData, statisticsData?.summary)
      const timelineMetricKey = primaryMetricDefinition?.key || statisticsData?.summary?.primaryMetricKey || 'CONVERSION_RATE'

      const timelineRes = await Promise.allSettled([
        analysisAPI.getTimeline(id, timelineMetricKey, 'DAY')
      ])

      setExperiment(experimentData)
      setStatistics(statisticsData)
      setDiagnosis(diagnosisRes.status === 'fulfilled' ? (diagnosisRes.value.data || diagnosisRes.value) : null)
      setGraduation(graduationRes.status === 'fulfilled' ? (graduationRes.value.data || graduationRes.value) : null)
      setTimeline(timelineRes[0].status === 'fulfilled' ? (timelineRes[0].value.data || timelineRes[0].value) : null)
    } catch (error) {
      console.error('Failed to load decision workspace:', error)
      setExperiment(null)
      setStatistics(null)
      setDiagnosis(null)
      setGraduation(null)
      setTimeline(null)
    } finally {
      setLoading(false)
    }
  }

  const workspaceModel = useMemo(
    () => buildDecisionWorkspaceModel({ statistics, diagnosis, graduation }),
    [statistics, diagnosis, graduation]
  )
  const primaryMetricDefinition = useMemo(
    () => resolvePrimaryMetricDefinition(experiment, statistics?.summary),
    [experiment, statistics?.summary]
  )
  const groupChartData = useMemo(
    () => buildGroupChartData(statistics, primaryMetricDefinition),
    [statistics, primaryMetricDefinition]
  )
  const timelineData = useMemo(
    () => buildTimelineChartData({
      ...timeline,
      metricDefinition: primaryMetricDefinition
    }),
    [timeline, primaryMetricDefinition]
  )
  const timelineKeys = useMemo(() => Object.keys(timelineData[0] || {}).filter(key => key !== 'time'), [timelineData])
  const primaryMetricLabel = primaryMetricDefinition?.name || statistics?.summary?.primaryMetricKey || '主要指标'
  const isPrimaryMetricRate = primaryMetricDefinition?.aggregationType === 'RATE'

  const exportReport = async () => {
    try {
      setExporting(true)
      const result = await analysisAPI.exportReport(id)
      const report = result.data || result
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `decision-workspace-${id}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('导出失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-[1.2rem] bg-slate-200/60 animate-shimmer" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-64 rounded-[1.2rem] bg-slate-200/60 animate-shimmer" />
          ))}
        </div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="text-xl font-semibold text-slate-900">实验不存在或数据暂不可用</p>
        <button onClick={() => navigate('/experiments')} className="btn-primary mt-4">
          返回实验工作台
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => navigate(`/experiments/${id}`)} className="btn-secondary">
          <ArrowLeft size={18} />
          返回实验详情
        </button>
        <div className="flex flex-wrap gap-3">
          <button onClick={loadData} className="btn-secondary">
            <Sparkles size={18} />
            刷新结果
          </button>
          <button onClick={exportReport} disabled={exporting} className="btn-primary">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            导出决策报告
          </button>
        </div>
      </div>

      <section className="glass-card p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="eyebrow mb-3">Summary</div>
            <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-slate-900">{experiment.name}</h1>
            <p className="mt-2 text-base leading-8 text-slate-600">{workspaceModel.hero.summary}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className={`badge border ${getDecisionClassName(workspaceModel.hero.decision)}`}>
                决策 {workspaceModel.hero.decision}
              </span>
              <span className={`badge border ${getGuardrailClassName(workspaceModel.hero.guardrailStatus)}`}>
                护栏 {workspaceModel.hero.guardrailStatus}
              </span>
              <span className="badge border border-slate-200 bg-slate-50 text-slate-700">
                置信度 {(workspaceModel.hero.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:w-[620px]">
            <div className="signal-card-tight">
              <p className="signal-label">总访客</p>
              <p className="signal-value">{workspaceModel.hero.totalVisitors.toLocaleString()}</p>
            </div>
            <div className="signal-card-tight">
              <p className="signal-label">最佳实验组</p>
              <p className="signal-value text-[var(--brand)]">{workspaceModel.hero.bestGroup}</p>
            </div>
            <div className="signal-card-tight">
              <p className="signal-label">实验状态</p>
              <p className="mt-3 text-lg font-bold text-[#9a6026]">{experiment.status}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <ShieldAlert size={18} className="text-[#b44f42]" />
              <div>
                <h2 className="section-title">风险与护栏</h2>
                <p className="section-meta">先处理阻塞条件，再决定毕业或继续加流量。</p>
              </div>
            </div>
            <div className="risk-strip">
              {(workspaceModel.riskFlags.length > 0 ? workspaceModel.riskFlags : ['暂无风险标记']).map(flag => (
                <span key={flag} className="risk-chip">
                  <AlertTriangle size={14} />
                  {flag}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {(workspaceModel.blockingIssues.length > 0 ? workspaceModel.blockingIssues : ['当前没有明显的阻塞项']).map(issue => (
                <div key={issue} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                  {issue}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <BrainCircuit size={18} className="text-[var(--brand)]" />
              <div>
                <h2 className="section-title">建议动作</h2>
                <p className="section-meta">动作只给建议，不会自动执行。</p>
              </div>
            </div>
            <div className="space-y-4">
              {workspaceModel.actions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">当前没有额外推荐动作。</div>
              ) : (
                workspaceModel.actions.map(action => (
                  <div key={action.title + action.action} className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{action.title}</h3>
                      <span className="badge border border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]">{action.executionMode}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{action.action}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-5 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-[#1e7e57]" />
            <div>
              <h2 className="section-title">事实层摘要</h2>
              <p className="section-meta">把结论和统计事实放在一起，方便交叉判断。</p>
            </div>
          </div>
          <div className="fact-grid md:grid-cols-2">
            <div className="fact-tile">
                <p className="text-sm text-slate-500">主要指标</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {primaryMetricDefinition?.name || workspaceModel.facts.primaryMetricKey}
                </p>
                {primaryMetricDefinition?.key ? (
                  <p className="mt-1 text-xs text-slate-500">{primaryMetricDefinition.key}</p>
                ) : null}
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">最佳{primaryMetricLabel}</p>
                <p className="mt-2 text-lg font-bold text-[var(--brand)]">
                  {workspaceModel.facts.bestPrimaryMetricValue != null
                    ? (isPrimaryMetricRate
                      ? `${(workspaceModel.facts.bestPrimaryMetricValue * 100).toFixed(2)}%`
                      : workspaceModel.facts.bestPrimaryMetricValue.toFixed(2))
                    : '-'}
                </p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">最佳实验组</p>
                <p className="mt-2 text-lg font-bold text-[var(--brand)]">{workspaceModel.hero.bestGroup}</p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">分析就绪</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{workspaceModel.facts.analysisReady ? '已就绪' : '未就绪'}</p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">SRM 检测</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{workspaceModel.facts.srmDetected ? '已发现' : '未发现'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <BarChart3 size={18} className="text-[#9a6026]" />
              <h3 className="font-semibold text-slate-900">组间指标对比</h3>
            </div>
            {groupChartData.length === 0 ? (
              <p className="text-sm text-slate-400">暂无组间统计数据</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="group" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        borderRadius: '16px'
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="primaryMetric"
                      name={isPrimaryMetricRate ? `${primaryMetricLabel} %` : primaryMetricLabel}
                      fill="#ff8b5d"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar dataKey="liftRate" name="提升率 %" fill="#4cc9f0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
            <TrendingUp size={18} className="text-[var(--brand)]" />
            <div>
              <h2 className="section-title">时间线证据</h2>
              <p className="section-meta">围绕当前实验的主要指标查看时间序列走势。</p>
            </div>
          </div>
          <Link to={`/experiments/${id}`} className="btn-secondary">
            返回实验配置
          </Link>
        </div>

        {timelineData.length === 0 ? (
          <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-400">暂无时间线数据</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    borderRadius: '16px'
                  }}
                />
                <Legend />
                {timelineKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
