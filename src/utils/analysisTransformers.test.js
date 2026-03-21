import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTimelineChartData } from './analysisTransformers.js'

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
