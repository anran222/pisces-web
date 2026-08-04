import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { applicationAPI, experimentAPI } from '../services/api'
import {
  buildEmptyGroupConfigField,
  buildDefaultExperimentCreatePayload,
  buildExperimentCreatePayload,
  EVENT_CATEGORY_OPTIONS,
  EVENT_KEY_PATTERN,
  GROUP_CONFIG_VALUE_TYPE_OPTIONS,
  METRIC_AGGREGATION_TYPE_OPTIONS,
  METRIC_DENOMINATOR_TYPE_OPTIONS
} from '../utils/aiDecisionTransformers'
import DemoExperimentPanel from '../components/DemoExperimentPanel'
import {
  buildEditableGroupSummary,
  buildExperimentGroupTrafficAllocation,
  buildNextExperimentGroup,
  getEditableGroupPanelKey,
  rebalanceExperimentGroupTraffic
} from '../utils/editableGroupUtils'
import {
  getMetricReferencedEventKeys,
  selectApplicationDictionaryDefinitions,
} from '../utils/applicationDictionary'
import {
  getValueTypeLabel,
  localizeSystemText,
  TRAFFIC_STRATEGY_OPTIONS,
} from '../utils/uiLabels'

const DEFAULT_TRAFFIC_STRATEGY = 'HASH'
const DEFAULT_TOTAL_TRAFFIC = 1

const normalizeTraffic = (traffic = {}, groups = []) => ({
  strategy: traffic.strategy || DEFAULT_TRAFFIC_STRATEGY,
  totalTraffic: Number.isFinite(Number(traffic.totalTraffic)) ? Number(traffic.totalTraffic) : DEFAULT_TOTAL_TRAFFIC,
  allocation: buildExperimentGroupTrafficAllocation(groups)
})

const normalizeNumberInput = (value, fallback) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

const getOptionLabel = (options, value, fallback = value) => (
  options.find(option => option.value === value)?.label || fallback
)

const formatEditableValue = (value, valueType) => {
  if (value === null || value === undefined) {
    return ''
  }
  if ((valueType === 'OBJECT' || valueType === 'JSON') && typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  if (valueType === 'BOOLEAN' && typeof value === 'boolean') {
    return String(value)
  }
  return String(value)
}

const getMissingRequiredDraftMessage = (draftPayload) => {
  const eventDefinitions = draftPayload?.eventDefinitions || []
  const metricDefinitions = draftPayload?.metricDefinitions || []
  const groups = draftPayload?.groups || []
  const primaryMetricCount = metricDefinitions.filter(metric => metric?.primaryMetric).length

  if (!normalizeText(draftPayload?.appId)) {
    return '请选择应用空间'
  }
  if (!normalizeText(draftPayload?.name)) {
    return '请填写实验名称'
  }
  if (groups.length < 2) {
    return '请至少保留两个实验组'
  }
  if (groups.some(group => !normalizeText(group?.id) || !normalizeText(group?.name))) {
    return '请完整填写实验组标识和名称'
  }
  if (new Set(groups.map(group => normalizeText(group.id))).size !== groups.length) {
    return '实验组标识不能重复'
  }
  const totalGroupTraffic = groups.reduce((total, group) => total + Number(group.trafficRatio || 0), 0)
  if (Math.abs(totalGroupTraffic - 1) > 0.001) {
    return '实验组流量比例之和必须为 1'
  }
  const requiredSchemaFields = (draftPayload?.groupConfigSchema || [])
    .filter(field => field?.required && normalizeText(field?.key))
  for (const group of groups) {
    for (const field of requiredSchemaFields) {
      const fieldValue = group?.config?.[field.key]
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        return `实验组「${group.name || group.id}」缺少必填字段「${field.label || field.key}」`
      }
    }
  }
  if (eventDefinitions.length === 0) {
    return '请至少定义一个事件'
  }
  for (const eventDefinition of eventDefinitions) {
    if (!normalizeText(eventDefinition?.key) || !normalizeText(eventDefinition?.label)) {
      return '请完整填写事件定义'
    }
    if (!EVENT_KEY_PATTERN.test(normalizeText(eventDefinition.key).toUpperCase())) {
      return '事件编码只支持大写字母、数字和下划线'
    }
  }

  if (metricDefinitions.length === 0) {
    return '请至少定义一个指标'
  }
  if (primaryMetricCount !== 1) {
    return '必须且只能选择一个主指标'
  }
  for (const metricDefinition of metricDefinitions) {
    if (!normalizeText(metricDefinition?.key) || !normalizeText(metricDefinition?.name)) {
      return '请完整填写指标定义'
    }
    if (!EVENT_KEY_PATTERN.test(normalizeText(metricDefinition.key).toUpperCase())) {
      return '指标编码只支持大写字母、数字和下划线'
    }
    if (!normalizeText(metricDefinition?.numeratorEventType)) {
      return '请为指标选择事件'
    }
    if (metricDefinition?.aggregationType === 'RATE' && metricDefinition?.denominatorType === 'EVENT_COUNT'
      && !normalizeText(metricDefinition?.denominatorEventType)) {
      return '比率指标需要选择分母事件'
    }
  }

  return ''
}

