import {
  EVENT_CATEGORIES,
  METRIC_AGGREGATION_TYPES,
  METRIC_DENOMINATOR_TYPES,
} from './aiDecisionTransformers.js'

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const normalizeKey = (value) => normalizeText(value).toUpperCase()

const normalizeEventCategory = (category) => (
  EVENT_CATEGORIES.includes(category) ? category : 'BUSINESS'
)

const normalizeAggregationType = (aggregationType) => (
  METRIC_AGGREGATION_TYPES.includes(aggregationType) ? aggregationType : 'RATE'
)

const normalizeDenominatorType = (denominatorType) => (
  METRIC_DENOMINATOR_TYPES.includes(denominatorType) ? denominatorType : 'EVENT_COUNT'
)

const buildEventKeySet = (eventDefinitions = []) => new Set(
  eventDefinitions
    .map(definition => normalizeKey(definition?.key))
    .filter(Boolean)
)

const buildMetricKeySet = (metricDefinitions = []) => new Set(
  metricDefinitions
    .map(definition => normalizeKey(definition?.key))
    .filter(Boolean)
)

const metricReferencesKnownEvents = (metricDefinition, eventKeys) => {
  const numeratorEventType = normalizeKey(metricDefinition?.numeratorEventType)
  if (!numeratorEventType || !eventKeys.has(numeratorEventType)) {
    return false
  }

  const denominatorType = normalizeDenominatorType(metricDefinition?.denominatorType)
  if (normalizeAggregationType(metricDefinition?.aggregationType) !== 'RATE'
    || denominatorType !== 'EVENT_COUNT') {
    return true
  }

  const denominatorEventType = normalizeKey(metricDefinition?.denominatorEventType)
  return Boolean(denominatorEventType && eventKeys.has(denominatorEventType))
}

const normalizeEventDefinition = (definition = {}) => ({
  key: normalizeKey(definition.key),
  label: normalizeText(definition.label),
  description: normalizeText(definition.description),
  category: normalizeEventCategory(definition.category),
  primary: Boolean(definition.primary),
})

const normalizeMetricDefinition = (definition = {}) => ({
  key: normalizeKey(definition.key),
  name: normalizeText(definition.name),
  description: normalizeText(definition.description),
  aggregationType: normalizeAggregationType(definition.aggregationType),
  numeratorEventType: normalizeKey(definition.numeratorEventType),
  denominatorType: normalizeDenominatorType(definition.denominatorType),
  denominatorEventType: normalizeKey(definition.denominatorEventType),
  primaryMetric: Boolean(definition.primaryMetric),
  guardrailMetric: Boolean(definition.guardrailMetric),
})

export const getMetricReferencedEventKeys = (metricDefinition = {}) => {
  const eventKeys = [normalizeKey(metricDefinition.numeratorEventType)].filter(Boolean)
  if (normalizeAggregationType(metricDefinition.aggregationType) === 'RATE'
    && normalizeDenominatorType(metricDefinition.denominatorType) === 'EVENT_COUNT') {
    const denominatorEventType = normalizeKey(metricDefinition.denominatorEventType)
    if (denominatorEventType) {
      eventKeys.push(denominatorEventType)
    }
  }
  return [...new Set(eventKeys)]
}

