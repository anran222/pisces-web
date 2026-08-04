import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeApplicationDictionaryIntoDraft,
  selectApplicationDictionaryDefinitions,
} from './applicationDictionary.js'

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

test('selectApplicationDictionaryDefinitions keeps only selected definitions and metric dependencies', () => {
  const result = selectApplicationDictionaryDefinitions({}, {
    eventDefinitions: [
      { key: 'PRODUCT_VIEW', label: '浏览商品', primary: true },
      { key: 'ADD_TO_CART', label: '加入购物车' },
      { key: 'PAY_SUCCESS', label: '支付成功' },
    ],
    metricDefinitions: [
      {
        key: 'ADD_TO_CART_RATE',
        name: '加购率',
        aggregationType: 'RATE',
        numeratorEventType: 'ADD_TO_CART',
        denominatorType: 'EVENT_COUNT',
        denominatorEventType: 'PRODUCT_VIEW',
        primaryMetric: true,
      },
      {
        key: 'PAY_COUNT',
        name: '支付次数',
        aggregationType: 'COUNT',
        numeratorEventType: 'PAY_SUCCESS',
      },
    ],
  }, {
    eventKeys: [],
    metricKeys: ['ADD_TO_CART_RATE'],
  })

  assert.deepEqual(result.eventDefinitions.map(definition => definition.key), [
    'PRODUCT_VIEW',
    'ADD_TO_CART',
  ])
  assert.deepEqual(result.metricDefinitions.map(definition => definition.key), ['ADD_TO_CART_RATE'])
  assert.equal(result.metricDefinitions[0].primaryMetric, true)
})

test('selectApplicationDictionaryDefinitions supports changing the experiment primary metric', () => {
  const dictionary = {
    eventDefinitions: [
      { key: 'PRODUCT_VIEW', label: '浏览商品' },
      { key: 'ADD_TO_CART', label: '加入购物车' },
      { key: 'PAY_SUCCESS', label: '支付成功' },
    ],
    metricDefinitions: [
      { key: 'CART_COUNT', name: '加购次数', aggregationType: 'COUNT', numeratorEventType: 'ADD_TO_CART' },
      { key: 'PAY_COUNT', name: '支付次数', aggregationType: 'COUNT', numeratorEventType: 'PAY_SUCCESS' },
    ],
  }
  const result = selectApplicationDictionaryDefinitions({}, dictionary, {
    metricKeys: ['CART_COUNT', 'PAY_COUNT'],
    primaryMetricKey: 'PAY_COUNT',
  })

  assert.equal(result.metricDefinitions.find(definition => definition.key === 'CART_COUNT').primaryMetric, false)
  assert.equal(result.metricDefinitions.find(definition => definition.key === 'PAY_COUNT').primaryMetric, true)
})
