import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExperimentStatsHighlights,
  buildMabGroupRows,
  resolveExperimentGroupName
} from './experimentDetailUtils.js'

test('resolveExperimentGroupName prefers experiment group name', () => {
  assert.equal(
    resolveExperimentGroupName('variant_c', {
      variant_c: { name: '实验组 C - 强调质检' }
    }),
    '实验组 C - 强调质检'
  )
})

test('buildMabGroupRows maps mab groups to experiment names and sorts by probability', () => {
  const rows = buildMabGroupRows({
    groupDetails: {
      A: { allocationProbability: 0.22, successes: 30, successRate: 0.12 },
      C: { allocationProbability: 0.41, successes: 45, successRate: 0.18 }
    }
  }, {
    A: { name: '对照组' },
    C: { name: '实验组 C - 强调质检' }
  })

  assert.deepEqual(rows, [
    {
      groupId: 'C',
      groupName: '实验组 C - 强调质检',
      allocationProbability: 0.41,
      successes: 45,
      successRate: 0.18
    },
    {
      groupId: 'A',
      groupName: '对照组',
      allocationProbability: 0.22,
      successes: 30,
      successRate: 0.12
    }
  ])
})

test('buildExperimentStatsHighlights prefers custom event and metric definitions', () => {
  const highlights = buildExperimentStatsHighlights({
    eventDefinitions: [
      { key: 'PRODUCT_VIEW', label: '商品查看' },
      { key: 'PAY_SUCCESS', label: '支付成功' },
      { key: 'CONSULT_CLICK', label: '咨询点击' }
    ],
    metricDefinitions: [
      { key: 'PAYMENT_RATE', name: '支付率', aggregationType: 'RATE', primaryMetric: true }
    ]
  }, {
    userCount: 120,
    primaryMetricValue: 0.186,
    eventCounts: {
      PRODUCT_VIEW: 120,
      PAY_SUCCESS: 22,
      CONSULT_CLICK: 35
    }
  })

  assert.deepEqual(highlights, [
    { key: 'visitors', label: '访客数', value: '120' },
    { key: 'primaryMetric', label: '支付率', value: '18.60%' },
    { key: 'event-PRODUCT_VIEW', label: '商品查看', value: '120' },
    { key: 'event-PAY_SUCCESS', label: '支付成功', value: '22' },
    { key: 'event-CONSULT_CLICK', label: '咨询点击', value: '35' }
  ])
})
