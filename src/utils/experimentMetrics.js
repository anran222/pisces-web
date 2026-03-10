const sumGroupValue = (groupStatistics, field) =>
  Object.values(groupStatistics || {}).reduce((total, stats) => total + (Number(stats?.[field]) || 0), 0)

export function buildDashboardMetrics(experiments, statisticsByExperiment) {
  const experimentList = Array.isArray(experiments) ? experiments : []
  const statsEntries = Object.values(statisticsByExperiment || {})

  return {
    total: experimentList.length,
    running: experimentList.filter(experiment => experiment?.status === 'RUNNING').length,
    visitors: statsEntries.reduce((total, stats) => (
      total + (Number(stats?.summary?.totalVisitors) || sumGroupValue(stats?.groupStatistics, 'userCount'))
    ), 0),
    conversions: statsEntries.reduce((total, stats) => (
      total + sumGroupValue(stats?.groupStatistics, 'conversionCount')
    ), 0)
  }
}