export default function CreateExperiment() {
  const navigate = useNavigate()
  const location = useLocation()
  const [creating, setCreating] = useState(false)
  const [draftPayload, setDraftPayload] = useState(() => buildDefaultExperimentCreatePayload())
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [applicationDictionary, setApplicationDictionary] = useState(null)
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState('')
  const [expandedDraftGroupPanels, setExpandedDraftGroupPanels] = useState({})
  const [activeDraftPanel, setActiveDraftPanel] = useState('basics')
  const [demoDialogOpen, setDemoDialogOpen] = useState(false)
  const [importedVariantPlanName, setImportedVariantPlanName] = useState('')
  const [importedVariantSummary, setImportedVariantSummary] = useState(null)

  useEffect(() => {
    loadApplicationSpaces()
  }, [])

  useEffect(() => {
    const appId = normalizeText(draftPayload?.appId)
    if (!appId) {
      setApplicationDictionary(null)
      return undefined
    }

    let active = true
    setDictionaryLoading(true)
    setDictionaryError('')
    applicationAPI.getDictionary(appId)
      .then((responseData) => {
        if (!active) return
        const dictionary = responseData.data || responseData || {}
        setApplicationDictionary(dictionary)
        setDraftPayload((current) => {
          if (normalizeText(current?.appId) !== appId) return current
          return selectApplicationDictionaryDefinitions(current, dictionary, {
            eventKeys: (current.eventDefinitions || []).map(definition => definition.key),
            metricKeys: (current.metricDefinitions || []).map(definition => definition.key),
          })
        })
      })
      .catch((error) => {
        if (!active) return
        setApplicationDictionary(null)
        setDictionaryError(localizeSystemText(error.response?.data?.message || error.message || '应用字典加载失败'))
      })
      .finally(() => {
        if (active) setDictionaryLoading(false)
      })

    return () => {
      active = false
    }
  }, [draftPayload?.appId])

  useEffect(() => {
    const experimentDraft = location.state?.experimentDraft
    if (experimentDraft) {
      setDraftPayload(experimentDraft)
      setApplicationDictionary(location.state?.applicationDictionary || null)
      setImportedVariantPlanName(location.state?.importedVariantPlan?.name || '候选方案')
      setImportedVariantSummary(location.state?.importedVariantPlan?.summary || null)
      setActiveDraftPanel('basics')
      navigate('/ai-design', { replace: true, state: null })
      return
    }
    const variantPlan = location.state?.variantPlan
    if (!variantPlan) {
      return
    }
    setDraftPayload(current => {
      const baseDraft = current || buildDefaultExperimentCreatePayload()
      const baseGroups = baseDraft.groups?.length >= 2
        ? baseDraft.groups
        : buildDefaultExperimentCreatePayload().groups
      const planField = {
        key: 'proposal_content',
        label: '方案内容',
        valueType: 'STRING',
        required: true,
        description: variantPlan.placement ? `投放位置：${variantPlan.placement}` : '本次实验投放的方案内容',
        defaultValue: variantPlan.baseline || '当前线上方案'
      }
      return {
        ...baseDraft,
        appId: variantPlan.appId || baseDraft.appId || '',
        name: variantPlan.experimentName || baseDraft.name || '候选方案实验',
        description: [variantPlan.description, variantPlan.risk ? `风险护栏：${variantPlan.risk}` : '']
          .filter(Boolean)
          .join(' '),
        groupConfigSchema: [
          ...(baseDraft.groupConfigSchema || []).filter(field => field.key !== planField.key),
          planField
        ],
        groups: baseGroups.map((group, index) => ({
          ...group,
          name: index === 0 ? '当前方案' : (index === 1 ? (variantPlan.planName || '候选方案') : group.name),
          config: {
            ...(group.config || {}),
            proposal_content: index === 0
              ? (variantPlan.baseline || '当前线上方案')
              : (variantPlan.candidateContent || '')
          }
        }))
      }
    })
    setImportedVariantPlanName(variantPlan.planName || '候选方案')
    setActiveDraftPanel('basics')
    navigate('/ai-design', { replace: true, state: null })
  }, [])

  const replaceDraft = (nextDraft) => {
    setDraftPayload(current => ({
      ...buildExperimentCreatePayload({ experimentDraft: nextDraft }),
      appId: nextDraft?.appId || current?.appId || ''
    }))
    setApplicationDictionary(null)
    setDictionaryError('')
  }

  const loadApplicationSpaces = async () => {
    try {
      const responseData = await applicationAPI.list()
      const spaces = responseData.data || responseData || []
      setApplicationSpaces(spaces)
      if (spaces.length > 0) {
        setDraftPayload(current => (
          normalizeText(current.appId) ? current : { ...current, appId: spaces[0].appId }
        ))
      }
    } catch (error) {
      setDictionaryError(localizeSystemText(error.response?.data?.message || error.message || '应用空间加载失败'))
    }
  }

  const updateDraftField = (field, value) => {
    setDraftPayload(current => ({
      ...current,
      [field]: value
    }))
  }

  const updateDraftAppId = (value) => {
    setDraftPayload(current => ({
      ...current,
      appId: value,
      eventDefinitions: [],
      metricDefinitions: [],
    }))
    setApplicationDictionary(null)
    setDictionaryError('')
  }

  const loadApplicationDictionary = async (appId = draftPayload?.appId) => {
    const normalizedAppId = normalizeText(appId)
    if (!normalizedAppId) {
      alert('请先选择应用标识')
      return
    }
    try {
      setDictionaryLoading(true)
      setDictionaryError('')
      const responseData = await applicationAPI.getDictionary(normalizedAppId)
      const dictionary = responseData.data || responseData || {}
      setApplicationDictionary(dictionary)
      setDraftPayload(current => selectApplicationDictionaryDefinitions(current, dictionary, {
        eventKeys: (current.eventDefinitions || []).map(definition => definition.key),
        metricKeys: (current.metricDefinitions || []).map(definition => definition.key),
      }))
    } catch (error) {
      setApplicationDictionary(null)
      setDictionaryError(localizeSystemText(error.response?.data?.message || error.message || '应用字典加载失败'))
    } finally {
      setDictionaryLoading(false)
    }
  }

  const updateDictionarySelection = ({ eventKeys, metricKeys, primaryMetricKey = '' }) => {
    if (!applicationDictionary) return
    setDraftPayload(current => selectApplicationDictionaryDefinitions(current, applicationDictionary, {
      eventKeys,
      metricKeys,
      primaryMetricKey,
    }))
  }

  const selectAllDictionaryDefinitions = () => {
    updateDictionarySelection({
      eventKeys: (applicationDictionary?.eventDefinitions || []).map(definition => definition.key),
      metricKeys: (applicationDictionary?.metricDefinitions || []).map(definition => definition.key),
    })
  }

  const clearDictionarySelection = () => {
    updateDictionarySelection({ eventKeys: [], metricKeys: [] })
  }

  const toggleDictionaryEvent = (eventKey) => {
    const normalizedEventKey = normalizeText(eventKey).toUpperCase()
    const selectedEventKeys = new Set((draftPayload.eventDefinitions || [])
      .map(definition => normalizeText(definition.key).toUpperCase()))
    const selectedMetricKeys = (draftPayload.metricDefinitions || [])
      .filter(metric => !selectedEventKeys.has(normalizedEventKey)
        || !getMetricReferencedEventKeys(metric).includes(normalizedEventKey))
      .map(metric => metric.key)
    if (selectedEventKeys.has(normalizedEventKey)) {
      selectedEventKeys.delete(normalizedEventKey)
    } else {
      selectedEventKeys.add(normalizedEventKey)
    }
    updateDictionarySelection({ eventKeys: [...selectedEventKeys], metricKeys: selectedMetricKeys })
  }

  const toggleDictionaryMetric = (metricKey) => {
    const normalizedMetricKey = normalizeText(metricKey).toUpperCase()
    const selectedMetricKeys = new Set((draftPayload.metricDefinitions || [])
      .map(definition => normalizeText(definition.key).toUpperCase()))
    if (selectedMetricKeys.has(normalizedMetricKey)) {
      selectedMetricKeys.delete(normalizedMetricKey)
    } else {
      selectedMetricKeys.add(normalizedMetricKey)
    }
    updateDictionarySelection({
      eventKeys: (draftPayload.eventDefinitions || []).map(definition => definition.key),
      metricKeys: [...selectedMetricKeys],
    })
  }

  const selectPrimaryMetric = (metricKey) => {
    updateDictionarySelection({
      eventKeys: (draftPayload.eventDefinitions || []).map(definition => definition.key),
      metricKeys: (draftPayload.metricDefinitions || []).map(definition => definition.key),
      primaryMetricKey: metricKey,
    })
  }

  const updateTrafficField = (field, value) => {
    setDraftPayload(current => ({
      ...current,
      traffic: {
        ...current.traffic,
        [field]: field === 'totalTraffic'
          ? normalizeNumberInput(value, current.traffic?.totalTraffic ?? DEFAULT_TOTAL_TRAFFIC)
          : value
      }
    }))
  }

  const updateGroupField = (index, field, value) => {
    setDraftPayload(current => {
      const groups = (current.groups || []).map((group, groupIndex) => {
        if (groupIndex !== index) {
          return group
        }
        return {
          ...group,
          [field]: field === 'trafficRatio'
            ? normalizeNumberInput(value, group.trafficRatio)
            : value
        }
      })
      return {
        ...current,
        groups,
        traffic: normalizeTraffic(current.traffic, groups)
      }
    })
  }

  const addExperimentGroup = () => {
    setDraftPayload(current => {
      const nextGroup = buildNextExperimentGroup(current.groups || [])
      const groups = rebalanceExperimentGroupTraffic([...(current.groups || []), nextGroup])
      return {
        ...current,
        groups,
        traffic: normalizeTraffic(current.traffic, groups)
      }
    })
  }

  const removeExperimentGroup = (index) => {
    setDraftPayload(current => {
      if ((current.groups || []).length <= 2) {
        return current
      }
      const groups = rebalanceExperimentGroupTraffic(
        (current.groups || []).filter((_, groupIndex) => groupIndex !== index)
      )
      return {
        ...current,
        groups,
        traffic: normalizeTraffic(current.traffic, groups)
      }
    })
  }

  const addSchemaFieldFromGroups = () => {
    addSchemaField()
    setActiveDraftPanel('schema')
  }

  const addSchemaField = () => {
    setDraftPayload(current => ({
      ...current,
      groupConfigSchema: [...(current.groupConfigSchema || []), buildEmptyGroupConfigField()]
    }))
  }

  const updateSchemaField = (index, field, value) => {
    setDraftPayload(current => {
      const currentSchema = [...(current.groupConfigSchema || [])]
      const previousField = currentSchema[index] || buildEmptyGroupConfigField()
      const nextField = {
        ...previousField,
        [field]: field === 'required' ? Boolean(value) : value
      }
      currentSchema[index] = nextField

      let groups = current.groups || []
      if (field === 'key') {
        const previousKey = normalizeText(previousField.key)
        const nextKey = normalizeText(value)
        if (previousKey !== nextKey) {
          groups = groups.map(group => {
            const nextConfig = { ...(group.config || {}) }
            if (previousKey && Object.prototype.hasOwnProperty.call(nextConfig, previousKey)) {
              const previousValue = nextConfig[previousKey]
              delete nextConfig[previousKey]
              if (nextKey) {
                nextConfig[nextKey] = previousValue
              }
            }
            return {
              ...group,
              config: nextConfig
            }
          })
        }
      }

      return {
        ...current,
        groupConfigSchema: currentSchema,
        groups
      }
    })
  }

  const removeSchemaField = (index) => {
    setDraftPayload(current => {
      const currentSchema = [...(current.groupConfigSchema || [])]
      const removedField = currentSchema[index]
      currentSchema.splice(index, 1)
      const removedKey = normalizeText(removedField?.key)
      const groups = (current.groups || []).map(group => {
        const nextConfig = { ...(group.config || {}) }
        if (removedKey) {
          delete nextConfig[removedKey]
        }
        return {
          ...group,
          config: nextConfig
        }
      })
      return {
        ...current,
        groupConfigSchema: currentSchema,
        groups
      }
    })
  }

  const updateGroupConfigValue = (groupIndex, fieldKey, value) => {
    setDraftPayload(current => {
      const groups = (current.groups || []).map((group, index) => {
        if (index !== groupIndex) {
          return group
        }
        return {
          ...group,
          config: {
            ...(group.config || {}),
            [fieldKey]: value
          }
        }
      })
      return {
        ...current,
        groups
      }
    })
  }

  const toggleDraftGroupPanel = (groupKey) => {
    setExpandedDraftGroupPanels(current => ({
      ...current,
      [groupKey]: !current[groupKey]
    }))
  }

  const handleResetManualDraft = () => {
    replaceDraft(buildDefaultExperimentCreatePayload())
    setExpandedDraftGroupPanels({})
    setImportedVariantPlanName('')
    setImportedVariantSummary(null)
  }

  const handleCreateExperiment = async () => {
    if (!draftPayload) {
      return
    }
    const missingRequiredDraftMessage = getMissingRequiredDraftMessage(draftPayload)
    if (missingRequiredDraftMessage) {
      alert(missingRequiredDraftMessage)
      return
    }

    try {
      setCreating(true)
      const payload = buildExperimentCreatePayload({ experimentDraft: draftPayload })
      const result = await experimentAPI.create(payload)
      const created = result.data || result
      const experimentId = created.id || created.experimentId
      if (experimentId) {
        navigate(`/experiments/${experimentId}`)
        return
      }
      navigate('/experiments')
    } catch (error) {
      alert('创建实验失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setCreating(false)
    }
  }

  const draftGroups = draftPayload?.groups || []
  const eventDefinitions = draftPayload?.eventDefinitions || []
  const metricDefinitions = draftPayload?.metricDefinitions || []
  const groupConfigSchema = draftPayload?.groupConfigSchema || []
  const selectedApplicationSpace = applicationSpaces.find(space => space.appId === draftPayload?.appId)
  const dictionaryEventDefinitions = applicationDictionary?.eventDefinitions || []
  const dictionaryMetricDefinitions = applicationDictionary?.metricDefinitions || []
  const dictionaryEventCount = dictionaryEventDefinitions.length
  const dictionaryMetricCount = dictionaryMetricDefinitions.length
  const selectedEventKeys = new Set(eventDefinitions
    .map(definition => normalizeText(definition?.key).toUpperCase()))
  const selectedMetricKeys = new Set(metricDefinitions
    .map(definition => normalizeText(definition?.key).toUpperCase()))
  const dictionaryEventLabels = new Map(dictionaryEventDefinitions.map(definition => [
    normalizeText(definition?.key).toUpperCase(),
    definition?.label || definition?.key || '未命名事件',
  ]))
  const draftEditorTabs = [
    { key: 'basics', label: '基础', meta: draftPayload?.appId || '未选应用' },
    { key: 'dictionary', label: '字典', meta: applicationDictionary ? `${dictionaryEventCount}/${dictionaryMetricCount}` : '未加载' },
    { key: 'events', label: '事件', meta: `${eventDefinitions.length}` },
    { key: 'metrics', label: '指标', meta: `${metricDefinitions.length}` },
    { key: 'schema', label: '字段', meta: `${groupConfigSchema.length}` },
    { key: 'groups', label: '分组', meta: `${draftGroups.length}` }
  ]

  return (
    <div className="space-y-6">
      <section className="glass-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
            >
              直接填写
            </button>
            <button
              type="button"
              onClick={() => navigate('/variants-lab')}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/70 hover:text-slate-900"
            >
              生成方案
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button onClick={handleResetManualDraft} className="btn-secondary shrink-0">
              <PencilLine size={18} />
              恢复默认配置
            </button>
            <button
              type="button"
              onClick={() => setDemoDialogOpen(true)}
              className="btn-secondary shrink-0"
            >
              <Sparkles size={18} />
              示例实验
            </button>
          </div>
        </div>
      </section>

      {demoDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6" role="dialog" aria-modal="true">
          <div className="relative max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-[1.4rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              title="关闭示例实验"
              aria-label="关闭示例实验"
              onClick={() => setDemoDialogOpen(false)}
              className="absolute right-4 top-4 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
            >
              <X size={18} />
            </button>
            <DemoExperimentPanel
              embedded
              compact
              title="快速生成示例实验"
              description="需要快速演示时，可以直接生成两组示例实验，再进入详情和分析页查看结果。"
              buttonLabel="生成示例实验"
            />
          </div>
        </div>
      )}

      <section className="glass-card p-5">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="signal-label">实验草稿</p>
              <h2 className="section-title mt-2">实验配置</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <button onClick={handleCreateExperiment} disabled={creating} className="btn-primary shrink-0">
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                创建实验
              </button>
            </div>
          </div>

          <div className="space-y-5">
              <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <div className="flex min-w-max gap-1">
                  {draftEditorTabs.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveDraftPanel(tab.key)}
                      className={`flex min-w-[112px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition ${activeDraftPanel === tab.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                      }`}
                    >
                      <span className="font-medium">{tab.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tab.meta}</span>
                    </button>
                  ))}
                </div>
              </nav>

              <div>
                {activeDraftPanel === 'basics' && (
                  <div className="grid gap-4 md:grid-cols-2">
                {importedVariantPlanName ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#cde5d7] bg-[#f6fbf8] px-4 py-3 text-sm text-[#1e7e57] md:col-span-2">
                    <CheckCircle2 size={18} />
                    已导入方案“{importedVariantPlanName}”，基础信息、建议事件与指标、字段和分组已带入，请在创建前确认选择
                    {importedVariantSummary
                      ? `（${importedVariantSummary.eventCount} 个事件、${importedVariantSummary.metricCount} 个指标、${importedVariantSummary.fieldCount} 个字段、${importedVariantSummary.groupCount} 个分组）`
                      : ''}。
                  </div>
                ) : null}
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedApplicationSpace?.displayName || draftPayload.appId || '尚未选择应用空间'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {draftPayload.appId
                      ? `${draftPayload.appId} · 从该应用字典中选择本实验需要的事件和指标`
                      : '实验必须归属一个应用空间'}
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">应用标识</label>
                  <select
                    value={draftPayload.appId || ''}
                    onChange={(event) => updateDraftAppId(event.target.value)}
                    className="input"
                  >
                    <option value="">请选择应用</option>
                    {applicationSpaces.map(space => (
                      <option key={space.appId} value={space.appId}>
                        {space.displayName || space.appId}（{space.appId}）
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">实验层标识</label>
                  <input
                    value={draftPayload.layerId || ''}
                    onChange={(event) => updateDraftField('layerId', event.target.value)}
                    className="input"
                    placeholder="可选，输入实验层标识"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">实验名称</label>
                  <input
                    value={draftPayload.name || ''}
                    onChange={(event) => updateDraftField('name', event.target.value)}
                    className="input"
                    placeholder="例如：二手手机标题实验"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">实验描述</label>
                  <input
                    value={draftPayload.description || ''}
                    onChange={(event) => updateDraftField('description', event.target.value)}
                    className="input"
                    placeholder="补充实验背景、范围和关键说明"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">开始时间</label>
                  <input
                    type="datetime-local"
                    value={(draftPayload.startTime || '').slice(0, 16)}
                    onChange={(event) => updateDraftField('startTime', event.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">结束时间</label>
                  <input
                    type="datetime-local"
                    value={(draftPayload.endTime || '').slice(0, 16)}
                    onChange={(event) => updateDraftField('endTime', event.target.value)}
                    className="input"
                  />
                </div>
                  </div>
                )}

                {activeDraftPanel === 'dictionary' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand)]">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">选择应用字典</h3>
                      <p className="mt-1 text-sm text-slate-500">应用维护完整字典，实验只引用本次需要的事件和指标。</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => loadApplicationDictionary()}
                      className="btn-secondary"
                      disabled={dictionaryLoading || !normalizeText(draftPayload.appId)}
                    >
                      {dictionaryLoading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                      刷新字典
                    </button>
                    <button
                      type="button"
                      onClick={selectAllDictionaryDefinitions}
                      className="btn-primary"
                      disabled={!applicationDictionary}
                    >
                      <CheckCircle2 size={16} />
                      全部选择
                    </button>
                    <button
                      type="button"
                      onClick={clearDictionarySelection}
                      className="btn-secondary"
                      disabled={eventDefinitions.length === 0 && metricDefinitions.length === 0}
                    >
                      <X size={16} />
                      清空选择
                    </button>
                  </div>
                </div>

                {dictionaryError ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
                    <AlertTriangle size={18} />
                    {dictionaryError}
                  </div>
                ) : applicationDictionary ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
                      <div className="px-4 py-3">
                        <p className="signal-label">应用事件</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">已选 {eventDefinitions.length} / 共 {dictionaryEventCount}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="signal-label">应用指标</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">已选 {metricDefinitions.length} / 共 {dictionaryMetricCount}</p>
                      </div>
                      <div className="px-4 py-3 text-sm text-slate-600">
                        <p className="signal-label">当前应用</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedApplicationSpace?.displayName || applicationDictionary.appId || draftPayload.appId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      <span>指标被选择后，计算所需事件会自动加入实验。</span>
                      <button type="button" onClick={() => navigate('/applications')} className="font-medium text-[var(--brand)] hover:underline">
                        前往应用管理维护字典
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    {dictionaryLoading ? '正在加载所选应用的事件和指标。' : '当前应用还没有可选择的事件和指标，请先在应用管理中维护字典。'}
                  </div>
                )}
                  </div>
                )}

                {activeDraftPanel === 'events' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">选择实验事件</h3>
                    <p className="mt-1 text-sm text-slate-500">从“{selectedApplicationSpace?.displayName || draftPayload.appId || '所选应用'}”的事件字典中选择，已选 {eventDefinitions.length} 个。</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateDictionarySelection({
                        eventKeys: dictionaryEventDefinitions.map(definition => definition.key),
                        metricKeys: metricDefinitions.map(definition => definition.key),
                      })}
                      className="btn-secondary"
                      disabled={!applicationDictionary}
                    >
                      全选事件
                    </button>
                    <button type="button" onClick={clearDictionarySelection} className="btn-secondary" disabled={eventDefinitions.length === 0}>
                      清空事件及指标
                    </button>
                  </div>
                </div>

                {dictionaryEventDefinitions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前应用没有事件定义。请先前往应用管理维护事件字典。
                  </div>
                ) : (
                  <div className="mt-4 grid max-h-[48vh] gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
                    {dictionaryEventDefinitions.map((eventDefinition) => {
                      const eventKey = normalizeText(eventDefinition.key).toUpperCase()
                      const selected = selectedEventKeys.has(eventKey)
                      const dependentMetricNames = metricDefinitions
                        .filter(metric => getMetricReferencedEventKeys(metric).includes(eventKey))
                        .map(metric => metric.name || metric.key)
                      return (
                        <label
                          key={eventKey}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${selected
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleDictionaryEvent(eventKey)}
                            className="mt-1 h-4 w-4 accent-blue-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">{eventDefinition.label || '未命名事件'}</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{getOptionLabel(EVENT_CATEGORY_OPTIONS, eventDefinition.category, '业务事件')}</span>
                              {eventDefinition.primary ? <span className="rounded-full bg-[#eaf7f0] px-2 py-0.5 text-xs text-[#1e7e57]">核心事件</span> : null}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">事件标识：{eventKey}</span>
                            <span className="mt-2 block text-sm text-slate-600">{eventDefinition.description || '暂无事件说明'}</span>
                            {dependentMetricNames.length > 0 ? (
                              <span className="mt-2 block text-xs font-medium text-[var(--brand)]">已被指标“{dependentMetricNames.join('、')}”使用</span>
                            ) : null}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                  </div>
                )}

                {activeDraftPanel === 'metrics' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">选择实验指标</h3>
                    <p className="mt-1 text-sm text-slate-500">从应用指标中选择本次观察口径，并指定唯一主指标。</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateDictionarySelection({
                        eventKeys: eventDefinitions.map(definition => definition.key),
                        metricKeys: dictionaryMetricDefinitions.map(definition => definition.key),
                      })}
                      className="btn-secondary"
                      disabled={!applicationDictionary}
                    >
                      全选指标
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDictionarySelection({
                        eventKeys: eventDefinitions.map(definition => definition.key),
                        metricKeys: [],
                      })}
                      className="btn-secondary"
                      disabled={metricDefinitions.length === 0}
                    >
                      清空指标
                    </button>
                  </div>
                </div>

                {dictionaryMetricDefinitions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前应用没有指标定义。请先前往应用管理维护指标字典。
                  </div>
                ) : (
                  <div className="mt-4 grid max-h-[48vh] gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
                    {dictionaryMetricDefinitions.map((metricDefinition) => {
                      const metricKey = normalizeText(metricDefinition.key).toUpperCase()
                      const selectedMetric = metricDefinitions.find(definition => normalizeText(definition.key).toUpperCase() === metricKey)
                      const selected = selectedMetricKeys.has(metricKey)
                      const numeratorLabel = dictionaryEventLabels.get(normalizeText(metricDefinition.numeratorEventType).toUpperCase()) || '未配置事件'
                      const denominatorLabel = metricDefinition.denominatorType === 'EVENT_COUNT'
                        ? dictionaryEventLabels.get(normalizeText(metricDefinition.denominatorEventType).toUpperCase()) || '未配置事件'
                        : getOptionLabel(METRIC_DENOMINATOR_TYPE_OPTIONS, metricDefinition.denominatorType, '所选统计口径')
                      return (
                        <div
                          key={metricKey}
                          className={`rounded-xl border p-4 transition ${selected
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <label className="flex cursor-pointer gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleDictionaryMetric(metricKey)}
                              className="mt-1 h-4 w-4 accent-blue-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">{metricDefinition.name || '未命名指标'}</span>
                                {metricDefinition.guardrailMetric ? <span className="rounded-full bg-[#fff4e8] px-2 py-0.5 text-xs text-[#9a6026]">建议护栏</span> : null}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">指标标识：{metricKey}</span>
                              <span className="mt-2 block text-sm text-slate-600">
                                {metricDefinition.aggregationType === 'COUNT'
                                  ? `统计“${numeratorLabel}”的发生次数`
                                  : `用“${numeratorLabel}”除以“${denominatorLabel}”`}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                统计方式：{getOptionLabel(METRIC_AGGREGATION_TYPE_OPTIONS, metricDefinition.aggregationType, '比率')}
                              </span>
                            </span>
                          </label>
                          {selected ? (
                            <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-blue-100 pt-3 text-sm font-medium text-slate-700">
                              <input
                                type="radio"
                                name="primary-metric"
                                checked={Boolean(selectedMetric?.primaryMetric)}
                                onChange={() => selectPrimaryMetric(metricKey)}
                                className="h-4 w-4 accent-blue-600"
                              />
                              设为本实验主指标
                            </label>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
                  </div>
                )}

                {activeDraftPanel === 'schema' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">配置字段定义</h3>
                    <p className="mt-1 text-sm text-slate-500">先定义每个实验组需要填写的字段，再为不同实验组配置具体值。</p>
                  </div>
                  <button onClick={addSchemaField} className="btn-secondary">
                    <Plus size={16} />
                    新增字段
                  </button>
                </div>

                {groupConfigSchema.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前还没有配置字段定义。可以新增标题、卖点、保障信息等页面配置字段。
                  </div>
                ) : (
                  <div className="mt-4 max-h-[44vh] space-y-4 overflow-y-auto pr-1">
                    {groupConfigSchema.map((field, index) => (
                      <div key={`schema-field-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">字段 {index + 1}</p>
                          <button
                            onClick={() => removeSchemaField(index)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-[#b44f42]"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">字段标识</label>
                            <input
                              value={field.key || ''}
                              onChange={(event) => updateSchemaField(index, 'key', event.target.value)}
                              className="input"
                              placeholder="输入字段标识"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">字段名称</label>
                            <input
                              value={field.label || ''}
                              onChange={(event) => updateSchemaField(index, 'label', event.target.value)}
                              className="input"
                              placeholder="例如：主标题"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">值类型</label>
                            <select
                              value={field.valueType || 'STRING'}
                              onChange={(event) => updateSchemaField(index, 'valueType', event.target.value)}
                              className="input"
                            >
                              {GROUP_CONFIG_VALUE_TYPE_OPTIONS.map(valueType => (
                                <option key={valueType.value} value={valueType.value}>{valueType.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">默认值</label>
                            {(field.valueType === 'OBJECT' || field.valueType === 'JSON') ? (
                              <textarea
                                value={formatEditableValue(field.defaultValue, field.valueType)}
                                onChange={(event) => updateSchemaField(index, 'defaultValue', event.target.value)}
                                className="textarea min-h-[110px]"
                                placeholder={field.valueType === 'OBJECT' ? '{"颜色":"蓝色"}' : '["官方质检"]'}
                              />
                            ) : (
                              <input
                                value={formatEditableValue(field.defaultValue, field.valueType)}
                                onChange={(event) => updateSchemaField(index, 'defaultValue', event.target.value)}
                                className="input"
                                placeholder="可选默认值"
                              />
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_0.2fr]">
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">字段说明</label>
                            <input
                              value={field.description || ''}
                              onChange={(event) => updateSchemaField(index, 'description', event.target.value)}
                              className="input"
                              placeholder="说明这个字段在页面上的作用"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">是否必填</label>
                            <select
                              value={field.required ? 'true' : 'false'}
                              onChange={(event) => updateSchemaField(index, 'required', event.target.value === 'true')}
                              className="input"
                            >
                              <option value="false">否</option>
                              <option value="true">是</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                  </div>
                )}

                {activeDraftPanel === 'groups' && (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-[#1e7e57]" />
                      <h3 className="font-semibold text-slate-900">实验组配置</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={addSchemaFieldFromGroups} className="btn-secondary py-2">
                        <Plus size={16} />
                        新增字段
                      </button>
                      <button type="button" onClick={addExperimentGroup} className="btn-primary py-2">
                        <Plus size={16} />
                        新增实验组
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                    {draftGroups.map((group, index) => {
                      const groupKey = getEditableGroupPanelKey(group, index)
                      const isExpanded = Boolean(expandedDraftGroupPanels[groupKey])
                      const summary = buildEditableGroupSummary(group, groupConfigSchema)

                      return (
                        <div key={groupKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">实验组标识</label>
                              <input
                                value={group.id || ''}
                                onChange={(event) => updateGroupField(index, 'id', event.target.value)}
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">实验组名称</label>
                              <input
                              value={localizeSystemText(group.name || '')}
                                onChange={(event) => updateGroupField(index, 'name', event.target.value)}
                                className="input"
                              />
                            </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeExperimentGroup(index)}
                              disabled={draftGroups.length <= 2}
                              className="mt-6 rounded-xl border border-slate-200 bg-white p-3 text-slate-400 transition hover:border-[#e7c8c4] hover:text-[#b44f42] disabled:cursor-not-allowed disabled:opacity-35"
                              title={draftGroups.length <= 2 ? '至少保留两个实验组' : '删除实验组'}
                              aria-label="删除实验组"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="mt-3">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">流量比例</label>
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={group.trafficRatio ?? 0}
                              onChange={(event) => updateGroupField(index, 'trafficRatio', event.target.value)}
                              className="input"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleDraftGroupPanel(groupKey)}
                            className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">字段配置</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{localizeSystemText(summary.groupName)}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{localizeSystemText(summary.groupId) || '未设置标识'}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">流量 {summary.trafficPercent}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{summary.configCount} 个配置项</span>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                          </button>

                          {isExpanded ? (
                            groupConfigSchema.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                {groupConfigSchema.map(field => (
                                  <div key={field.key || `field-${index}`} className="rounded-xl bg-white px-4 py-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium text-slate-900">{field.label || field.key || '未命名字段'}</p>
                                        <p className="text-xs text-slate-500">{field.key || '请先填写字段标识'} · {getValueTypeLabel(field.valueType)}</p>
                                      </div>
                                      {field.required && (
                                        <span className="badge border border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]">必填</span>
                                      )}
                                    </div>
                                    {(field.valueType === 'OBJECT' || field.valueType === 'JSON') ? (
                                      <textarea
                                        value={formatEditableValue(group.config?.[field.key] ?? field.defaultValue, field.valueType)}
                                        onChange={(event) => updateGroupConfigValue(index, field.key, event.target.value)}
                                        className="textarea min-h-[110px]"
                                        placeholder={field.valueType === 'OBJECT' ? '{"主题":"标准"}' : '["标签1","标签2"]'}
                                        disabled={!field.key}
                                      />
                                    ) : field.valueType === 'BOOLEAN' ? (
                                      <select
                                        value={formatEditableValue(group.config?.[field.key] ?? field.defaultValue, field.valueType)}
                                        onChange={(event) => updateGroupConfigValue(index, field.key, event.target.value)}
                                        className="input"
                                        disabled={!field.key}
                                      >
                                        <option value="">未设置</option>
                                        <option value="true">是</option>
                                        <option value="false">否</option>
                                      </select>
                                    ) : (
                                      <input
                                        type={field.valueType === 'INTEGER' ? 'number' : 'text'}
                                        value={formatEditableValue(group.config?.[field.key] ?? field.defaultValue, field.valueType)}
                                        onChange={(event) => updateGroupConfigValue(index, field.key, event.target.value)}
                                        className="input"
                                        placeholder={field.description || `填写 ${field.label || field.key || '配置值'}`}
                                        disabled={!field.key}
                                      />
                                    )}
                                    {field.description && (
                                      <p className="mt-2 text-xs leading-6 text-slate-500">{field.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : group.config && Object.keys(group.config).length > 0 ? (
                              <div className="mt-4 grid gap-2">
                                {Object.entries(group.config || {}).map(([key, value]) => (
                                  <div key={key} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                                    <span className="mr-2 text-slate-500">{key}</span>
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
                                <span>暂无实验组配置</span>
                                <button type="button" onClick={addSchemaFieldFromGroups} className="btn-secondary py-2">
                                  <Plus size={16} />
                                  新增字段
                                </button>
                              </div>
                            )
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <BrainCircuit size={18} className="text-[var(--brand)]" />
                    <h3 className="font-semibold text-slate-900">流量与执行策略</h3>
                  </div>
                  <div className="mt-4 space-y-4 text-sm text-slate-600">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">流量策略</label>
                      <select
                        value={draftPayload.traffic?.strategy || DEFAULT_TRAFFIC_STRATEGY}
                        onChange={(event) => updateTrafficField('strategy', event.target.value)}
                        className="input"
                      >
                        {TRAFFIC_STRATEGY_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">总流量</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={draftPayload.traffic?.totalTraffic ?? DEFAULT_TOTAL_TRAFFIC}
                        onChange={(event) => updateTrafficField('totalTraffic', event.target.value)}
                        className="input"
                      />
                    </div>

                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-slate-500">分配明细</p>
                      <div className="mt-2 space-y-2">
                        {(draftPayload.traffic?.allocation || []).map(item => (
                          <div key={item.group} className="flex items-center justify-between text-sm">
                            <span>{localizeSystemText(
                              draftGroups.find(group => group.id === item.group)?.name || item.group
                            )}</span>
                            <span>{Math.round((item.ratio || 0) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                  </div>
                )}
              </div>
            </div>
      </section>
    </div>
  )
}
