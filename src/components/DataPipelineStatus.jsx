import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  StopCircle
} from 'lucide-react'
import { buildDataPipelineStatus } from '../utils/dataPipelineStatus'
import {
  buildEventReplayPlanRequest,
  buildReplayPlanGroupRows,
  buildReplayPlanSegmentRows,
  calculateReplayJobProgress,
  calculateReplayPlanMaterializationCoverage,
  getReplayEventTypesLabel,
  getReplayFactScopeLabel,
  getReplayModeLabel,
  getReplayPlanModeLabel
} from '../utils/eventReplayPlan'
import { localizeSystemText } from '../utils/uiLabels'

const stageIconMap = {
  assignment: GitBranch,
  exposure: Eye,
  event: Activity,
  analysis: CheckCircle2
}

const statusConfig = {
  ready: {
    label: '正常',
    className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]',
    iconClassName: 'bg-[#f6fbf8] text-[#1e7e57]'
  },
  warning: {
    label: '待补齐',
    className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]',
    iconClassName: 'bg-[#fff8ef] text-[#9a6026]'
  },
  blocked: {
    label: '阻塞',
    className: 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]',
    iconClassName: 'bg-[#fff7f5] text-[#b44f42]'
  },
  unavailable: {
    label: '暂无数据',
    className: 'border-slate-200 bg-slate-50 text-slate-500',
    iconClassName: 'bg-slate-100 text-slate-500'
  }
}

const replayJobStatusConfig = {
  RUNNING: {
    label: '运行中',
    uiStatus: 'warning'
  },
  CANCEL_REQUESTED: {
    label: '取消中',
    uiStatus: 'warning'
  },
  SUCCEEDED: {
    label: '成功',
    uiStatus: 'ready'
  },
  FAILED: {
    label: '失败',
    uiStatus: 'blocked'
  },
  CANCELLED: {
    label: '已取消',
    uiStatus: 'unavailable'
  }
}

const formatCount = (value) => Number(value || 0).toLocaleString()

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }
  return String(value).replace('T', ' ').slice(0, 19)
}

