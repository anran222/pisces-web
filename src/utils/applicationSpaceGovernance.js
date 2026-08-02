const DEFAULT_RELEASE_WINDOW_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_RELEASE_WINDOW_DAYS = [1, 2, 3, 4, 5]
const DEFAULT_RELEASE_WINDOW_START_TIME = '09:00'
const DEFAULT_RELEASE_WINDOW_END_TIME = '18:00'

export const buildApplicationSpaceDraft = (space = {}) => ({
  appId: space.appId || '',
  displayName: space.displayName || space.appId || '',
  defaultOwner: space.defaultOwner || '',
  experimentQuota: space.experimentQuota ?? '',
  approvalRequired: Boolean(space.approvalRequired),
  approvalOwners: (space.approvalOwners || []).join(', '),
  approvalRequiredCount: space.approvalRequiredCount ?? 1,
  approvalSlaHours: space.approvalSlaHours ?? '',
  approvalEscalationOwners: (space.approvalEscalationOwners || []).join(', '),
  releaseWindowEnabled: Boolean(space.releaseWindowEnabled),
  releaseWindowTimezone: space.releaseWindowTimezone || DEFAULT_RELEASE_WINDOW_TIMEZONE,
  releaseWindowDays: (space.releaseWindowDays || DEFAULT_RELEASE_WINDOW_DAYS).join(', '),
  releaseWindowStartTime: space.releaseWindowStartTime || DEFAULT_RELEASE_WINDOW_START_TIME,
  releaseWindowEndTime: space.releaseWindowEndTime || DEFAULT_RELEASE_WINDOW_END_TIME,
})

export const buildApplicationSpacePayload = (draft = {}) => {
  const quotaText = String(draft.experimentQuota ?? '').trim()
  const experimentQuota = parseExperimentQuota(quotaText)
  const approvalRequiredCount = parseApprovalRequiredCount(draft.approvalRequiredCount)
  const approvalSlaHours = parseApprovalSlaHours(draft.approvalSlaHours)
  const releaseWindowEnabled = Boolean(draft.releaseWindowEnabled)
  const releaseWindowStartTime = releaseWindowEnabled
    ? parseReleaseWindowTime(draft.releaseWindowStartTime, DEFAULT_RELEASE_WINDOW_START_TIME)
    : ''
  const releaseWindowEndTime = releaseWindowEnabled
    ? parseReleaseWindowTime(draft.releaseWindowEndTime, DEFAULT_RELEASE_WINDOW_END_TIME)
    : ''

  if (releaseWindowEnabled && releaseWindowStartTime >= releaseWindowEndTime) {
    throw new Error('发布窗口开始时间必须早于结束时间')
  }

  return {
    displayName: normalizeText(draft.displayName),
    defaultOwner: normalizeText(draft.defaultOwner),
    experimentQuota,
    approvalRequired: Boolean(draft.approvalRequired),
    approvalOwners: parseApprovalOwners(draft.approvalOwners),
    approvalRequiredCount,
    approvalSlaHours,
    approvalEscalationOwners: parseApprovalOwners(draft.approvalEscalationOwners),
    releaseWindowEnabled,
    releaseWindowTimezone: releaseWindowEnabled
      ? normalizeText(draft.releaseWindowTimezone) || DEFAULT_RELEASE_WINDOW_TIMEZONE
      : '',
    releaseWindowDays: releaseWindowEnabled ? parseReleaseWindowDays(draft.releaseWindowDays) : [],
    releaseWindowStartTime,
    releaseWindowEndTime,
  }
}

export const parseApprovalOwners = (approvalOwnersText) => {
  const approvalOwners = String(approvalOwnersText ?? '')
    .split(',')
    .map(owner => normalizeText(owner))
    .filter(Boolean)
  return [...new Set(approvalOwners)]
}

export const parseExperimentQuota = (quotaText) => {
  if (!quotaText) {
    return null
  }

  const quota = Number(quotaText)
  if (!Number.isInteger(quota) || quota < 0) {
    throw new Error('实验配额必须是非负整数')
  }
  return quota
}

export const parseApprovalRequiredCount = (approvalRequiredCountText) => {
  const countText = String(approvalRequiredCountText ?? '').trim()
  if (!countText) {
    return 1
  }

  const approvalRequiredCount = Number(countText)
  if (!Number.isInteger(approvalRequiredCount) || approvalRequiredCount < 1) {
    throw new Error('审批通过人数必须是正整数')
  }
  return approvalRequiredCount
}

export const parseApprovalSlaHours = (approvalSlaHoursText) => {
  const slaText = String(approvalSlaHoursText ?? '').trim()
  if (!slaText) {
    return null
  }

  const approvalSlaHours = Number(slaText)
  if (!Number.isInteger(approvalSlaHours) || approvalSlaHours < 1) {
    throw new Error('审批 SLA 小时数必须是正整数')
  }
  return approvalSlaHours
}

export const parseReleaseWindowDays = (releaseWindowDaysValue) => {
  const values = Array.isArray(releaseWindowDaysValue)
    ? releaseWindowDaysValue
    : String(releaseWindowDaysValue ?? '')
      .split(',')
      .map(day => day.trim())
      .filter(Boolean)

  if (values.length === 0) {
    return DEFAULT_RELEASE_WINDOW_DAYS
  }

  const days = values.map((day) => {
    const releaseWindowDay = Number(day)
    if (!Number.isInteger(releaseWindowDay) || releaseWindowDay < 1 || releaseWindowDay > 7) {
      throw new Error('发布窗口星期必须是 1 到 7 的整数')
    }
    return releaseWindowDay
  })
  return [...new Set(days)]
}

export const parseReleaseWindowTime = (releaseWindowTimeValue, fallback = '') => {
  const releaseWindowTime = String(releaseWindowTimeValue ?? '').trim() || fallback
  if (!/^\d{2}:\d{2}$/.test(releaseWindowTime)) {
    throw new Error('发布窗口时间必须使用 HH:mm 格式')
  }
  const [hour, minute] = releaseWindowTime.split(':').map(Number)
  if (hour > 23 || minute > 59) {
    throw new Error('发布窗口时间必须使用 HH:mm 格式')
  }
  return releaseWindowTime
}

export const summarizeApplicationSpaces = (spaces = []) => spaces.reduce((summary, space) => ({
  applicationCount: summary.applicationCount + 1,
  experimentCount: summary.experimentCount + Number(space.experimentCount || 0),
  runningExperimentCount: summary.runningExperimentCount + Number(space.runningExperimentCount || 0),
  approvalRequiredCount: summary.approvalRequiredCount + (space.approvalRequired ? 1 : 0),
  approvalSlaEnabledCount: summary.approvalSlaEnabledCount + (space.approvalSlaHours ? 1 : 0),
  releaseWindowEnabledCount: summary.releaseWindowEnabledCount + (space.releaseWindowEnabled ? 1 : 0),
}), {
  applicationCount: 0,
  experimentCount: 0,
  runningExperimentCount: 0,
  approvalRequiredCount: 0,
  approvalSlaEnabledCount: 0,
  releaseWindowEnabledCount: 0,
})

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
