import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeApplicationDictionaryIntoDraft } from './applicationDictionary.js'

test('mergeApplicationDictionaryIntoDraft imports non duplicate events and metrics', () => {
  const result = mergeApplicationDictionaryIntoDraft({
    eventDefinitions: [
      { key: 'PRODUCT_VIEW', label: '商品查看', category: 'FUNNEL', primary: true },
    ],
    metricDefinitions: [],
  }, {
    eventDefinitions: [
      { key: 'product_view', label: '商品查看', category: 'FUNNEL', primary: true },
      { key: 'pay_success', label: '支付成功', category: 'BUSINESS', primary: false },
    ],
    metricDefinitions: [
      {
        key: 'pay_rate',
        name: '支付率',
        aggregationType: 'RATE',
        numeratorEventType: 'pay_success',
        denominatorType: 'EVENT_COUNT',
        denominatorEventType: 'product_view',
        primaryMetric: true,
        guardrailMetric: false,
      },
    ],
  })

  assert.equal(result.importedEventCount, 1)
  assert.equal(result.importedMetricCount, 1)
  assert.equal(result.skippedMetricCount, 0)
  assert.deepEqual(result.draft.eventDefinitions.map(definition => definition.key), [
    'PRODUCT_VIEW',
    'PAY_SUCCESS',
  ])
  assert.equal(result.draft.eventDefinitions[1].primary, false)
  assert.equal(result.draft.metricDefinitions[0].key, 'PAY_RATE')
  assert.equal(result.draft.metricDefinitions[0].primaryMetric, true)
})

test('mergeApplicationDictionaryIntoDraft avoids creating multiple primary metrics', () => {
  const result = mergeApplicationDictionaryIntoDraft({
    eventDefinitions: [
      { key: 'PRODUCT_VIEW' },
      { key: 'PAY_SUCCESS' },
    ],
    metricDefinitions: [
      { key: 'VIEW_COUNT', primaryMetric: true },
    ],
  }, {
    metricDefinitions: [
      {
        key: 'PAY_RATE',
        name: '支付率',
        aggregationType: 'RATE',
        numeratorEventType: 'PAY_SUCCESS',
        denominatorType: 'EVENT_COUNT',
        denominatorEventType: 'PRODUCT_VIEW',
        primaryMetric: true,
      },
    ],
  })

  assert.equal(result.importedMetricCount, 1)
  assert.equal(result.draft.metricDefinitions[1].primaryMetric, false)
})

test('mergeApplicationDictionaryIntoDraft skips metrics that reference missing events', () => {
  const result = mergeApplicationDictionaryIntoDraft({
    eventDefinitions: [{ key: 'PRODUCT_VIEW' }],
    metricDefinitions: [],
  }, {
    metricDefinitions: [
      {
        key: 'PAY_RATE',
        name: '支付率',
        aggregationType: 'RATE',
        numeratorEventType: 'PAY_SUCCESS',
        denominatorType: 'EVENT_COUNT',
        denominatorEventType: 'PRODUCT_VIEW',
        primaryMetric: true,
      },
    ],
  })

  assert.equal(result.importedMetricCount, 0)
  assert.equal(result.skippedMetricCount, 1)
  assert.equal(result.draft.metricDefinitions.length, 0)
})