export const selectApplicationDictionaryDefinitions = (
  draft = {},
  dictionary = {},
  { eventKeys = [], metricKeys = [], primaryMetricKey = '' } = {}
) => {
  const dictionaryEvents = (dictionary.eventDefinitions || [])
    .map(normalizeEventDefinition)
    .filter(definition => definition.key)
  const dictionaryEventKeys = buildEventKeySet(dictionaryEvents)
  const dictionaryMetrics = (dictionary.metricDefinitions || [])
    .map(normalizeMetricDefinition)
    .filter(definition => definition.key && metricReferencesKnownEvents(definition, dictionaryEventKeys))
  const requestedEventKeys = new Set(eventKeys.map(normalizeKey).filter(Boolean))
  const requestedMetricKeys = new Set(metricKeys.map(normalizeKey).filter(Boolean))
  const existingMetrics = new Map((draft.metricDefinitions || [])
    .map(definition => [normalizeKey(definition?.key), definition]))
  const selectedMetrics = dictionaryMetrics
    .filter(definition => requestedMetricKeys.has(definition.key))

  selectedMetrics.forEach((definition) => {
    getMetricReferencedEventKeys(definition).forEach(key => requestedEventKeys.add(key))
  })

  const selectedEvents = dictionaryEvents
    .filter(definition => requestedEventKeys.has(definition.key))
    .map(definition => ({ ...definition }))
  const requestedPrimaryMetricKey = normalizeKey(primaryMetricKey)
  const currentPrimaryMetricKey = normalizeKey((draft.metricDefinitions || [])
    .find(definition => definition?.primaryMetric)?.key)
  const selectedMetricKeySet = buildMetricKeySet(selectedMetrics)
  const resolvedPrimaryMetricKey = [requestedPrimaryMetricKey, currentPrimaryMetricKey]
    .find(key => key && selectedMetricKeySet.has(key))
    || selectedMetrics.find(definition => definition.primaryMetric)?.key
    || selectedMetrics[0]?.key
    || ''

  return {
    ...draft,
    eventDefinitions: selectedEvents,
    metricDefinitions: selectedMetrics.map((definition) => {
      const existing = existingMetrics.get(definition.key)
      const isPrimaryMetric = definition.key === resolvedPrimaryMetricKey
      return {
        ...definition,
        primaryMetric: isPrimaryMetric,
        guardrailMetric: isPrimaryMetric
          ? false
          : Boolean(existing?.guardrailMetric ?? definition.guardrailMetric),
      }
    }),
  }
}

export const mergeApplicationDictionaryIntoDraft = (draft = {}, dictionary = {}) => {
  const eventDefinitions = (draft.eventDefinitions || []).map(definition => ({ ...definition }))
  const metricDefinitions = (draft.metricDefinitions || []).map(definition => ({ ...definition }))
  const eventKeys = buildEventKeySet(eventDefinitions)
  const metricKeys = buildMetricKeySet(metricDefinitions)
  let hasPrimaryEvent = eventDefinitions.some(definition => Boolean(definition?.primary))
  let hasPrimaryMetric = metricDefinitions.some(definition => Boolean(definition?.primaryMetric))
  let importedEventCount = 0
  let importedMetricCount = 0
  let skippedMetricCount = 0

  for (const dictionaryEvent of dictionary.eventDefinitions || []) {
    const key = normalizeKey(dictionaryEvent?.key)
    if (!key || eventKeys.has(key)) {
      continue
    }
    const primary = !hasPrimaryEvent && Boolean(dictionaryEvent.primary)
    eventDefinitions.push({
      key,
      label: normalizeText(dictionaryEvent.label),
      description: normalizeText(dictionaryEvent.description),
      category: normalizeEventCategory(dictionaryEvent.category),
      primary,
    })
    eventKeys.add(key)
    hasPrimaryEvent = hasPrimaryEvent || primary
    importedEventCount += 1
  }

  for (const dictionaryMetric of dictionary.metricDefinitions || []) {
    const key = normalizeKey(dictionaryMetric?.key)
    if (!key || metricKeys.has(key)) {
      continue
    }
    if (!metricReferencesKnownEvents(dictionaryMetric, eventKeys)) {
      skippedMetricCount += 1
      continue
    }

    const primaryMetric = !hasPrimaryMetric && Boolean(dictionaryMetric.primaryMetric)
    metricDefinitions.push({
      key,
      name: normalizeText(dictionaryMetric.name),
      description: normalizeText(dictionaryMetric.description),
      aggregationType: normalizeAggregationType(dictionaryMetric.aggregationType),
      numeratorEventType: normalizeKey(dictionaryMetric.numeratorEventType),
      denominatorType: normalizeDenominatorType(dictionaryMetric.denominatorType),
      denominatorEventType: normalizeKey(dictionaryMetric.denominatorEventType),
      primaryMetric,
      guardrailMetric: Boolean(dictionaryMetric.guardrailMetric),
    })
    metricKeys.add(key)
    hasPrimaryMetric = hasPrimaryMetric || primaryMetric
    importedMetricCount += 1
  }

  return {
    draft: {
      ...draft,
      eventDefinitions,
      metricDefinitions,
    },
    importedEventCount,
    importedMetricCount,
    skippedMetricCount,
  }
}
