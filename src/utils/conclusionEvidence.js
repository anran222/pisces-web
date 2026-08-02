const EVIDENCE_REQUIRED_STATUSES = new Set(['READY_FOR_REVIEW', 'GRADUATED', 'REJECTED'])

const toNumber = (value) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

export const requiresConclusionEvidence = (status) => EVIDENCE_REQUIRED_STATUSES.has(status)

export const resolveLatestReportSnapshot = (snapshots = []) => {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return null
  }

  return snapshots
    .filter(Boolean)
    .reduce((latest, snapshot) => {
      if (!latest) {
        return snapshot
      }

      const latestVersion = toNumber(latest.snapshotVersion)
      const snapshotVersion = toNumber(snapshot.snapshotVersion)

      if (latestVersion !== null || snapshotVersion !== null) {
        return (snapshotVersion ?? -1) > (latestVersion ?? -1) ? snapshot : latest
      }

      return toTime(snapshot.generatedAt) > toTime(latest.generatedAt) ? snapshot : latest
    }, null)
}

export const conclusionStatusNeedsComment = (targetStatus, latestReportSnapshot) => (
  Boolean(
    targetStatus
      && latestReportSnapshot?.conclusionStatus
      && targetStatus !== latestReportSnapshot.conclusionStatus
  )
)

export const getConclusionEvidenceBlocker = ({
  targetStatus,
  experiment,
  latestReportSnapshot
} = {}) => {
  if (!requiresConclusionEvidence(targetStatus)) {
    return ''
  }

  if (experiment?.configVersion === null || experiment?.configVersion === undefined) {
    return '当前配置版本不可用，不能提交需要证据的结论。'
  }

  if (!latestReportSnapshot?.snapshotVersion) {
    return '暂无报告快照，先生成实验报告快照后再提交结论。'
  }

  if (latestReportSnapshot.analysisReady === false) {
    return '最新报告快照尚未分析就绪，不能提交结论。'
  }

  if (targetStatus === 'GRADUATED') {
    if (latestReportSnapshot.hasSrm === true) {
      return '最新报告快照存在 SRM 风险，不能确认毕业。'
    }

    if ((latestReportSnapshot.breachedGuardrails || []).length > 0) {
      return '最新报告快照存在护栏异常，不能确认毕业。'
    }
  }

  return ''
}

export const buildConclusionStatusPayload = ({
  targetStatus,
  experiment,
  latestReportSnapshot,
  operator = 'web-ui',
  comment = ''
} = {}) => {
  const payload = {
    conclusionStatus: targetStatus,
    operator,
    comment: comment.trim()
  }

  if (requiresConclusionEvidence(targetStatus)) {
    payload.expectedConfigVersion = experiment?.configVersion
    payload.reportSnapshotVersion = latestReportSnapshot?.snapshotVersion
  }

  return payload
}
