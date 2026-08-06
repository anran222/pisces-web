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

const asArray = value => (Array.isArray(value) ? value : [])

const DASHBOARD_STATUS_PRIORITY = {
  RUNNING: 0,
  PAUSED: 1,
  DRAFT: 2,
  STOPPED: 3,
}

export function selectDashboardStatisticsTargets(experiments, limit = 6) {
  const experimentList = Array.isArray(experiments) ? experiments : []
  const safeLimit = Math.max(0, Number(limit) || 0)

  return experimentList
    .map((experiment, index) => ({ experiment, index }))
    .sort((left, right) => {
      const leftPriority = DASHBOARD_STATUS_PRIORITY[left.experiment?.status] ?? 4
      const rightPriority = DASHBOARD_STATUS_PRIORITY[right.experiment?.status] ?? 4
      return leftPriority - rightPriority || left.index - right.index
    })
    .slice(0, safeLimit)
    .map(item => item.experiment)
}

export function buildDashboardDecisionItems(experiments, statisticsByExperiment) {
  const experimentList = Array.isArray(experiments) ? experiments : []

  return experimentList
    .map((experiment, index) => {
      const statistics = statisticsByExperiment?.[experiment.id] || {}
      const summary = statistics.summary || {}
      const dataQuality = statistics.dataQualityCheck || {}
      const blockingIssues = asArray(dataQuality.blockingIssues)
      const breachedGuardrails = asArray(summary.breachedGuardrails)
      const warnings = asArray(dataQuality.warnings)
      const blocked = blockingIssues.length > 0 || breachedGuardrails.length > 0
      const analysisReady = dataQuality.analysisReady === true && !blocked

      let decisionSummary = '统计数据正在准备中。'
      if (blockingIssues.length > 0) {
        decisionSummary = blockingIssues[0]
      } else if (breachedGuardrails.length > 0) {
        decisionSummary = breachedGuardrails[0]
      } else if (analysisReady) {
        decisionSummary = '数据质量检查已通过，可以进入实验决策分析。'
      } else if (warnings.length > 0) {
        decisionSummary = warnings[0]
      } else if (experiment.status === 'DRAFT') {
        decisionSummary = '实验尚未启动，等待真实分流与曝光数据。'
      }

      return {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        decision: blocked ? 'HOLD' : (analysisReady ? 'RECOMMENDATION' : 'WAIT_FOR_DATA'),
        decisionSummary,
        guardrailStatus: blocked ? 'BLOCKED' : (analysisReady ? 'PASS' : 'UNKNOWN'),
        totalVisitors: Number(summary.totalVisitors) || 0,
        bestGroup: summary.bestPerformingGroup || '-',
        riskCount: blockingIssues.length + breachedGuardrails.length,
        blockingIssues,
        analysisReady,
        originalIndex: index
      }
    })
    .sort((left, right) => {
      if (left.guardrailStatus === 'BLOCKED' && right.guardrailStatus !== 'BLOCKED') {
        return -1
      }
      if (left.guardrailStatus !== 'BLOCKED' && right.guardrailStatus === 'BLOCKED') {
        return 1
      }
      if (left.analysisReady !== right.analysisReady) {
        return left.analysisReady ? -1 : 1
      }
      return left.originalIndex - right.originalIndex
    })
}
