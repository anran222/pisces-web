const trimToNull = value => {
  if (value === null || value === undefined) {
    return null
  }
  const normalizedValue = String(value).trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

const normalizeStatuses = statuses => {
  if (Array.isArray(statuses)) {
    return statuses
      .map(trimToNull)
      .filter(Boolean)
      .join(',')
  }
  return trimToNull(statuses)
}

export const buildExperimentListParams = (filters = {}) => {
  const params = {}
  const status = trimToNull(filters.status)
  const statuses = normalizeStatuses(filters.statuses)
  const appId = trimToNull(filters.appId)
  const owner = trimToNull(filters.owner)

  if (status && status !== 'all') {
    params.status = status
  }
  if (statuses) {
    params.statuses = statuses
  }
  if (appId) {
    params.appId = appId
  }
  if (owner) {
    params.owner = owner
  }
  return params
}

export const filterExperimentsBySearch = (experiments = [], search = '', applicationNames = {}) => {
  const normalizedSearch = trimToNull(search)?.toLowerCase()
  if (!normalizedSearch) {
    return experiments
  }
  return experiments.filter(experiment => [
    experiment?.name,
    experiment?.id,
    experiment?.appId,
    experiment?.owner,
    applicationNames[experiment?.appId]
  ].some(value => String(value || '').toLowerCase().includes(normalizedSearch)))
}