export default function DataPipelineStatus({
  statistics,
  statsError = '',
  eventPipelineStatus = null,
  eventReplayJobs = [],
  eventReplayPlan = null,
  eventReplayPlanError = '',
  eventReplayPlanLoading = false,
  eventPipelineError = '',
  eventPipelineActionLoading = '',
  onRetryDeadEvents = null,
  onReplayEventPipeline = null,
  onPlanEventReplay = null,
  onRepairEventMaterialization = null,
  onCancelReplayJob = null,
  className = ''
}) {
  const [activePanel, setActivePanel] = useState('inbox')
  const [replayPlanDraft, setReplayPlanDraft] = useState({
    startTime: '',
    endTime: '',
    eventTypesText: '',
    includeEvents: true,
    includeExposures: true,
    segmentCount: 4
  })
  const pipeline = buildDataPipelineStatus(statistics, eventPipelineStatus)
  const wrapperClassName = ['glass-card p-6', className].filter(Boolean).join(' ')
  const headerStatus = pipeline.hasStatistics
    ? (pipeline.analysisReady ? statusConfig.ready : statusConfig.blocked)
    : statusConfig.unavailable
  const eventPipelineStatusConfig = statusConfig[pipeline.eventPipeline.uiStatus] || statusConfig.unavailable
  const latestReplayJob = Array.isArray(eventReplayJobs) ? eventReplayJobs[0] : null
  const latestReplayStatus = replayJobStatusConfig[latestReplayJob?.jobStatus]
    || { label: latestReplayJob?.jobStatus ? '未知任务状态' : '未知', uiStatus: 'unavailable' }
  const latestReplayStatusConfig = statusConfig[latestReplayStatus.uiStatus] || statusConfig.unavailable
  const latestReplayModeLabel = getReplayModeLabel(latestReplayJob)
  const latestReplayFactScopeLabel = getReplayFactScopeLabel(latestReplayJob)
  const latestReplayEventTypesLabel = getReplayEventTypesLabel(latestReplayJob)
  const latestReplayProgress = calculateReplayJobProgress(latestReplayJob)
  const showCancelLatestReplayJob = Boolean(onCancelReplayJob)
    && latestReplayJob?.jobStatus === 'RUNNING'
    && Boolean(latestReplayJob?.replayJobId)
  const cancelReplayJobDisabled = eventPipelineActionLoading !== ''
  const replayPlanGroupRows = buildReplayPlanGroupRows(eventReplayPlan)
  const replayPlanSegmentRows = buildReplayPlanSegmentRows(eventReplayPlan)
  const replayPlanMaterialization = calculateReplayPlanMaterializationCoverage(eventReplayPlan)
  const replayPlanModeLabel = getReplayPlanModeLabel(eventReplayPlan)
  const replayPlanStatusConfig = eventReplayPlan?.fullDerivedReplay
    ? statusConfig.ready
    : statusConfig.warning
  const canRepairReplayPlan = Boolean(onRepairEventMaterialization)
    && Boolean(eventReplayPlan)
    && replayPlanMaterialization.unmaterializedCount > 0
  const replayPlanDisabled = eventReplayPlanLoading
    || eventPipelineActionLoading !== ''
    || (!replayPlanDraft.includeEvents && !replayPlanDraft.includeExposures)
  const issueCount = pipeline.blockingIssues.length + pipeline.warnings.length
  const panelTabs = [
    { key: 'inbox', label: '收件箱', count: pipeline.eventPipeline.totalCount },
    { key: 'replay', label: '重放任务', count: latestReplayJob ? 1 : 0 },
    { key: 'plan', label: '生成计划', count: eventReplayPlan ? replayPlanMaterialization.unmaterializedCount : null },
    { key: 'groups', label: '分组明细', count: pipeline.groups.length },
    { key: 'issues', label: '问题', count: issueCount },
  ]

  const updateReplayPlanDraft = (field, value) => {
    setReplayPlanDraft(current => ({
      ...current,
      [field]: value
    }))
  }

  const handleReplayPlanSubmit = () => {
    if (!onPlanEventReplay || replayPlanDisabled) {
      return
    }
    onPlanEventReplay(buildEventReplayPlanRequest(replayPlanDraft))
  }

  const handleRepairEventMaterialization = () => {
    if (!canRepairReplayPlan || eventPipelineActionLoading !== '') {
      return
    }
    onRepairEventMaterialization(buildEventReplayPlanRequest(replayPlanDraft))
  }

  const handleRepairReplaySegment = (segmentIndex) => {
    if (!onRepairEventMaterialization || eventPipelineActionLoading !== '') {
      return
    }
    onRepairEventMaterialization(buildEventReplayPlanRequest(replayPlanDraft), segmentIndex)
  }

  const handleCancelReplayJob = () => {
    if (!showCancelLatestReplayJob || cancelReplayJobDisabled) {
      return
    }
    onCancelReplayJob(latestReplayJob.replayJobId)
  }

  return (
    <section className={wrapperClassName}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
            <GitBranch size={20} />
          </div>
          <div>
            <h2 className="section-title">数据链路状态</h2>
            <p className="section-meta">分流、曝光、事件、分析门禁和异步消费来自当前实验数据。</p>
          </div>
        </div>
        <span className={`badge border ${headerStatus.className}`}>
          {pipeline.hasStatistics
            ? (pipeline.analysisReady ? '分析已就绪' : '分析未就绪')
            : '暂无统计'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pipeline.stages.map((stage) => {
          const StageIcon = stageIconMap[stage.key] || Activity
          const stageStatus = statusConfig[stage.status] || statusConfig.unavailable

          return (
            <div key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-xl p-2 ${stageStatus.iconClassName}`}>
                  <StageIcon size={18} />
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${stageStatus.className}`}>
                  {stageStatus.label}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-500">{stage.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stage.value}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {panelTabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              activePanel === tab.key
                ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setActivePanel(tab.key)}
          >
            {tab.label}
            {tab.count !== null ? (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {formatCount(tab.count)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="max-h-[62vh] overflow-y-auto pr-1">
      {activePanel === 'inbox' ? (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${eventPipelineStatusConfig.iconClassName}`}>
              <Activity size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">事件收件箱</p>
              <p className="mt-1 text-xs text-slate-500">
                状态 {pipeline.eventPipeline.label}
                {eventPipelineError ? ` · ${localizeSystemText(eventPipelineError)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${eventPipelineStatusConfig.className}`}>
              {pipeline.eventPipeline.label}
            </span>
            {onRetryDeadEvents ? (
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
                onClick={onRetryDeadEvents}
                disabled={eventPipelineActionLoading !== '' || pipeline.eventPipeline.deadCount <= 0}
                title="重新投递死信记录"
              >
                <RotateCcw size={14} />
                重投死信
              </button>
            ) : null}
            {onReplayEventPipeline ? (
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
                onClick={onReplayEventPipeline}
                disabled={eventPipelineActionLoading !== '' || pipeline.eventPipeline.totalCount <= 0}
                title="按事实表重建派生数据"
              >
                <RefreshCw
                  size={14}
                  className={eventPipelineActionLoading === 'replay' ? 'animate-spin' : ''}
                />
                重放派生
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">总量</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(pipeline.eventPipeline.totalCount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">完成</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(pipeline.eventPipeline.doneCount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">待处理</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(pipeline.eventPipeline.unfinishedCount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">重试</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(pipeline.eventPipeline.retryCount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">死信</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(pipeline.eventPipeline.deadCount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">最大积压</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{pipeline.eventPipeline.maxPendingLabel}</p>
          </div>
        </div>
      </div>
      ) : null}

      {activePanel === 'replay' ? (
        latestReplayJob ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">最近重放任务</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {latestReplayJob.replayJobId || '-'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${latestReplayStatusConfig.className}`}>
                  {latestReplayStatus.label}
                </span>
                {showCancelLatestReplayJob ? (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={handleCancelReplayJob}
                    disabled={cancelReplayJobDisabled}
                    title="取消运行中的重放任务"
                  >
                    {eventPipelineActionLoading === 'cancel-replay' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <StopCircle size={14} />
                    )}
                    取消
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  处理进度 {latestReplayProgress.progressPercent}%
                </p>
                <p className="text-xs text-slate-500">
                  已处理 {formatCount(latestReplayProgress.processedCount)} / 计划 {formatCount(latestReplayProgress.plannedCount)}
                  ，剩余 {formatCount(latestReplayProgress.remainingCount)}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${latestReplayProgress.progressPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <p className="text-xs text-slate-500">模式</p>
                <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-900">
                  {latestReplayModeLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">影响记录</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCount(latestReplayJob.affectedCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">事件 / 曝光</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCount(latestReplayJob.eventCount)} / {formatCount(latestReplayJob.exposureCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">动态分流奖励</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCount(latestReplayJob.mabRewardCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">事实范围</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {latestReplayFactScopeLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">事件类型</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={latestReplayEventTypesLabel}>
                  {latestReplayEventTypesLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">开始时间</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(latestReplayJob.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">结束时间</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(latestReplayJob.finishedAt)}
                </p>
              </div>
            </div>
            {(latestReplayJob.scopeStartTime || latestReplayJob.scopeEndTime) ? (
              <p className="mt-3 text-xs text-slate-500">
                重放范围：{formatDateTime(latestReplayJob.scopeStartTime)} 至 {formatDateTime(latestReplayJob.scopeEndTime)}
              </p>
            ) : null}
            {latestReplayJob.errorMessage ? (
              <p className="mt-3 rounded-lg border border-[#e7c8c4] bg-[#fff7f5] px-3 py-2 text-xs leading-5 text-[#8f3c31]">
                  {localizeSystemText(latestReplayJob.errorMessage)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前没有重放任务。
          </div>
        )
      ) : null}

      {activePanel === 'plan' ? (
        onPlanEventReplay ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">重放计划</p>
                  <p className="mt-1 text-xs text-slate-500">先计算影响面，再执行派生重建。</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary w-fit px-3 py-2 text-xs disabled:opacity-50"
                onClick={handleReplayPlanSubmit}
                disabled={replayPlanDisabled}
                title="生成只读重放计划"
              >
                {eventReplayPlanLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                生成计划
              </button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_0.7fr_auto]">
              <label className="block text-xs font-semibold text-slate-500">
                开始时间
                <input
                  type="datetime-local"
                  className="input mt-2 h-10 px-3 py-2 text-sm"
                  value={replayPlanDraft.startTime}
                  onChange={event => updateReplayPlanDraft('startTime', event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                结束时间
                <input
                  type="datetime-local"
                  className="input mt-2 h-10 px-3 py-2 text-sm"
                  value={replayPlanDraft.endTime}
                  onChange={event => updateReplayPlanDraft('endTime', event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                事件类型
                <input
                  className="input mt-2 h-10 px-3 py-2 text-sm"
                  placeholder="输入事件标识，使用逗号分隔"
                  value={replayPlanDraft.eventTypesText}
                  onChange={event => updateReplayPlanDraft('eventTypesText', event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                分段数
                <input
                  type="number"
                  min="1"
                  max="48"
                  className="input mt-2 h-10 px-3 py-2 text-sm"
                  value={replayPlanDraft.segmentCount}
                  onChange={event => updateReplayPlanDraft('segmentCount', event.target.value)}
                />
              </label>
              <div className="flex min-w-[154px] items-end gap-3 text-xs font-semibold text-slate-600">
                <label className="flex h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={replayPlanDraft.includeEvents}
                    onChange={event => updateReplayPlanDraft('includeEvents', event.target.checked)}
                  />
                  事件
                </label>
                <label className="flex h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={replayPlanDraft.includeExposures}
                    onChange={event => updateReplayPlanDraft('includeExposures', event.target.checked)}
                  />
                  曝光
                </label>
              </div>
            </div>
            {eventReplayPlanError ? (
              <p className="mt-3 rounded-lg border border-[#e7c8c4] bg-[#fff7f5] px-3 py-2 text-xs leading-5 text-[#8f3c31]">
                {localizeSystemText(eventReplayPlanError)}
              </p>
            ) : null}
            {eventReplayPlan ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">计划结果</p>
                    <p className="mt-1 text-xs text-slate-500">{localizeSystemText(eventReplayPlan.message) || '-'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${replayPlanStatusConfig.className}`}>
                      {replayPlanModeLabel}
                    </span>
                    {onRepairEventMaterialization ? (
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
                        onClick={handleRepairEventMaterialization}
                        disabled={!canRepairReplayPlan || eventPipelineActionLoading !== ''}
                        title={eventReplayPlan.fullDerivedReplay
                          ? '通过全量派生重放修复缺失账本'
                          : '按当前筛选计划局部修复缺失账本'}
                      >
                        {eventPipelineActionLoading === 'repair-materialization' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        修复缺账本
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-xs text-slate-500">影响记录</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCount(eventReplayPlan.affectedCount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">事件 / 曝光</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCount(eventReplayPlan.eventCount)} / {formatCount(eventReplayPlan.exposureCount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">物化账本</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCount(replayPlanMaterialization.materializedCount)}
                      {' / '}
                      {formatCount(replayPlanMaterialization.unmaterializedCount)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      覆盖 {replayPlanMaterialization.coveragePercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">实验组</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCount(eventReplayPlan.groupCount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">生成时间</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDateTime(eventReplayPlan.generatedAt)}
                    </p>
                  </div>
                </div>
                {replayPlanSegmentRows.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-[860px] w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold uppercase tracking-[0.1em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2">分段</th>
                          <th className="px-3 py-2">时间范围</th>
                          <th className="px-3 py-2">事件 / 曝光</th>
                          <th className="px-3 py-2">影响</th>
                          <th className="px-3 py-2">已物化</th>
                          <th className="px-3 py-2">缺账本</th>
                          <th className="px-3 py-2">动作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {replayPlanSegmentRows.map(segment => {
                          const segmentActionLoading = eventPipelineActionLoading === `repair-segment-${segment.segmentIndex}`
                          const canRepairSegment = segment.unmaterializedCount > 0
                            && Boolean(onRepairEventMaterialization)
                            && eventPipelineActionLoading === ''

                          return (
                            <tr key={segment.segmentKey}>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-slate-900">#{segment.segmentIndex}</p>
                                <p className="mt-1 font-mono text-[11px] text-slate-500">{segment.segmentKey}</p>
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                <p>{formatDateTime(segment.startTime)}</p>
                                <p className="mt-1">{formatDateTime(segment.endTime)}</p>
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-900">
                                {formatCount(segment.eventCount)} / {formatCount(segment.exposureCount)}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(segment.affectedCount)}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(segment.materializedCount)}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(segment.unmaterializedCount)}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
                                  disabled={!canRepairSegment && !segmentActionLoading}
                                  onClick={() => handleRepairReplaySegment(segment.segmentIndex)}
                                  title={segment.unmaterializedCount > 0
                                    ? '只修复当前分段缺账本'
                                    : '当前分段无需修复'}
                                >
                                  {segmentActionLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <RefreshCw size={14} />
                                  )}
                                  修复该段
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : eventReplayPlan.requestedSegmentCount > 1 ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                    {localizeSystemText(eventReplayPlan.segmentRecoveryMessage) || '当前计划未生成可恢复分段。'}
                  </p>
                ) : null}
                {replayPlanGroupRows.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-[720px] w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold uppercase tracking-[0.1em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2">实验组</th>
                          <th className="px-3 py-2">事件</th>
                          <th className="px-3 py-2">曝光</th>
                          <th className="px-3 py-2">影响</th>
                          <th className="px-3 py-2">已物化</th>
                          <th className="px-3 py-2">缺账本</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {replayPlanGroupRows.map(group => (
                          <tr key={group.groupId}>
                            <td className="px-3 py-2">
                              <p className="font-semibold text-slate-900">{localizeSystemText(group.groupName)}</p>
                              <p className="mt-1 font-mono text-[11px] text-slate-500">{group.groupId}</p>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(group.eventCount)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(group.exposureCount)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(group.affectedCount)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(group.materializedCount)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{formatCount(group.unmaterializedCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前页面不支持生成重放计划。
          </div>
        )
      ) : null}

      {activePanel === 'groups' ? (
        pipeline.hasStatistics ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">实验组</th>
                <th className="px-4 py-3">分流</th>
                <th className="px-4 py-3">曝光</th>
                <th className="px-4 py-3">事件</th>
                <th className="px-4 py-3">访客</th>
                <th className="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipeline.groups.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={6}>当前没有实验组统计明细。</td>
                </tr>
              ) : (
                pipeline.groups.map((group) => {
                  const rowStatus = statusConfig[group.status] || statusConfig.unavailable

                  return (
                    <tr key={group.groupId}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{localizeSystemText(group.groupName)}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{group.groupId}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatCount(group.assignments)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatCount(group.exposures)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatCount(group.events)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCount(group.visitors)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${rowStatus.className}`}>
                          {rowStatus.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
          {localizeSystemText(statsError) || '当前统计接口暂未返回数据。'}
        </div>
        )
      ) : null}

      {activePanel === 'issues' ? (
        (pipeline.blockingIssues.length > 0 || pipeline.warnings.length > 0) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {pipeline.blockingIssues.length > 0 ? (
            <div className="rounded-2xl border border-[#e7c8c4] bg-[#fff7f5] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#b44f42]">
                <ShieldAlert size={16} />
                阻塞项
              </div>
              <div className="space-y-2">
                {pipeline.blockingIssues.map(issue => (
                  <p key={issue} className="text-sm leading-6 text-[#8f3c31]">{localizeSystemText(issue)}</p>
                ))}
              </div>
            </div>
          ) : null}
          {pipeline.warnings.length > 0 ? (
            <div className="rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#9a6026]">
                <AlertTriangle size={16} />
                告警
              </div>
              <div className="space-y-2">
                {pipeline.warnings.map(warning => (
                  <p key={warning} className="text-sm leading-6 text-[#805226]">{localizeSystemText(warning)}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前没有阻塞项或告警。
          </div>
        )
      ) : null}
      </div>
    </section>
  )
}
