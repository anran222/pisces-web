import { buildDefaultExperimentCreatePayload } from './aiDecisionTransformers.js'
import {
  getMetricReferencedEventKeys,
  mergeApplicationDictionaryIntoDraft,
} from './applicationDictionary.js'

const normalizeText = value => (typeof value === 'string' ? value.trim() : '')
const normalizeKey = value => normalizeText(value).toUpperCase()
const formatDescriptionSentence = (label, value) => {
  const text = normalizeText(value)
  if (!text) return ''
  return `${label}：${text}${/[。！？!?]$/.test(text) ? '' : '。'}`
}

const TARGET_METRIC_PRESETS = [
  { pattern: /加购/, eventKey: 'ADD_TO_CART', eventLabel: '加入购物车', metricKey: 'ADD_TO_CART_RATE' },
  { pattern: /支付|付款/, eventKey: 'PAYMENT_SUCCESS', eventLabel: '支付成功', metricKey: 'PAYMENT_CONVERSION_RATE' },
  { pattern: /下单|订单/, eventKey: 'ORDER_SUBMIT', eventLabel: '提交订单', metricKey: 'ORDER_CONVERSION_RATE' },
  { pattern: /点击/, eventKey: 'CTA_CLICK', eventLabel: '点击行动按钮', metricKey: 'CTA_CLICK_RATE' },
  { pattern: /注册/, eventKey: 'SIGN_UP', eventLabel: '完成注册', metricKey: 'SIGN_UP_RATE' },
]

const resolveMetricPreset = (primaryMetric) => (
  TARGET_METRIC_PRESETS.find(preset => preset.pattern.test(primaryMetric))
  || { eventKey: 'TARGET_CONVERSION', eventLabel: '完成目标行为', metricKey: 'TARGET_CONVERSION_RATE' }
)

const findMatchingMetric = (metrics, primaryMetric) => {
  const normalizedTarget = primaryMetric.replace(/转化率|比率|率/g, '')
  return metrics.find(metric => {
    const metricName = normalizeText(metric.name)
    return metricName === primaryMetric
      || (normalizedTarget && metricName.includes(normalizedTarget))
      || (metricName && primaryMetric.includes(metricName.replace(/转化率|比率|率/g, '')))
  })
}

const ensureEvent = (events, definition) => {
  if (!events.some(event => event.key === definition.key)) {
    events.push(definition)
  }
}

const buildEqualTrafficRatios = (groupCount) => {
  const precision = 1_000_000
  const baseRatio = Math.floor(precision / groupCount) / precision
  return Array.from({ length: groupCount }, (_, index) => (
    index === groupCount - 1
      ? Number((1 - baseRatio * (groupCount - 1)).toFixed(6))
      : baseRatio
  ))
}

const buildVariantGroupId = index => `variant_${String.fromCharCode(97 + index)}`

