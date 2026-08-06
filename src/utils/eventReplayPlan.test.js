import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEventReplayPlanRequest,
  buildReplayPlanGroupRows,
  buildReplayPlanSegmentRows,
  calculateReplayJobProgress,
  calculateReplayPlanMaterializationCoverage,
  getReplayEventTypesLabel,
  getReplayFactScopeLabel,
  getReplayModeLabel,
  getReplayPlanModeLabel,
  validateEventReplayPlanDraft
} from './eventReplayPlan.js'

test('buildEventReplayPlanRequest normalizes filters and event types', () => {
  const request = buildEventReplayPlanRequest({
    startTime: '2026-07-30T10:00',
    endTime: '2026-07-30T12:00',
    eventTypesText: 'pay_success, PRODUCT_VIEW；pay_success\nadd_to_cart',
    includeEvents: true,
    includeExposures: false,
    segmentCount: 4
  })

  assert.deepEqual(request, {
    startTime: '2026-07-30T10:00',
    endTime: '2026-07-30T12:00',
    eventTypes: ['PAY_SUCCESS', 'PRODUCT_VIEW', 'ADD_TO_CART'],
    includeEvents: true,
    includeExposures: false,
    segmentCount: 4
  })
})

test('buildEventReplayPlanRequest returns explicit default fact scopes', () => {
  assert.deepEqual(buildEventReplayPlanRequest({}), {
    includeEvents: true,
    includeExposures: true
  })
})

test('validateEventReplayPlanDraft requires a complete ordered time range for segments', () => {
  assert.deepEqual(validateEventReplayPlanDraft({
    startTime: '2026-07-30T10:00',
    endTime: '',
    segmentCount: 4
  }), {
    valid: false,
    message: '开始时间和结束时间需要同时填写'
  })
  assert.equal(validateEventReplayPlanDraft({
    startTime: '2026-07-30T12:00',
    endTime: '2026-07-30T10:00',
    segmentCount: 4
  }).message, '结束时间必须晚于开始时间')
  assert.equal(validateEventReplayPlanDraft({
    startTime: '',
    endTime: '',
    segmentCount: 4
  }).message, '分段巡检需要填写完整的开始时间和结束时间')
  assert.deepEqual(validateEventReplayPlanDraft({
    startTime: '2026-07-30T10:00',
    endTime: '2026-07-30T12:00',
    segmentCount: 4
  }), { valid: true, message: '' })
})

test('buildReplayPlanGroupRows normalizes numeric counters', () => {
  assert.deepEqual(buildReplayPlanGroupRows({
    groups: [
      {
        groupId: 'A',
        groupName: '基准组',
        eventCount: '3',
        materializedEventCount: '2',
        exposureCount: null,
        affectedCount: 3,
        materializedCount: 2
      }
    ]
  }), [
    {
      groupId: 'A',
      groupName: '基准组',
      eventCount: 3,
      materializedEventCount: 2,
      unmaterializedEventCount: 1,
      exposureCount: 0,
      materializedExposureCount: 0,
      unmaterializedExposureCount: 0,
      affectedCount: 3,
      materializedCount: 2,
      unmaterializedCount: 1
    }
  ])
})

test('buildReplayPlanGroupRows derives materialization gaps for old response shapes', () => {
  assert.deepEqual(buildReplayPlanGroupRows({
    groups: [
      {
        groupId: 'B',
        eventCount: 4,
        exposureCount: 6,
        affectedCount: 10,
        materializedEventCount: 3,
        materializedExposureCount: 5
      }
    ]
  })[0], {
    groupId: 'B',
    groupName: 'B',
    eventCount: 4,
    materializedEventCount: 3,
    unmaterializedEventCount: 1,
    exposureCount: 6,
    materializedExposureCount: 5,
    unmaterializedExposureCount: 1,
    affectedCount: 10,
    materializedCount: 8,
    unmaterializedCount: 2
  })
})

