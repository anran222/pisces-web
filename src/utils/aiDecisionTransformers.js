const DEFAULT_STRATEGY = 'HASH'
const DEFAULT_TOTAL_TRAFFIC = 1
export const GROUP_CONFIG_VALUE_TYPES = ['STRING', 'INTEGER', 'BOOLEAN', 'OBJECT', 'JSON']
export const EVENT_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/
export const EVENT_CATEGORIES = ['FUNNEL', 'ENGAGEMENT', 'BUSINESS', 'GUARDRAIL', 'CUSTOM']
export const METRIC_AGGREGATION_TYPES = ['RATE', 'COUNT']
export const METRIC_DENOMINATOR_TYPES = ['EVENT_COUNT', 'VISITOR_COUNT', 'ASSIGNMENT_COUNT', 'EXPOSURE_COUNT']
export const GROUP_CONFIG_VALUE_TYPE_OPTIONS = [
  { value: 'STRING', label: '文本' },
  { value: 'INTEGER', label: '整数' },
  { value: 'BOOLEAN', label: '布尔值' },
  { value: 'OBJECT', label: '对象' },
  { value: 'JSON', label: 'JSON' }
]
export const EVENT_CATEGORY_OPTIONS = [
  { value: 'FUNNEL', label: '漏斗事件' },
  { value: 'ENGAGEMENT', label: '互动事件' },
  { value: 'BUSINESS', label: '业务事件' },
  { value: 'GUARDRAIL', label: '护栏事件' },
  { value: 'CUSTOM', label: '自定义事件' }
]
export const METRIC_AGGREGATION_TYPE_OPTIONS = [
  { value: 'RATE', label: '比率指标' },
  { value: 'COUNT', label: '数量指标' }
]
export const METRIC_DENOMINATOR_TYPE_OPTIONS = [
  { value: 'EVENT_COUNT', label: '按事件次数计算' },
  { value: 'VISITOR_COUNT', label: '按访客人数计算' },
  { value: 'ASSIGNMENT_COUNT', label: '按分流人数计算' },
  { value: 'EXPOSURE_COUNT', label: '按曝光人数计算' }
]
const DEFAULT_GROUP_RATIO = 0.5
const DEFAULT_GROUPS = [
  { id: 'control', name: '对照组', trafficRatio: DEFAULT_GROUP_RATIO, config: {} },
  { id: 'variant_a', name: '实验组A', trafficRatio: DEFAULT_GROUP_RATIO, config: {} }
]
const CONFIDENCE_LEVEL_MAP = {
  HIGH: 0.9,
  MEDIUM: 0.6,
  LOW: 0.3
}

const normalizeNumber = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return fallback
}

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const padNumber = (value) => String(value).padStart(2, '0')

const formatDateTimeLocal = (date) => {
  const value = date instanceof Date ? date : new Date(date)
  return [
    value.getFullYear(),
    padNumber(value.getMonth() + 1),
    padNumber(value.getDate())
  ].join('-') + `T${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`
}

const addDays = (date, days) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export const normalizeConfidence = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string') {
    return fallback
  }
  const normalizedValue = value.trim().toUpperCase()
  if (normalizedValue in CONFIDENCE_LEVEL_MAP) {
    return CONFIDENCE_LEVEL_MAP[normalizedValue]
  }
  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const buildTrafficAllocation = (groups = []) =>
  groups.map(group => ({
    group: group.id,
    ratio: normalizeNumber(group.trafficRatio)
  }))

export const buildEmptyGroupConfigField = () => ({
  key: '',
  label: '',
  valueType: 'STRING',
  required: false,
  description: '',
  defaultValue: ''
})

export const buildEmptyEventDefinition = () => ({
  key: '',
  label: '',
  description: '',
  category: 'BUSINESS',
  primary: false
})

export const buildEmptyMetricDefinition = () => ({
  key: '',
  name: '',
  description: '',
  aggregationType: 'RATE',
  numeratorEventType: '',
  denominatorType: 'EVENT_COUNT',
  denominatorEventType: '',
  primaryMetric: false,
  guardrailMetric: false
})

const normalizeSchemaValue = (valueType, value) => {
  if (value == null || value === '') {
    return null
  }
  switch (valueType) {
    case 'STRING':
      return String(value)
    case 'INTEGER': {
      const parsedValue = Number(value)
      return Number.isInteger(parsedValue) ? parsedValue : value
    }
    case 'BOOLEAN':
      if (typeof value === 'boolean') {
        return value
      }
      if (String(value).trim().toLowerCase() === 'true') {
        return true
      }
      if (String(value).trim().toLowerCase() === 'false') {
        return false
      }
      return value
    case 'OBJECT':
    case 'JSON':
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
      return value
    default:
      return value
  }
}

