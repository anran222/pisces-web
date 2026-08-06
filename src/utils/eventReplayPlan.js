const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const splitEventTypes = (value) => normalizeText(value)
  .split(/[\s,，;；]+/)
  .map(eventType => eventType.trim().toUpperCase())
  .filter(Boolean)

const unique = (values) => [...new Set(values)]

const normalizeCount = (value) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0
}

export const buildEventReplayPlanRequest = (draft = {}) => {
  const startTime = normalizeText(draft.startTime)
  const endTime = normalizeText(draft.endTime)
  const eventTypes = unique(splitEventTypes(draft.eventTypesText))
  const segmentCount = Math.trunc(Number(draft.segmentCount))

  return {
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(eventTypes.length > 0 ? { eventTypes } : {}),
    includeEvents: draft.includeEvents !== false,
    includeExposures: draft.includeExposures !== false,
    ...(Number.isFinite(segmentCount) && segmentCount > 1 ? { segmentCount } : {}),
  }
}

export const validateEventReplayPlanDraft = (draft = {}) => {
  const startTime = normalizeText(draft.startTime)
  const endTime = normalizeText(draft.endTime)
  const segmentCount = Math.trunc(Number(draft.segmentCount))
  if (Boolean(startTime) !== Boolean(endTime)) {
    return {
      valid: false,
      message: '开始时间和结束时间需要同时填写'
    }
  }
  if (startTime && endTime && new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    return {
      valid: false,
      message: '结束时间必须晚于开始时间'
    }
  }
  if (Number.isFinite(segmentCount) && segmentCount > 1 && (!startTime || !endTime)) {
    return {
      valid: false,
      message: '分段巡检需要填写完整的开始时间和结束时间'
    }
  }
  if (draft.includeEvents === false && draft.includeExposures === false) {
    return {
      valid: false,
      message: '请至少选择事件或曝光中的一种数据'
    }
  }
  return { valid: true, message: '' }
}

export const buildReplayPlanGroupRows = (plan = null) => (
  Array.isArray(plan?.groups)
    ? plan.groups.map(group => {
        const eventCount = normalizeCount(group.eventCount)
        const exposureCount = normalizeCount(group.exposureCount)
        const affectedCount = normalizeCount(group.affectedCount || eventCount + exposureCount)
        const materializedEventCount = normalizeCount(group.materializedEventCount)
        const materializedExposureCount = normalizeCount(group.materializedExposureCount)
        const materializedCount = normalizeCount(group.materializedCount
          ?? (materializedEventCount + materializedExposureCount))
        const unmaterializedCount = normalizeCount(group.unmaterializedCount
          ?? Math.max(affectedCount - materializedCount, 0))

        return {
          groupId: group.groupId || '-',
          groupName: group.groupName || group.groupId || '-',
          eventCount,
          materializedEventCount,
          unmaterializedEventCount: normalizeCount(group.unmaterializedEventCount
            ?? Math.max(eventCount - materializedEventCount, 0)),
          exposureCount,
          materializedExposureCount,
          unmaterializedExposureCount: normalizeCount(group.unmaterializedExposureCount
            ?? Math.max(exposureCount - materializedExposureCount, 0)),
          affectedCount,
          materializedCount,
          unmaterializedCount,
        }
      })
    : []
)

export const calculateReplayPlanMaterializationCoverage = (plan = null) => {
  const affectedCount = normalizeCount(plan?.affectedCount)
  const materializedEventCount = normalizeCount(plan?.materializedEventCount)
  const materializedExposureCount = normalizeCount(plan?.materializedExposureCount)
  const materializedCount = normalizeCount(plan?.materializedCount
    ?? (materializedEventCount + materializedExposureCount))
  const unmaterializedCount = normalizeCount(plan?.unmaterializedCount
    ?? Math.max(affectedCount - materializedCount, 0))
  const coverageRate = affectedCount > 0 ? materializedCount / affectedCount : 1

  return {
    materializedEventCount,
    materializedExposureCount,
    materializedCount,
    unmaterializedCount,
    coverageRate,
    coveragePercent: Math.round(Math.min(1, Math.max(0, coverageRate)) * 100)
  }
}

export const buildReplayPlanSegmentRows = (plan = null) => (
  Array.isArray(plan?.segments)
    ? plan.segments.map(segment => {
        const eventCount = normalizeCount(segment.eventCount)
        const exposureCount = normalizeCount(segment.exposureCount)
        const affectedCount = normalizeCount(segment.affectedCount || eventCount + exposureCount)
        const materializedCount = normalizeCount(segment.materializedCount)
        const unmaterializedCount = normalizeCount(segment.unmaterializedCount
          ?? Math.max(affectedCount - materializedCount, 0))

        return {
          segmentIndex: Number.isInteger(segment.segmentIndex) ? segment.segmentIndex : 0,
          segmentKey: segment.segmentKey || `segment-${segment.segmentIndex ?? 0}`,
          startTime: segment.startTime || null,
          endTime: segment.endTime || null,
          eventCount,
          exposureCount,
          affectedCount,
          materializedCount,
          unmaterializedCount,
          recommendedAction: segment.recommendedAction || 'NONE',
          message: segment.message || '',
        }
      })
    : []
)

export const calculateReplayJobProgress = (job = null) => {
  if (!job) {
    return {
      processedCount: 0,
      plannedCount: 0,
      remainingCount: 0,
      progressPercent: 0
    }
  }

  const processedCount = normalizeCount(job.affectedCount)
  const plannedCount = normalizeCount(job.plannedAffectedCount)
  const apiProgressPercent = Number(job.progressPercent)
  const progressPercent = Number.isFinite(apiProgressPercent)
    ? Math.round(Math.min(100, Math.max(0, apiProgressPercent)))
    : (plannedCount > 0 ? Math.round(Math.min(1, processedCount / plannedCount) * 100) : 100)

  return {
    processedCount,
    plannedCount,
    remainingCount: Math.max(plannedCount - processedCount, 0),
    progressPercent
  }
}

export const getReplayModeLabel = (replay = null) => {
  if (!replay) {
    return '-'
  }
  if (replay.fullDerivedReplay) {
    return '全量重建'
  }
  if (replay.replayMode === 'FILTERED_DERIVED_COPY_REPLAY') {
    return '筛选复制重放'
  }
  if (replay.replayMode === 'FILTERED_FACT_SELECTION_PLAN') {
    return '筛选计划'
  }
  return replay.replayMode ? '其他重放模式' : '-'
}

export const getReplayPlanModeLabel = getReplayModeLabel

export const getReplayFactScopeLabel = (replay = null) => {
  if (!replay) {
    return '-'
  }
  const includeEvents = replay.includeEvents !== false
  const includeExposures = replay.includeExposures !== false
  if (includeEvents && includeExposures) {
    return '事件 / 曝光'
  }
  if (includeEvents) {
    return '仅事件'
  }
  if (includeExposures) {
    return '仅曝光'
  }
  return '未选择'
}

export const getReplayEventTypesLabel = (replay = null) => {
  if (replay?.includeEvents === false) {
    return '不适用'
  }
  const eventTypes = Array.isArray(replay?.eventTypes) ? replay.eventTypes.filter(Boolean) : []
  return eventTypes.length > 0 ? eventTypes.join(', ') : '全部'
}
