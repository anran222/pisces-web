import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardDecisionItems, buildDashboardMetrics } from './experimentMetrics.js'

test('buildDashboardMetrics aggregates real experiment statistics', () => {
  const metrics = buildDashboardMetrics(
    [
      { id: 'exp-1', status: 'RUNNING' },
      { id: 'exp-2', status: 'DRAFT' }
    ],
    {
      'exp-1': {
        summary: { totalVisitors: 120 },
        groupStatistics: {
          control: { conversionCount: 8 },
          variant: { conversionCount: 11 }
        }
      },
      'exp-2': {
        groupStatistics: {
          control: { userCount: 50, conversionCount: 3 },
          variant: { userCount: 45, conversionCount: 4 }
        }
      }
    }
  )

  assert.deepEqual(metrics, {
    total: 2,
    running: 1,
    visitors: 215,
    conversions: 26
  })
})

test('buildDashboardDecisionItems derives priority from lightweight statistics', () => {
  const items = buildDashboardDecisionItems(
    [
      { id: 'ready', name: '数据就绪实验', status: 'RUNNING' },
      { id: 'blocked', name: '数据阻塞实验', status: 'DRAFT' }
    ],
    {
      ready: {
        summary: { totalVisitors: 320, bestPerformingGroup: 'variant_a' },
        dataQualityCheck: { analysisReady: true }
      },
      blocked: {
        summary: { totalVisitors: 0 },
        dataQualityCheck: {
          analysisReady: false,
          blockingIssues: ['至少一个实验组尚无真实分流数据']
        }
      }
    }
  )

  assert.equal(items[0].id, 'blocked')
  assert.equal(items[0].guardrailStatus, 'BLOCKED')
  assert.equal(items[0].decision, 'HOLD')
  assert.equal(items[0].riskCount, 1)
  assert.equal(items[1].id, 'ready')
  assert.equal(items[1].analysisReady, true)
  assert.equal(items[1].decision, 'RECOMMENDATION')
  assert.equal(items[1].totalVisitors, 320)
})