const normalizeGroupConfigSchema = (schema = []) => schema
  .map(field => {
    const key = normalizeText(field?.key)
    if (!key) {
      return null
    }
    return {
      key,
      label: normalizeText(field?.label),
      valueType: GROUP_CONFIG_VALUE_TYPES.includes(field?.valueType) ? field.valueType : 'STRING',
      required: Boolean(field?.required),
      description: normalizeText(field?.description),
      defaultValue: normalizeSchemaValue(field?.valueType || 'STRING', field?.defaultValue)
    }
  })
  .filter(Boolean)

const normalizeEventDefinitions = (eventDefinitions = []) => eventDefinitions
  .map((definition) => {
    const key = normalizeText(definition?.key).toUpperCase()
    if (!key) {
      return null
    }
    return {
      key,
      label: normalizeText(definition?.label),
      description: normalizeText(definition?.description),
      category: EVENT_CATEGORIES.includes(definition?.category) ? definition.category : 'BUSINESS',
      primary: Boolean(definition?.primary)
    }
  })
  .filter(Boolean)

const normalizeMetricDefinitions = (metricDefinitions = []) => metricDefinitions
  .map((definition) => {
    const key = normalizeText(definition?.key).toUpperCase()
    if (!key) {
      return null
    }
    return {
      key,
      name: normalizeText(definition?.name),
      description: normalizeText(definition?.description),
      aggregationType: METRIC_AGGREGATION_TYPES.includes(definition?.aggregationType)
        ? definition.aggregationType
        : 'RATE',
      numeratorEventType: normalizeText(definition?.numeratorEventType).toUpperCase(),
      denominatorType: METRIC_DENOMINATOR_TYPES.includes(definition?.denominatorType)
        ? definition.denominatorType
        : 'EVENT_COUNT',
      denominatorEventType: normalizeText(definition?.denominatorEventType).toUpperCase(),
      primaryMetric: Boolean(definition?.primaryMetric),
      guardrailMetric: Boolean(definition?.guardrailMetric)
    }
  })
  .filter(Boolean)

const normalizeGroupConfigs = (groups = [], schema = []) => {
  if (!schema.length) {
    return groups
  }
  return groups.map(group => {
    const normalizedConfig = {}
    const sourceConfig = group?.config || {}
    schema.forEach(field => {
      const rawValue = Object.prototype.hasOwnProperty.call(sourceConfig, field.key)
        ? sourceConfig[field.key]
        : field.defaultValue
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        return
      }
      normalizedConfig[field.key] = normalizeSchemaValue(field.valueType, rawValue)
    })
    return {
      ...group,
      config: normalizedConfig
    }
  })
}

export const buildDefaultExperimentCreatePayload = (baseDate = new Date()) => {
  const startDate = baseDate instanceof Date ? baseDate : new Date(baseDate)
  const groups = DEFAULT_GROUPS.map(group => ({ ...group, config: { ...group.config } }))

  return {
    name: '',
    description: '',
    layerId: '',
    startTime: formatDateTimeLocal(startDate),
    endTime: formatDateTimeLocal(addDays(startDate, 7)),
    eventDefinitions: [],
    metricDefinitions: [],
    groupConfigSchema: [],
    groups,
    traffic: {
      strategy: DEFAULT_STRATEGY,
      totalTraffic: DEFAULT_TOTAL_TRAFFIC,
      allocation: buildTrafficAllocation(groups)
    }
  }
}