test('calculateReplayPlanMaterializationCoverage returns counts and bounded percent', () => {
  assert.deepEqual(calculateReplayPlanMaterializationCoverage({
    affectedCount: 10,
    materializedCount: 7,
    unmaterializedCount: 3
  }), {
    materializedEventCount: 0,
    materializedExposureCount: 0,
    materializedCount: 7,
    unmaterializedCount: 3,
    coverageRate: 0.7,
    coveragePercent: 70
  })

  assert.equal(calculateReplayPlanMaterializationCoverage({ affectedCount: 0 }).coveragePercent, 100)
})

test('buildReplayPlanSegmentRows normalizes segment audit rows', () => {
  assert.deepEqual(buildReplayPlanSegmentRows({
    segments: [
      {
        segmentIndex: 1,
        segmentKey: 'segment-001',
        startTime: '2026-07-30T11:00:00.000000001',
        endTime: '2026-07-30T12:00:00',
        eventCount: '4',
        exposureCount: 0,
        affectedCount: 4,
        materializedCount: 2,
        unmaterializedCount: 2,
        recommendedAction: 'REPAIR_MATERIALIZATION_SEGMENT'
      }
    ]
  }), [
    {
      segmentIndex: 1,
      segmentKey: 'segment-001',
      startTime: '2026-07-30T11:00:00.000000001',
      endTime: '2026-07-30T12:00:00',
      eventCount: 4,
      exposureCount: 0,
      affectedCount: 4,
      materializedCount: 2,
      unmaterializedCount: 2,
      recommendedAction: 'REPAIR_MATERIALIZATION_SEGMENT',
      message: ''
    }
  ])
  assert.deepEqual(buildReplayPlanSegmentRows({}), [])
})

test('calculateReplayJobProgress uses server percent and derives remaining counts', () => {
  assert.deepEqual(calculateReplayJobProgress({
    affectedCount: 42,
    plannedAffectedCount: 100,
    progressPercent: 41.6
  }), {
    processedCount: 42,
    plannedCount: 100,
    remainingCount: 58,
    progressPercent: 42
  })
})

test('calculateReplayJobProgress derives percent for old replay job shapes', () => {
  assert.deepEqual(calculateReplayJobProgress({
    affectedCount: 25,
    plannedAffectedCount: 80
  }), {
    processedCount: 25,
    plannedCount: 80,
    remainingCount: 55,
    progressPercent: 31
  })
  assert.equal(calculateReplayJobProgress({ affectedCount: 0 }).progressPercent, 100)
})

test('getReplayPlanModeLabel maps known plan modes', () => {
  assert.equal(getReplayPlanModeLabel({ fullDerivedReplay: true }), '全量重建')
  assert.equal(
    getReplayPlanModeLabel({ replayMode: 'FILTERED_FACT_SELECTION_PLAN' }),
    '筛选计划'
  )
  assert.equal(
    getReplayPlanModeLabel({ replayMode: 'FILTERED_DERIVED_COPY_REPLAY' }),
    '筛选复制重放'
  )
})

test('replay job labels expose persisted audit scope', () => {
  const replayJob = {
    replayMode: 'FILTERED_DERIVED_COPY_REPLAY',
    fullDerivedReplay: false,
    includeEvents: true,
    includeExposures: false,
    eventTypes: ['PAY_SUCCESS', 'PRODUCT_VIEW']
  }

  assert.equal(getReplayModeLabel(replayJob), '筛选复制重放')
  assert.equal(getReplayFactScopeLabel(replayJob), '仅事件')
  assert.equal(getReplayEventTypesLabel(replayJob), 'PAY_SUCCESS, PRODUCT_VIEW')
  assert.equal(getReplayEventTypesLabel({ eventTypes: [] }), '全部')
  assert.equal(getReplayEventTypesLabel({ includeEvents: false, eventTypes: ['PAY_SUCCESS'] }), '不适用')
})
