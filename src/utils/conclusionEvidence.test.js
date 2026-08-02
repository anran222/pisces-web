import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConclusionStatusPayload,
  conclusionStatusNeedsComment,
  getConclusionEvidenceBlocker,
  requiresConclusionEvidence,
  resolveLatestReportSnapshot
} from './conclusionEvidence.js'

test('resolveLatestReportSnapshot prefers highest snapshot version', () => {
  const latest = resolveLatestReportSnapshot([
    { snapshotVersion: 2, generatedAt: '2026-07-29T12:00:00' },
    { snapshotVersion: 5, generatedAt: '2026-07-28T12:00:00' },
    { snapshotVersion: 4, generatedAt: '2026-07-30T12:00:00' }
  ])

  assert.equal(latest.snapshotVersion, 5)
})

test('resolveLatestReportSnapshot falls back to generated time when versions are missing', () => {
  const latest = resolveLatestReportSnapshot([
    { generatedAt: '2026-07-28T12:00:00' },
    { generatedAt: '2026-07-29T12:00:00' }
  ])

  assert.equal(latest.generatedAt, '2026-07-29T12:00:00')
})

test('conclusion evidence is required for review and terminal statuses', () => {
  assert.equal(requiresConclusionEvidence('RUNNING'), false)
  assert.equal(requiresConclusionEvidence('READY_FOR_REVIEW'), true)
  assert.equal(requiresConclusionEvidence('GRADUATED'), true)
  assert.equal(requiresConclusionEvidence('REJECTED'), true)
})

test('getConclusionEvidenceBlocker blocks missing or unsafe graduation evidence', () => {
  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'READY_FOR_REVIEW',
      experiment: { configVersion: 8 },
      latestReportSnapshot: null
    }),
    '暂无报告快照，先生成实验报告快照后再提交结论。'
  )

  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'GRADUATED',
      experiment: { configVersion: 8 },
      latestReportSnapshot: {
        snapshotVersion: 5,
        analysisReady: true,
        hasSrm: true,
        breachedGuardrails: []
      }
    }),
    '最新报告快照存在 SRM 风险，不能确认毕业。'
  )

  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'GRADUATED',
      experiment: { configVersion: 8 },
      latestReportSnapshot: {
        snapshotVersion: 5,
        analysisReady: true,
        hasSrm: false,
        breachedGuardrails: []
      }
    }),
    ''
  )
})

test('getConclusionEvidenceBlocker blocks missing config version and unready snapshots', () => {
  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'READY_FOR_REVIEW',
      experiment: {},
      latestReportSnapshot: {
        snapshotVersion: 5,
        analysisReady: true
      }
    }),
    '当前配置版本不可用，不能提交需要证据的结论。'
  )

  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'READY_FOR_REVIEW',
      experiment: { configVersion: 8 },
      latestReportSnapshot: {
        snapshotVersion: 5,
        analysisReady: false
      }
    }),
    '最新报告快照尚未分析就绪，不能提交结论。'
  )
})

test('getConclusionEvidenceBlocker blocks graduation when guardrails are breached', () => {
  assert.equal(
    getConclusionEvidenceBlocker({
      targetStatus: 'GRADUATED',
      experiment: { configVersion: 8 },
      latestReportSnapshot: {
        snapshotVersion: 5,
        analysisReady: true,
        hasSrm: false,
        breachedGuardrails: ['CONSULT_RATE']
      }
    }),
    '最新报告快照存在护栏异常，不能确认毕业。'
  )
})

test('conclusionStatusNeedsComment detects manual override of snapshot suggestion', () => {
  assert.equal(
    conclusionStatusNeedsComment('REJECTED', { conclusionStatus: 'GRADUATED' }),
    true
  )
  assert.equal(
    conclusionStatusNeedsComment('GRADUATED', { conclusionStatus: 'GRADUATED' }),
    false
  )
})

test('buildConclusionStatusPayload binds evidence only when required', () => {
  assert.deepEqual(
    buildConclusionStatusPayload({
      targetStatus: 'RUNNING',
      experiment: { configVersion: 8 },
      latestReportSnapshot: { snapshotVersion: 5 },
      operator: 'frontend',
      comment: ' 继续观察 '
    }),
    {
      conclusionStatus: 'RUNNING',
      operator: 'frontend',
      comment: '继续观察'
    }
  )

  assert.deepEqual(
    buildConclusionStatusPayload({
      targetStatus: 'GRADUATED',
      experiment: { configVersion: 8 },
      latestReportSnapshot: { snapshotVersion: 5 },
      operator: 'frontend',
      comment: ' 报告通过 '
    }),
    {
      conclusionStatus: 'GRADUATED',
      operator: 'frontend',
      comment: '报告通过',
      expectedConfigVersion: 8,
      reportSnapshotVersion: 5
    }
  )
})