export const buildExperimentDraftFromResponse = (experiment) => {
  if (!experiment) {
    return buildDefaultExperimentCreatePayload()
  }

  const groups = Object.entries(experiment.groups || {}).map(([groupId, group]) => ({
    id: group?.id || groupId,
    name: group?.name || groupId,
    trafficRatio: normalizeNumber(group?.trafficRatio, DEFAULT_GROUP_RATIO),
    config: { ...(group?.config || {}) }
  }))

  return {
    name: normalizeText(experiment.name),
    description: normalizeText(experiment.description),
    layerId: normalizeText(experiment.layerId),
    startTime: experiment.startTime ? formatDateTimeLocal(experiment.startTime) : buildDefaultExperimentCreatePayload().startTime,
    endTime: experiment.endTime ? formatDateTimeLocal(experiment.endTime) : buildDefaultExperimentCreatePayload().endTime,
    eventDefinitions: (experiment.eventDefinitions || []).map(definition => ({ ...definition })),
    metricDefinitions: (experiment.metricDefinitions || []).map(definition => ({ ...definition })),
    groupConfigSchema: (experiment.groupConfigSchema || []).map(field => ({ ...field })),
    groups,
    traffic: {
      strategy: experiment.traffic?.strategy || DEFAULT_STRATEGY,
      totalTraffic: experiment.traffic?.totalTraffic ?? DEFAULT_TOTAL_TRAFFIC,
      allocation: experiment.traffic?.allocation || buildTrafficAllocation(groups)
    }
  }
}

const buildDemoExperimentCard = (key, title, tone, summary, experiment) => {
  if (!experiment?.experimentId) {
    return null
  }

  return {
    key,
    tone,
    title,
    experimentId: experiment.experimentId,
    experimentName: experiment.experimentName || '示例实验',
    summary: experiment.aiSummary || summary,
    canGraduate: Boolean(experiment.canGraduate),
    canStop: Boolean(experiment.canStop),
    aiDecision: experiment.aiDecision || 'UNKNOWN',
    aiGuardrailStatus: experiment.aiGuardrailStatus || 'UNKNOWN',
    primaryMetricKey: experiment.primaryMetricKey || '-',
    groupCount: normalizeNumber(experiment.groupCount),
    schemaFieldCount: normalizeNumber(experiment.schemaFieldCount),
    baselineConversionRate: normalizeNumber(experiment.baselineConversionRate),
    winningConversionRate: normalizeNumber(experiment.winningConversionRate)
  }
}

export const buildDecisionWorkspaceModel = ({ statistics, diagnosis, graduation }) => {
  const summary = statistics?.summary || {}
  const quality = statistics?.dataQualityCheck || {}
  const blockingIssues = quality.blockingIssues || []
  const breachedGuardrails = summary.breachedGuardrails || []
  const fallbackSummary = quality.analysisReady
    ? '基础统计已就绪，等待 AI 决策结论。'
    : '分析尚未就绪，继续运行并累计样本。'
  const fallbackGuardrailStatus = blockingIssues.length > 0 || breachedGuardrails.length > 0
    ? 'BLOCKED'
    : (quality.analysisReady ? 'PASS' : 'UNKNOWN')

  return {
    hero: {
      decision: graduation?.decision || 'CONTINUE',
      guardrailStatus: graduation?.guardrailStatus
        || diagnosis?.guardrailStatus
        || fallbackGuardrailStatus,
      summary: graduation?.summary || diagnosis?.summary || fallbackSummary,
      confidence: graduation || diagnosis
        ? normalizeConfidence(graduation?.confidence ?? diagnosis?.confidence)
        : null,
      totalVisitors: normalizeNumber(summary.totalVisitors),
      bestGroup: summary.bestPerformingGroup || '-'
    },
    riskFlags: graduation?.riskFlags || diagnosis?.riskFlags || [...blockingIssues, ...breachedGuardrails],
    blockingIssues,
    actions: diagnosis?.recommendedActions || [],
    facts: {
      totalVisitors: normalizeNumber(summary.totalVisitors),
      bestConversionRate: normalizeNumber(summary.bestConversionRate),
      bestPrimaryMetricValue: summary.bestPrimaryMetricValue ?? null,
      primaryMetricKey: summary.primaryMetricKey || '-',
      analysisReady: Boolean(quality.analysisReady),
      srmDetected: Boolean(quality.srmDetected)
    }
  }
}

export const buildDemoExperimentCards = (response) => ([
  buildDemoExperimentCard(
    'qualified',
    '达标示例',
    'success',
    '已达到推进条件，可直接查看详情和分析结果。',
    response?.qualifiedExperiment
  ),
  buildDemoExperimentCard(
    'unqualified',
    '未达标示例',
    'warning',
    '当前不建议推进，可查看原因和风险提示。',
    response?.unqualifiedExperiment
  )
]).filter(Boolean)

