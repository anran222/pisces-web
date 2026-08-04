import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDataPipelineStatus } from './dataPipelineStatus.js'

test('buildDataPipelineStatus exposes totals and group pipeline counts', () => {
  const model = buildDataPipelineStatus(
    {
      summary: {
        totalAssignments: 20,
        totalExposures: 18,
        totalEvents: 9
      },
      dataQualityCheck: {
        analysisReady: true,
        warnings: ['曝光少于分流']
      },
      groupStatistics: {
        A: {
          groupId: 'A',
          groupName: '基准组',
          assignmentCount: 10,
          exposureCount: 9,
          userCount: 8,
          eventCounts: {
            VIEW: 6,
            PAY: 1
          }
        },
        B: {
          groupId: 'B',
          groupName: '实验组',
          assignmentCount: 10,
          exposureCount: 9,
          userCount: 7,
          eventCounts: {
            VIEW: 2
          }
        }
      }
    },
    {
      status: 'DONE',
      healthy: true,
      totalCount: 20,
      doneCount: 20,
      pendingCount: 0,
      processingCount: 0,
      retryCount: 0,
      deadCount: 0,
      rejectedCount: 0,
      unfinishedCount: 0,
      maxPendingSeconds: 0
    }
  )

  assert.equal(model.analysisReady, true)
  assert.deepEqual(
    model.stages.map(stage => [stage.key, stage.value, stage.status]),
    [
      ['assignment', '20', 'ready'],
      ['exposure', '18', 'ready'],
      ['event', '9', 'ready'],
      ['analysis', '已就绪', 'ready']
    ]
  )
  assert.deepEqual(model.groups, [
    {
      groupId: 'A',
      groupName: '基准组',
      assignments: 10,
      exposures: 9,
      events: 7,
      visitors: 8,
      status: 'ready'
    },
    {
      groupId: 'B',
      groupName: '实验组',
      assignments: 10,
      exposures: 9,
      events: 2,
      visitors: 7,
      status: 'ready'
    }
  ])
  assert.deepEqual(model.warnings, ['曝光少于分流'])
  assert.deepEqual(model.eventPipeline, {
    hasPipelineStatus: true,
    status: 'DONE',
    label: '已完成',
    uiStatus: 'ready',
    healthy: true,
    totalCount: 20,
    doneCount: 20,
    pendingCount: 0,
    processingCount: 0,
    retryCount: 0,
    deadCount: 0,
    rejectedCount: 0,
    unfinishedCount: 0,
    maxPendingSeconds: 0,
    maxPendingLabel: '0 秒'
  })
})

test('buildDataPipelineStatus falls back to group event counts when summary event total is missing', () => {
  const model = buildDataPipelineStatus({
    summary: {
      totalAssignments: 3,
      totalExposures: 2
    },
    dataQualityCheck: {
      analysisReady: false,
      blockingIssues: ['样本量不足']
    },
    groupStatistics: {
      A: {
        eventCounts: {
          VIEW: 2
        }
      },
      B: {
        eventCounts: {
          VIEW: 1
        }
      }
    }
  })

  assert.equal(model.totalEvents, 3)
  assert.deepEqual(
    model.stages.map(stage => [stage.key, stage.value, stage.status]),
    [
      ['assignment', '3', 'ready'],
      ['exposure', '2', 'ready'],
      ['event', '3', 'ready'],
      ['analysis', '未就绪', 'blocked']
    ]
  )
  assert.deepEqual(model.blockingIssues, ['样本量不足'])
})

test('buildDataPipelineStatus marks missing statistics as unavailable', () => {
  const model = buildDataPipelineStatus(null)

  assert.equal(model.hasStatistics, false)
  assert.deepEqual(
    model.stages.map(stage => [stage.key, stage.value, stage.status]),
    [
      ['assignment', '0', 'unavailable'],
      ['exposure', '0', 'unavailable'],
      ['event', '0', 'unavailable'],
      ['analysis', '未就绪', 'unavailable']
    ]
  )
  assert.deepEqual(model.groups, [])
  assert.equal(model.eventPipeline.uiStatus, 'unavailable')
  assert.equal(model.eventPipeline.label, '暂无采集')
})

test('buildDataPipelineStatus maps event pipeline retry and lag states', () => {
  const model = buildDataPipelineStatus(null, {
    status: 'RETRY',
    healthy: false,
    totalCount: 12,
    doneCount: 8,
    pendingCount: 1,
    processingCount: 1,
    retryCount: 2,
    deadCount: 0,
    rejectedCount: 0,
    unfinishedCount: 4,
    maxPendingSeconds: 125
  })

  assert.deepEqual(model.eventPipeline, {
    hasPipelineStatus: true,
    status: 'RETRY',
    label: '重试中',
    uiStatus: 'warning',
    healthy: false,
    totalCount: 12,
    doneCount: 8,
    pendingCount: 1,
    processingCount: 1,
    retryCount: 2,
    deadCount: 0,
    rejectedCount: 0,
    unfinishedCount: 4,
    maxPendingSeconds: 125,
    maxPendingLabel: '2 分钟'
  })
})
