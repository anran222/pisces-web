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
