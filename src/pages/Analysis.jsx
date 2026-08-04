import { useEffect, useMemo, useRef, useState } from 'react'
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
import DataPipelineStatus from '../components/DataPipelineStatus'
import { analysisAPI, experimentAPI } from '../services/api'
import { buildGroupChartData, buildTimelineChartData } from '../utils/analysisTransformers'
import { buildDecisionWorkspaceModel } from '../utils/aiDecisionTransformers'
import { resolvePrimaryMetricDefinition } from '../utils/experimentDetailUtils'
import {
  getDecisionLabel,
  getExecutionModeLabel,
  getExperimentStatusLabel,
  getGuardrailStatusLabel,
  getMetricKeyLabel,
  getRiskFlagLabel,
  localizeSystemText,
} from '../utils/uiLabels'

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

export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)
  const [graduation, setGraduation] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [eventPipelineStatus, setEventPipelineStatus] = useState(null)
  const [eventReplayJobs, setEventReplayJobs] = useState([])
  const [eventReplayPlan, setEventReplayPlan] = useState(null)
  const [eventReplayPlanError, setEventReplayPlanError] = useState('')
  const [eventReplayPlanLoading, setEventReplayPlanLoading] = useState(false)
  const [eventPipelineError, setEventPipelineError] = useState('')
  const [eventPipelineActionLoading, setEventPipelineActionLoading] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeDecisionPanel, setActiveDecisionPanel] = useState('pipeline')
  const aiRequestIdRef = useRef(0)
  const timelineRequestIdRef = useRef(0)

  useEffect(() => {
    loadData()
  }, [id])

  const loadAiEvidence = async () => {
    const requestId = aiRequestIdRef.current + 1
    aiRequestIdRef.current = requestId

    const [diagnosisRes, graduationRes] = await Promise.allSettled([
      analysisAPI.getAIDiagnosis(id),
      analysisAPI.getAIGraduationDecision(id)
    ])

    if (requestId !== aiRequestIdRef.current) {
      return
    }

    setDiagnosis(diagnosisRes.status === 'fulfilled' ? (diagnosisRes.value.data || diagnosisRes.value) : null)
    setGraduation(graduationRes.status === 'fulfilled' ? (graduationRes.value.data || graduationRes.value) : null)
  }

  const loadTimeline = async (metricKey) => {
    const requestId = timelineRequestIdRef.current + 1
    timelineRequestIdRef.current = requestId

    const [timelineRes] = await Promise.allSettled([
      analysisAPI.getTimeline(id, metricKey, 'DAY')
    ])

    if (requestId !== timelineRequestIdRef.current) {
      return
    }

    setTimeline(timelineRes.status === 'fulfilled' ? (timelineRes.value.data || timelineRes.value) : null)
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setEventPipelineError('')
      setEventReplayPlan(null)
      setEventReplayPlanError('')
      setDiagnosis(null)
      setGraduation(null)
      const [
        experimentRes,
        statisticsRes,
        eventPipelineRes,
        eventReplayJobRes,
        comparisonRes
      ] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id),
        analysisAPI.getEventPipelineStatus(id),
        analysisAPI.listEventReplayJobs(id, 3),
        analysisAPI.compareGroups(id)
      ])

      const experimentData = experimentRes.status === 'fulfilled' ? (experimentRes.value.data || experimentRes.value) : null
      const statisticsData = statisticsRes.status === 'fulfilled' ? (statisticsRes.value.data || statisticsRes.value) : null
      const primaryMetricDefinition = resolvePrimaryMetricDefinition(experimentData, statisticsData?.summary)
      const timelineMetricKey = primaryMetricDefinition?.key || statisticsData?.summary?.primaryMetricKey || 'CONVERSION_RATE'

      setExperiment(experimentData)
      setStatistics(statisticsData)
      if (eventPipelineRes.status === 'fulfilled') {
        setEventPipelineStatus(eventPipelineRes.value.data || eventPipelineRes.value)
      } else {
        setEventPipelineStatus(null)
        setEventPipelineError(
          eventPipelineRes.reason?.response?.data?.message
            || eventPipelineRes.reason?.message
            || '事件管道状态暂不可用'
        )
      }
      setEventReplayJobs(eventReplayJobRes.status === 'fulfilled'
        ? (eventReplayJobRes.value.data || eventReplayJobRes.value || [])
        : [])
      setComparison(comparisonRes.status === 'fulfilled' ? (comparisonRes.value.data || comparisonRes.value) : null)
      setTimeline(null)
      void loadTimeline(timelineMetricKey)
    } catch (error) {
      console.error('Failed to load decision workspace:', error)
      setExperiment(null)
      setStatistics(null)
      setDiagnosis(null)
      setGraduation(null)
      setComparison(null)
      setTimeline(null)
      setEventPipelineStatus(null)
      setEventReplayJobs([])
      setEventPipelineError('事件管道状态暂不可用')
    } finally {
      setLoading(false)
    }

    void loadAiEvidence()
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
    () => buildGroupChartData(statistics, primaryMetricDefinition, comparison),
    [statistics, primaryMetricDefinition, comparison]
  )
  const timelineData = useMemo(
    () => buildTimelineChartData({
      ...timeline,
      metricDefinition: primaryMetricDefinition
    }),
    [timeline, primaryMetricDefinition]
  )
  const timelineKeys = useMemo(() => Object.keys(timelineData[0] || {}).filter(key => key !== 'time'), [timelineData])
  const primaryMetricLabel = primaryMetricDefinition?.name
    || getMetricKeyLabel(statistics?.summary?.primaryMetricKey)
  const isPrimaryMetricRate = primaryMetricDefinition?.aggregationType === 'RATE'
  const baselinePrimaryMetricValue = useMemo(() => {
    const baselineStats = Object.values(statistics?.groupStatistics || {})
      .find(groupStats => groupStats?.isBaseline)
    return baselineStats?.metricValues?.[workspaceModel.facts.primaryMetricKey] ?? null
  }, [statistics, workspaceModel.facts.primaryMetricKey])
  const primaryMetricLift = workspaceModel.facts.bestPrimaryMetricValue != null
    && baselinePrimaryMetricValue != null
    ? workspaceModel.facts.bestPrimaryMetricValue - baselinePrimaryMetricValue
    : null
  const primaryMetricLiftPercent = primaryMetricLift != null && baselinePrimaryMetricValue > 0
    ? primaryMetricLift / baselinePrimaryMetricValue
    : null
  const decisionTabs = [
    { key: 'pipeline', label: '数据链路', count: eventReplayJobs.length || 0 },
    { key: 'facts', label: '事实与动作', count: workspaceModel.actions.length },
    { key: 'timeline', label: '时间线', count: timelineData.length },
  ]

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
      alert('导出失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setExporting(false)
    }
  }

  const handleRetryDeadEvents = async () => {
    try {
      setEventPipelineActionLoading('retry')
      const response = await analysisAPI.retryDeadEvents(id)
      alert(localizeSystemText(response.message || response.data?.message || '死信事件已重新投递'))
      await loadData()
    } catch (error) {
      alert('重投死信失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handleReplayEventPipeline = async () => {
    try {
      setEventPipelineActionLoading('replay')
      const response = await analysisAPI.replayEventPipeline(id)
      alert(localizeSystemText(response.message || response.data?.message || '事件管道派生数据已重建'))
      await loadData()
    } catch (error) {
      alert('重放派生数据失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handlePlanEventReplay = async (request) => {
    try {
      setEventReplayPlanLoading(true)
      setEventReplayPlanError('')
      const response = await analysisAPI.planEventReplay(id, request)
      setEventReplayPlan(response.data || response)
    } catch (error) {
      setEventReplayPlan(null)
      setEventReplayPlanError(localizeSystemText(error.response?.data?.message || error.message || '重放计划生成失败'))
    } finally {
      setEventReplayPlanLoading(false)
    }
  }

  const handleRepairEventMaterialization = async (request = {}, segmentIndex = null) => {
    try {
      const repairingSegment = Number.isInteger(segmentIndex)
      setEventPipelineActionLoading(repairingSegment ? `repair-segment-${segmentIndex}` : 'repair-materialization')
      const response = repairingSegment
        ? await analysisAPI.repairEventMaterializationSegment(id, segmentIndex, request)
        : await analysisAPI.repairEventMaterialization(id, request)
      alert(localizeSystemText(response.message || response.data?.message || '缺失派生物化账本已修复'))
      await loadData()
    } catch (error) {
      alert('修复缺账本失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handleCancelReplayJob = async (replayJobId) => {
    try {
      setEventPipelineActionLoading('cancel-replay')
      const response = await analysisAPI.cancelEventReplayJob(id, replayJobId)
      alert(localizeSystemText(response.message || response.data?.message || '事件重放任务已取消'))
      await loadData()
    } catch (error) {
      alert('取消重放任务失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
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
            <div className="eyebrow mb-3">决策摘要</div>
            <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-slate-900">{experiment.name}</h1>
            <p className="mt-2 text-base leading-8 text-slate-600">{localizeSystemText(workspaceModel.hero.summary)}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className={`badge border ${getDecisionClassName(workspaceModel.hero.decision)}`}>
                决策 {getDecisionLabel(workspaceModel.hero.decision)}
              </span>
              <span className={`badge border ${getGuardrailClassName(workspaceModel.hero.guardrailStatus)}`}>
                护栏 {getGuardrailStatusLabel(workspaceModel.hero.guardrailStatus)}
              </span>
              <span className="badge border border-slate-200 bg-slate-50 text-slate-700">
                置信度 {workspaceModel.hero.confidence == null
                  ? '待评估'
                  : `${(workspaceModel.hero.confidence * 100).toFixed(0)}%`}
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
              <p className="signal-value text-[var(--brand)]">{localizeSystemText(workspaceModel.hero.bestGroup)}</p>
            </div>
            <div className="signal-card-tight">
              <p className="signal-label">实验状态</p>
              <p className="mt-3 text-lg font-bold text-[#9a6026]">{getExperimentStatusLabel(experiment.status)}</p>
            </div>
          </div>
        </div>
      </section>

      <nav className="rounded-[1.2rem] border border-slate-200 bg-white/85 p-2">
        <div className="flex flex-wrap gap-2">
          {decisionTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeDecisionPanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveDecisionPanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {activeDecisionPanel === 'pipeline' ? (
      <DataPipelineStatus
        statistics={statistics}
        eventPipelineStatus={eventPipelineStatus}
        eventReplayJobs={eventReplayJobs}
        eventReplayPlan={eventReplayPlan}
        eventReplayPlanError={eventReplayPlanError}
        eventReplayPlanLoading={eventReplayPlanLoading}
        eventPipelineError={eventPipelineError}
        eventPipelineActionLoading={eventPipelineActionLoading}
        onRetryDeadEvents={handleRetryDeadEvents}
        onReplayEventPipeline={handleReplayEventPipeline}
        onPlanEventReplay={handlePlanEventReplay}
        onRepairEventMaterialization={handleRepairEventMaterialization}
        onCancelReplayJob={handleCancelReplayJob}
      />
      ) : null}

      {activeDecisionPanel === 'facts' ? (
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
                  {getRiskFlagLabel(flag)}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {(workspaceModel.blockingIssues.length > 0 ? workspaceModel.blockingIssues : ['当前没有明显的阻塞项']).map(issue => (
                <div key={issue} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                  {localizeSystemText(issue)}
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
                      <h3 className="font-semibold text-slate-900">{localizeSystemText(action.title)}</h3>
                      <span className="badge border border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]">{getExecutionModeLabel(action.executionMode)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{localizeSystemText(action.action)}</p>
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
                  {primaryMetricDefinition?.name || getMetricKeyLabel(workspaceModel.facts.primaryMetricKey)}
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
                <p className="text-sm text-slate-500">对照{primaryMetricLabel}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {baselinePrimaryMetricValue != null
                    ? (isPrimaryMetricRate
                      ? `${(baselinePrimaryMetricValue * 100).toFixed(2)}%`
                      : baselinePrimaryMetricValue.toFixed(2))
                    : '-'}
                </p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">{primaryMetricLabel}提升</p>
                <p className="mt-2 text-lg font-bold text-[#1e7e57]">
                  {primaryMetricLift != null && isPrimaryMetricRate
                    ? `+${(primaryMetricLift * 100).toFixed(2)} 个百分点`
                    : '-'}
                </p>
                {primaryMetricLiftPercent != null ? (
                  <p className="mt-1 text-xs text-slate-500">相对 +{(primaryMetricLiftPercent * 100).toFixed(1)}%</p>
                ) : null}
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">最佳实验组</p>
                <p className="mt-2 text-lg font-bold text-[var(--brand)]">{localizeSystemText(workspaceModel.hero.bestGroup)}</p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">分析就绪</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{workspaceModel.facts.analysisReady ? '已就绪' : '未就绪'}</p>
            </div>
            <div className="fact-tile">
                <p className="text-sm text-slate-500">样本比例异常检测</p>
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
                    <YAxis
                      yAxisId="primaryMetric"
                      stroke="#94a3b8"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="liftRate"
                      orientation="right"
                      stroke="#4cc9f0"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        borderRadius: '16px'
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="primaryMetric"
                      dataKey="primaryMetric"
                      name={isPrimaryMetricRate ? `${primaryMetricLabel} %` : primaryMetricLabel}
                      fill="#ff8b5d"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      yAxisId="liftRate"
                      dataKey="liftRate"
                      name="提升率 %"
                      fill="#4cc9f0"
                      radius={[8, 8, 0, 0]}
                      minPointSize={6}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {activeDecisionPanel === 'timeline' ? (
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
                    name={localizeSystemText(key)}
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
      ) : null}
    </div>
  )
}
