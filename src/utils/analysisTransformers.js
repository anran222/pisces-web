const RATE_METRIC_TYPES = new Set(['CONVERSION_RATE', 'CLICK_RATE'])

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatBucketLabel(bucketStart, granularity) {
  const date = new Date(bucketStart)
  if (Number.isNaN(date.getTime())) {
    return bucketStart || '-'
  }

  if (granularity === 'HOUR') {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00`
  }
  if (granularity === 'WEEK') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildTimelineChartData(timeline) {
  const dataPoints = Array.isArray(timeline?.dataPoints) ? timeline.dataPoints : []
  const isRateMetric = RATE_METRIC_TYPES.has(timeline?.metricType)

  return dataPoints.map((point, index) => {
    const values = Object.entries(point?.values || {}).reduce((accumulator, [groupId, value]) => {
      const numericValue = Number(value) || 0
      accumulator[groupId] = isRateMetric ? Number((numericValue * 100).toFixed(2)) : numericValue
      return accumulator
    }, {})

    return {
      time: formatBucketLabel(point?.bucketStart, timeline?.granularity) || `Bucket ${index + 1}`,
      ...values
    }
  })
}
