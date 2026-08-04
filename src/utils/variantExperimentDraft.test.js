import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExperimentDraftFromVariantPlan,
  buildExperimentDraftFromVariantPlans,
} from './variantExperimentDraft.js'

test('buildExperimentDraftFromVariantPlan creates a complete experiment draft', () => {
  const result = buildExperimentDraftFromVariantPlan({
    form: {
      appId: 'shop-app',
      businessScenario: '二手手机售卖',
      placement: '商品详情页首屏',
      goal: '提升加购转化率',
      audience: '关注质量保障的用户',
      baseline: '当前只展示价格',
      primaryMetric: '加购转化率',
      expectedLift: '5% - 8%',
      riskGuardrail: '关注退款申请率',
    },
    plan: {
      name: '质检信任强化方案',
      strategy: '前置质检背书',
      content: '官方99道质检，附完整报告',
      hypothesis: '质检透明度能降低质量顾虑',
      risk: '不得夸大质检范围',
      primaryMetric: '加购转化率',
      expectedLift: '5% - 8%',
    },
    dictionary: {
      eventDefinitions: [
        { key: 'PRODUCT_DETAIL_VIEW', label: '浏览商品详情', category: 'FUNNEL', primary: true },
        { key: 'REFUND_REQUEST', label: '发起退款', category: 'GUARDRAIL', primary: false },
      ],
      metricDefinitions: [
        {
          key: 'REFUND_REQUEST_RATE',
          name: '退款申请率',
          aggregationType: 'RATE',
          numeratorEventType: 'REFUND_REQUEST',
          denominatorType: 'EVENT_COUNT',
          denominatorEventType: 'PRODUCT_DETAIL_VIEW',
          guardrailMetric: true,
        },
      ],
    },
    baseDate: new Date('2026-08-04T08:00:00'),
  })

  assert.equal(result.draft.appId, 'shop-app')
  assert.equal(result.draft.eventDefinitions.some(event => event.key === 'ADD_TO_CART'), true)
  assert.equal(result.draft.metricDefinitions.find(metric => metric.key === 'ADD_TO_CART_RATE').primaryMetric, true)
  assert.equal(result.draft.metricDefinitions.find(metric => metric.key === 'REFUND_REQUEST_RATE').guardrailMetric, true)
  assert.equal(result.draft.groupConfigSchema.length, 3)
  assert.equal(result.draft.groups.length, 2)
  assert.equal(result.draft.groups[0].config.proposal_content, '当前只展示价格')
  assert.equal(result.draft.groups[1].config.proposal_content, '官方99道质检，附完整报告')
  assert.deepEqual(result.draft.traffic.allocation, [
    { group: 'control', ratio: 0.5 },
    { group: 'variant_a', ratio: 0.5 },
  ])
  assert.deepEqual(result.summary, {
    eventCount: 3,
    metricCount: 2,
    fieldCount: 3,
    groupCount: 2,
  })
})

test('buildExperimentDraftFromVariantPlans imports every plan with selected metrics and period', () => {
  const result = buildExperimentDraftFromVariantPlans({
    form: {
      appId: 'shop-app',
      businessScenario: '二手手机售卖',
      placement: '商品详情页首屏',
      goal: '提升加购转化率',
      audience: '关注质量保障的用户',
      baseline: '当前只展示价格',
      hypothesis: '强化保障信息可以降低用户疑虑',
      primaryMetricKey: 'ADD_TO_CART_RATE',
      primaryMetric: '加购转化率',
      guardrailMetricKeys: ['REFUND_REQUEST_RATE'],
      expectedLift: '5% - 8%',
      startTime: '2026-08-05T09:00',
      endTime: '2026-08-19T09:00',
    },
    plans: [
      { name: '质检透明方案', strategy: '强化质检', content: '展示完整质检报告' },
      { name: '售后保障方案', strategy: '强化售后', content: '突出一年质保' },
      { name: '价格信任方案', strategy: '强化价格', content: '展示价格评估依据' },
    ],
    dictionary: {
      eventDefinitions: [
        { key: 'PRODUCT_DETAIL_VIEW', label: '浏览商品详情', category: 'FUNNEL', primary: true },
        { key: 'ADD_TO_CART', label: '加入购物车', category: 'FUNNEL', primary: false },
        { key: 'REFUND_REQUEST', label: '发起退款', category: 'GUARDRAIL', primary: false },
      ],
      metricDefinitions: [
        {
          key: 'ADD_TO_CART_RATE',
          name: '加购转化率',
          aggregationType: 'RATE',
          numeratorEventType: 'ADD_TO_CART',
          denominatorType: 'EVENT_COUNT',
          denominatorEventType: 'PRODUCT_DETAIL_VIEW',
          primaryMetric: true,
        },
        {
          key: 'REFUND_REQUEST_RATE',
          name: '退款申请率',
          aggregationType: 'RATE',
          numeratorEventType: 'REFUND_REQUEST',
          denominatorType: 'EVENT_COUNT',
          denominatorEventType: 'PRODUCT_DETAIL_VIEW',
          guardrailMetric: true,
        },
        {
          key: 'DETAIL_STAY_TIME',
          name: '详情停留时长',
          aggregationType: 'AVERAGE',
          primaryMetric: false,
          guardrailMetric: false,
        },
      ],
    },
  })

  assert.equal(result.draft.startTime, '2026-08-05T09:00')
  assert.equal(result.draft.endTime, '2026-08-19T09:00')
  assert.deepEqual(result.draft.groups.map(group => group.id), [
    'control',
    'variant_a',
    'variant_b',
    'variant_c',
  ])
  assert.deepEqual(result.draft.groups.map(group => group.name), [
    '当前方案',
    '质检透明方案',
    '售后保障方案',
    '价格信任方案',
  ])
  assert.deepEqual(result.draft.groups.map(group => group.trafficRatio), [0.25, 0.25, 0.25, 0.25])
  assert.deepEqual(result.draft.traffic.allocation, [
    { group: 'control', ratio: 0.25 },
    { group: 'variant_a', ratio: 0.25 },
    { group: 'variant_b', ratio: 0.25 },
    { group: 'variant_c', ratio: 0.25 },
  ])
  assert.deepEqual(result.draft.metricDefinitions.map(metric => metric.key), [
    'ADD_TO_CART_RATE',
    'REFUND_REQUEST_RATE',
  ])
  assert.deepEqual(result.draft.eventDefinitions.map(event => event.key), [
    'PRODUCT_DETAIL_VIEW',
    'ADD_TO_CART',
    'REFUND_REQUEST',
  ])
  assert.equal(result.draft.metricDefinitions[0].primaryMetric, true)
  assert.equal(result.draft.metricDefinitions[1].guardrailMetric, true)
  assert.equal(result.draft.description.includes('实验周期：2026-08-05 09:00 至 2026-08-19 09:00'), true)
  assert.equal(result.draft.description.includes('。。'), false)
  assert.deepEqual(result.summary, {
    eventCount: 3,
    metricCount: 2,
    fieldCount: 3,
    groupCount: 4,
  })
})
