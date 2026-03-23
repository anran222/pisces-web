import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroupChartData, buildTimelineChartData } from './analysisTransformers.js'

test('buildTimelineChartData converts rate metrics to percentages', () => {
  const chartData = buildTimelineChartData({
    metricType: 'CONVERSION_RATE',
    granularity: 'DAY',
    dataPoints: [
      {
        bucketStart: '2026-03-01T00:00:00',
        values: {
          control: 0.1234,
          variant: 0.2345
        }
      }
    ]
  })

  assert.deepEqual(chartData, [
    {
      time: '03-01',
      control: 12.34,
      variant: 23.45
    }
  ])
})

test('buildTimelineChartData converts custom rate metrics to percentages', () => {
  const chartData = buildTimelineChartData({
    metricType: 'PAYMENT_RATE',
    metricDefinition: {
      key: 'PAYMENT_RATE',
      aggregationType: 'RATE'
    },
    granularity: 'DAY',
    dataPoints: [
      {
        bucketStart: '2026-03-02T00:00:00',
        values: {
          control: 0.15,
          variant: 0.19
        }
      }
    ]
  })

  assert.deepEqual(chartData, [
    {
      time: '03-02',
      control: 15,
      variant: 19
    }
  ])
})

test('buildGroupChartData prefers compare lift rate when present', () => {
  const chartData = buildGroupChartData(
    {
      groupStatistics: {
        A: {
          groupId: 'A',
          groupName: '对照组',
          metricValues: { PAYMENT_RATE: 0.1 },
          conversionRate: 0.1,
          userCount: 100
        },
        B: {
          groupId: 'B',
          groupName: '实验组',
          metricValues: { PAYMENT_RATE: 0.12 },
          conversionRate: 0.12,
          liftRate: 0.05,
          userCount: 100
        }
      }
    },
    { key: 'PAYMENT_RATE', aggregationType: 'RATE' },
    {
      comparisons: {
        B: {
          conversionRateChangePercent: 20
        }
      }
    }
  )

  assert.deepEqual(chartData, [
    {
      group: '对照组',
      primaryMetric: 10,
      liftRate: 0,
      visitors: 100
    },
    {
      group: '实验组',
      primaryMetric: 12,
      liftRate: 20,
      visitors: 100
    }
  ])
})