export const buildExperimentCreatePayload = ({ experimentDraft }) => {
  const eventDefinitions = normalizeEventDefinitions(experimentDraft?.eventDefinitions || [])
  const metricDefinitions = normalizeMetricDefinitions(experimentDraft?.metricDefinitions || [])
  const groupConfigSchema = normalizeGroupConfigSchema(experimentDraft?.groupConfigSchema || [])
  const groups = normalizeGroupConfigs(experimentDraft?.groups || [], groupConfigSchema)
  const traffic = experimentDraft?.traffic || {}

  return {
    ...experimentDraft,
    eventDefinitions,
    metricDefinitions,
    groupConfigSchema,
    groups,
    traffic: {
      ...traffic,
      strategy: traffic.strategy || DEFAULT_STRATEGY,
      totalTraffic: traffic.totalTraffic ?? 1,
      allocation: traffic.allocation || buildTrafficAllocation(groups)
    }
  }
}

export const buildVariantCandidatePayload = ({
  variantType,
  goal,
  audience,
  count,
  constraintsText,
  sourceContextText,
  referenceImageInput
}) => {
  const constraints = String(constraintsText || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)

  const payload = {
    variantType,
    goal: String(goal || '').trim(),
    audience: String(audience || '').trim(),
    count: normalizeNumber(count, 1),
    constraints
  }

  const sourceContext = {}
  const brief = String(sourceContextText || '').trim()
  if (brief) {
    sourceContext.brief = brief
  }

  const referenceImage = String(referenceImageInput || '').trim()
  if (referenceImage && variantType === 'IMAGE') {
    sourceContext.imageBase64 = referenceImage
  }

  if (Object.keys(sourceContext).length > 0) {
    payload.sourceContext = sourceContext
  }

  return payload
}

const normalizeVariantCandidateText = (candidate) => {
  if (typeof candidate === 'string') {
    return candidate.trim()
  }
  if (!candidate || typeof candidate !== 'object') {
    return ''
  }

  return [
    normalizeText(candidate.title),
    normalizeText(candidate.content || candidate.text || candidate.copy || candidate.description),
    normalizeText(candidate.rationale || candidate.reason)
  ].filter(Boolean).join('\n')
}

const normalizeVariantCandidateImageUrl = (candidate) => {
  const value = typeof candidate === 'string'
    ? candidate
    : candidate?.imageUrl || candidate?.url || candidate?.content || candidate?.text
  return normalizeText(value)
}

export const normalizeVariantGenerationModelEvidence = (result) => {
  const selectedModel = normalizeText(result?.aiModel)
  const selectedApiMode = normalizeText(result?.aiApiMode)
  const primaryModel = normalizeText(result?.aiPrimaryModel)
  const fallbackModel = normalizeText(result?.aiFallbackModel)
  const modelStrategy = normalizeText(result?.aiModelStrategy)
  const attemptedModels = Array.isArray(result?.aiAttemptedModels)
    ? result.aiAttemptedModels.map(model => normalizeText(model)).filter(Boolean)
    : []

  if (!selectedModel && !selectedApiMode && !primaryModel && !fallbackModel && attemptedModels.length === 0) {
    return null
  }

  const fallbackUsed = typeof result?.aiFallbackUsed === 'boolean' ? result.aiFallbackUsed : null
  const normalizedAttemptedModels = attemptedModels.length > 0
    ? attemptedModels
    : [selectedModel].filter(Boolean)

  return {
    provider: normalizeText(result?.aiProvider) || 'tongyi',
    selectedModel,
    selectedApiMode,
    primaryModel,
    fallbackModel,
    fallbackUsed,
    attemptedModels: normalizedAttemptedModels,
    attemptedModelLabel: normalizedAttemptedModels.join(' -> '),
    modelStrategy,
    statusLabel: fallbackUsed ? '已回退' : (selectedModel.includes('preview') ? '预览模型' : '生产模型')
  }
}

export const normalizeVariantCandidates = (result, variantType = 'TEXT') => {
  const candidates = Array.isArray(result?.variants) ? result.variants : []
  return candidates
    .map((candidate, index) => {
      const explicitId = typeof candidate === 'object' && candidate
        ? candidate.id || candidate.variantId || candidate.key
        : ''
      const imageUrl = variantType === 'IMAGE' ? normalizeVariantCandidateImageUrl(candidate) : ''
      const text = variantType === 'IMAGE'
        ? normalizeVariantCandidateText(candidate) || imageUrl
        : normalizeVariantCandidateText(candidate)

      return {
        id: normalizeText(explicitId) || `candidate-${index}`,
        text,
        imageUrl
      }
    })
    .filter(candidate => candidate.text || candidate.imageUrl)
}
