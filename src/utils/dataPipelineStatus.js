const PIPELINE_STAGE_KEYS = {
  ASSIGNMENT: 'assignment',
  EXPOSURE: 'exposure',
  EVENT: 'event',
  ANALYSIS: 'analysis'
}

const EVENT_PIPELINE_META = {
  NO_DATA: {
    label: '暂无采集',
    uiStatus: 'unavailable'
  },
  PENDING: {
    label: '处理中',
    uiStatus: 'warning'
  },
  RETRY: {
    label: '重试中',
    uiStatus: 'warning'
  },
  DEAD: {
    label: '死信',
    uiStatus: 'blocked'
  },
  REJECTED: {
    label: '已拒绝',
    uiStatus: 'blocked'
  },
  DONE: {
    label: '已完成',
    uiStatus: 'ready'
  }
}

const normalizeCount = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }
  return numericValue
}

const normalizeList = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])

const sumEventCounts = (eventCounts = {}) => Object.values(eventCounts)
  .reduce((total, count) => total + normalizeCount(count), 0)

const buildCountStage = ({ key, label, count, emptyStatus }) => ({
  key,
  label,
  value: count.toLocaleString(),
  count,
  status: count > 0 ? 'ready' : emptyStatus
})

const formatPendingSeconds = (seconds) => {
  const normalizedSeconds = normalizeCount(seconds)
  if (normalizedSeconds < 60) {
    return `${normalizedSeconds} 秒`
  }
  if (normalizedSeconds < 3600) {
    return `${Math.floor(normalizedSeconds / 60)} 分钟`
  }
  return `${Math.floor(normalizedSeconds / 3600)} 小时`
}

const buildEventPipeline = (eventPipelineStatus) => {
  const hasPipelineStatus = Boolean(eventPipelineStatus)
  const status = eventPipelineStatus?.status || 'NO_DATA'
  const meta = EVENT_PIPELINE_META[status] || EVENT_PIPELINE_META.NO_DATA
  const maxPendingSeconds = normalizeCount(eventPipelineStatus?.maxPendingSeconds)

  return {
    hasPipelineStatus,
    status,
    label: meta.label,
    uiStatus: hasPipelineStatus ? meta.uiStatus : 'unavailable',
    healthy: Boolean(eventPipelineStatus?.healthy),
    totalCount: normalizeCount(eventPipelineStatus?.totalCount),
    doneCount: normalizeCount(eventPipelineStatus?.doneCount),
    pendingCount: normalizeCount(eventPipelineStatus?.pendingCount),
    processingCount: normalizeCount(eventPipelineStatus?.processingCount),
    retryCount: normalizeCount(eventPipelineStatus?.retryCount),
    deadCount: normalizeCount(eventPipelineStatus?.deadCount),
    rejectedCount: normalizeCount(eventPipelineStatus?.rejectedCount),
    unfinishedCount: normalizeCount(eventPipelineStatus?.unfinishedCount),
    maxPendingSeconds,
    maxPendingLabel: formatPendingSeconds(maxPendingSeconds)
  }
}

export const buildDataPipelineStatus = (statistics, eventPipelineStatus = null) => {
  const summary = statistics?.summary || {}
  const quality = statistics?.dataQualityCheck || {}
  const groupEntries = Object.entries(statistics?.groupStatistics || {})
  const totalEventsFromGroups = groupEntries.reduce((total, [, group]) => (
    total + sumEventCounts(group?.eventCounts)
  ), 0)
  const totalAssignments = normalizeCount(summary.totalAssignments)
  const totalExposures = normalizeCount(summary.totalExposures)
  const totalEvents = summary.totalEvents === undefined || summary.totalEvents === null
    ? totalEventsFromGroups
    : normalizeCount(summary.totalEvents)
  const analysisReady = Boolean(quality.analysisReady)
  const hasStatistics = Boolean(statistics)

  const stages = [
    buildCountStage({
      key: PIPELINE_STAGE_KEYS.ASSIGNMENT,
      label: '分流',
      count: totalAssignments,
      emptyStatus: hasStatistics ? 'blocked' : 'unavailable'
    }),
    buildCountStage({
      key: PIPELINE_STAGE_KEYS.EXPOSURE,
      label: '曝光',
      count: totalExposures,
      emptyStatus: hasStatistics ? 'warning' : 'unavailable'
    }),
    buildCountStage({
      key: PIPELINE_STAGE_KEYS.EVENT,
      label: '事件',
      count: totalEvents,
      emptyStatus: hasStatistics ? 'warning' : 'unavailable'
    }),
    {
      key: PIPELINE_STAGE_KEYS.ANALYSIS,
      label: '分析门禁',
      value: analysisReady ? '已就绪' : '未就绪',
      count: null,
      status: analysisReady ? 'ready' : (hasStatistics ? 'blocked' : 'unavailable')
    }
  ]

  const groups = groupEntries.map(([groupId, group]) => {
    const assignments = normalizeCount(group?.assignmentCount)
    const exposures = normalizeCount(group?.exposureCount)
    const events = sumEventCounts(group?.eventCounts)

    return {
      groupId: group?.groupId || groupId,
      groupName: group?.groupName || group?.groupId || groupId,
      assignments,
      exposures,
      events,
      visitors: normalizeCount(group?.userCount),
      status: assignments > 0 && exposures > 0 && events > 0 ? 'ready' : 'warning'
    }
  })

  return {
    hasStatistics,
    analysisReady,
    totalAssignments,
    totalExposures,
    totalEvents,
    stages,
    groups,
    eventPipeline: buildEventPipeline(eventPipelineStatus),
    blockingIssues: normalizeList(quality.blockingIssues),
    warnings: normalizeList(quality.warnings)
  }
}
