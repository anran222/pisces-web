export const resolveExperimentGroupName = (groupId, groups = {}) => {
  if (!groupId) {
    return '-'
  }
  return groups?.[groupId]?.name || groupId
}

const formatNumber = (value) => Number(value || 0).toLocaleString()

const formatMetricValue = (value, aggregationType) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }
  if (aggregationType === 'RATE') {
    return `${(numericValue * 100).toFixed(2)}%`
  }
  return formatNumber(numericValue)
}

export const resolvePrimaryMetricDefinition = (experiment = {}, summary = {}) => {
  const metricDefinitions = experiment?.metricDefinitions || []
  const primaryMetricKey = summary?.primaryMetricKey
  return metricDefinitions.find(definition => definition?.key === primaryMetricKey)
    || metricDefinitions.find(definition => definition?.primaryMetric)
    || null
}

export const buildExperimentStatsHighlights = (experiment = {}, groupStats = {}) => {
  const primaryMetricDefinition = resolvePrimaryMetricDefinition(experiment, {
    primaryMetricKey: groupStats?.primaryMetricKey
  })
  const metricValues = groupStats?.metricValues || {}
  const eventCounts = groupStats?.eventCounts || {}
  const eventDefinitions = experiment?.eventDefinitions || []

  const highlights = [
    {
      key: 'visitors',
      label: '访客数',
      value: formatNumber(groupStats?.userCount)
    }
  ]

  if (primaryMetricDefinition) {
    highlights.push({
      key: 'primaryMetric',
      label: primaryMetricDefinition.name || primaryMetricDefinition.key,
      value: formatMetricValue(
        metricValues?.[primaryMetricDefinition.key] ?? groupStats?.primaryMetricValue,
        primaryMetricDefinition.aggregationType
      )
    })
  }

  eventDefinitions.forEach((definition) => {
    highlights.push({
      key: `event-${definition.key}`,
      label: definition.label || definition.key,
      value: formatNumber(eventCounts?.[definition.key])
    })
  })

  return highlights
}

export const buildMabGroupRows = (mabSummary, groups = {}) => {
  const groupDetails = mabSummary?.groupDetails || {}

  return Object.entries(groupDetails)
    .map(([groupId, detail]) => ({
      groupId,
      groupName: resolveExperimentGroupName(groupId, groups),
      allocationProbability: Number(detail?.allocationProbability || 0),
      successes: Number(detail?.successes || 0),
      successRate: Number(detail?.successRate || 0)
    }))
    .sort((left, right) => right.allocationProbability - left.allocationProbability)
}
