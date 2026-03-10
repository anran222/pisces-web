import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardMetrics } from './experimentMetrics.js'

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