export const buildExperimentDraftFromVariantPlans = ({
  form = {},
  plans = [],
  dictionary = {},
  baseDate = new Date(),
} = {}) => {
  const candidatePlans = (Array.isArray(plans) ? plans : [])
    .filter(plan => plan && typeof plan === 'object')
  const effectivePlans = candidatePlans.length > 0 ? candidatePlans : [{ name: '候选方案' }]
  const firstPlan = effectivePlans[0]
  const appId = normalizeText(form.appId)
  const primaryMetric = normalizeText(form.primaryMetric || firstPlan.primaryMetric) || '目标转化率'
  const primaryMetricKey = normalizeKey(form.primaryMetricKey)
  const baseDraft = {
    ...buildDefaultExperimentCreatePayload(baseDate),
    appId,
  }
  const imported = mergeApplicationDictionaryIntoDraft(baseDraft, dictionary).draft
  const eventDefinitions = (imported.eventDefinitions || []).map(event => ({ ...event }))
  const metricDefinitions = (imported.metricDefinitions || []).map(metric => ({ ...metric }))
  const baselineEvent = eventDefinitions.find(event => event.primary) || eventDefinitions[0]
  const viewEvent = baselineEvent || {
    key: 'EXPERIMENT_VIEW',
    label: '实验页面曝光',
    description: `用户进入${normalizeText(form.placement) || '实验投放位置'}时记录`,
    category: 'FUNNEL',
    primary: true,
  }
  ensureEvent(eventDefinitions, viewEvent)

  let selectedMetric = metricDefinitions.find(metric => normalizeKey(metric.key) === primaryMetricKey)
    || findMatchingMetric(metricDefinitions, primaryMetric)
  if (!selectedMetric) {
    const preset = resolveMetricPreset(primaryMetric)
    ensureEvent(eventDefinitions, {
      key: preset.eventKey,
      label: preset.eventLabel,
      description: `用于计算${primaryMetric}的目标行为事件`,
      category: 'BUSINESS',
      primary: false,
    })
    selectedMetric = {
      key: preset.metricKey,
      name: primaryMetric,
      description: `${preset.eventLabel}人数或次数占${viewEvent.label}的比例`,
      aggregationType: 'RATE',
      numeratorEventType: preset.eventKey,
      denominatorType: 'EVENT_COUNT',
      denominatorEventType: viewEvent.key,
      primaryMetric: true,
      guardrailMetric: false,
    }
    metricDefinitions.push(selectedMetric)
  }

  const selectedMetricKey = normalizeKey(selectedMetric.key)
  const requestedGuardrailMetricKeys = Array.isArray(form.guardrailMetricKeys)
    ? new Set(form.guardrailMetricKeys.map(normalizeKey).filter(Boolean))
    : new Set(metricDefinitions
      .filter(metric => metric.guardrailMetric)
      .map(metric => normalizeKey(metric.key)))
  requestedGuardrailMetricKeys.delete(selectedMetricKey)
  const selectedMetricDefinitions = metricDefinitions
    .filter(metric => normalizeKey(metric.key) === selectedMetricKey
      || requestedGuardrailMetricKeys.has(normalizeKey(metric.key)))
    .map(metric => ({
      ...metric,
      primaryMetric: normalizeKey(metric.key) === selectedMetricKey,
      guardrailMetric: requestedGuardrailMetricKeys.has(normalizeKey(metric.key)),
    }))
  const selectedEventKeys = new Set(selectedMetricDefinitions
    .flatMap(getMetricReferencedEventKeys))
  const selectedEventDefinitions = eventDefinitions
    .filter(event => selectedEventKeys.has(normalizeKey(event.key)))
    .map(event => ({ ...event }))

  const placement = normalizeText(form.placement) || '待确认投放位置'
  const baseline = normalizeText(form.baseline) || '当前线上方案'
  const groupConfigSchema = [
    {
      key: 'proposal_content',
      label: '方案内容',
      valueType: 'STRING',
      required: true,
      description: `在${placement}展示的核心内容`,
      defaultValue: baseline,
    },
    {
      key: 'strategy_direction',
      label: '策略方向',
      valueType: 'STRING',
      required: true,
      description: '用于区分不同实验组的内容策略',
      defaultValue: '保持当前表达策略',
    },
    {
      key: 'placement',
      label: '投放位置',
      valueType: 'STRING',
      required: true,
      description: '实验内容实际生效的位置',
      defaultValue: placement,
    },
  ]
  const trafficRatios = buildEqualTrafficRatios(effectivePlans.length + 1)
  const groups = [
    {
      id: 'control',
      name: '当前方案',
      trafficRatio: trafficRatios[0],
      config: {
        proposal_content: baseline,
        strategy_direction: '保持当前表达策略',
        placement,
      },
    },
    ...effectivePlans.map((plan, index) => ({
      id: buildVariantGroupId(index),
      name: normalizeText(plan.name) || `方案 ${index + 1}`,
      trafficRatio: trafficRatios[index + 1],
      config: {
        proposal_content: plan.imageUrl || normalizeText(plan.content) || '待补充候选内容',
        strategy_direction: normalizeText(plan.strategy) || '采用候选方案策略',
        placement,
      },
    })),
  ]
  const guardrailMetricNames = selectedMetricDefinitions
    .filter(metric => metric.guardrailMetric)
    .map(metric => metric.name || metric.key)
  const startTime = normalizeText(form.startTime) || baseDraft.startTime
  const endTime = normalizeText(form.endTime) || baseDraft.endTime
  const description = [
    formatDescriptionSentence('业务目标', form.goal),
    formatDescriptionSentence('目标用户', form.audience),
    formatDescriptionSentence('实验假设', form.hypothesis || firstPlan.hypothesis),
    `主指标：${primaryMetric}${normalizeText(form.expectedLift || firstPlan.expectedLift) ? `，预期提升：${normalizeText(form.expectedLift || firstPlan.expectedLift)}` : ''}。`,
    guardrailMetricNames.length > 0 ? `护栏指标：${guardrailMetricNames.join('、')}。` : '',
    `实验周期：${startTime.replace('T', ' ')} 至 ${endTime.replace('T', ' ')}。`,
    formatDescriptionSentence('风险边界', form.riskGuardrail || firstPlan.risk),
    `候选分组：${effectivePlans.map(plan => normalizeText(plan.name)).filter(Boolean).join('、')}。`,
  ].filter(Boolean).join('')

  const draft = {
    ...baseDraft,
    appId,
    name: `${normalizeText(form.businessScenario) || '业务'}-${effectivePlans.length}方案实验`,
    description,
    startTime,
    endTime,
    eventDefinitions: selectedEventDefinitions,
    metricDefinitions: selectedMetricDefinitions,
    groupConfigSchema,
    groups,
    traffic: {
      strategy: 'HASH',
      totalTraffic: 1,
      allocation: groups.map(group => ({ group: group.id, ratio: group.trafficRatio })),
    },
  }

  return {
    draft,
    dictionary: {
      appId,
      eventDefinitions: selectedEventDefinitions.map(event => ({ ...event })),
      metricDefinitions: selectedMetricDefinitions.map(metric => ({ ...metric })),
    },
    summary: {
      eventCount: selectedEventDefinitions.length,
      metricCount: selectedMetricDefinitions.length,
      fieldCount: groupConfigSchema.length,
      groupCount: groups.length,
    },
  }
}

export const buildExperimentDraftFromVariantPlan = ({ plan = {}, ...options } = {}) => (
  buildExperimentDraftFromVariantPlans({ ...options, plans: [plan] })
)
