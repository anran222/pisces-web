import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  PencilLine,
  Plus,
  Radar,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { analysisAPI, applicationAPI, experimentAPI } from '../services/api'
import {
  buildEmptyEventDefinition,
  buildEmptyGroupConfigField,
  buildEmptyMetricDefinition,
  buildDefaultExperimentCreatePayload,
  buildExperimentCreatePayload,
  EVENT_CATEGORY_OPTIONS,
  EVENT_KEY_PATTERN,
  GROUP_CONFIG_VALUE_TYPE_OPTIONS,
  METRIC_AGGREGATION_TYPE_OPTIONS,
  METRIC_DENOMINATOR_TYPE_OPTIONS,
  normalizeConfidence
} from '../utils/aiDecisionTransformers'
import DemoExperimentPanel from '../components/DemoExperimentPanel'
import { buildEditableGroupSummary, getEditableGroupPanelKey } from '../utils/editableGroupUtils'
import { mergeApplicationDictionaryIntoDraft } from '../utils/applicationDictionary'

const CREATION_MODE_MANUAL = 'manual'
const CREATION_MODE_ASSISTED = 'assisted'
const DEFAULT_TRAFFIC_STRATEGY = 'HASH'
const DEFAULT_TOTAL_TRAFFIC = 1

const getDraftStatusTone = (status) => {
  if (status === 'PASS') {
    return 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
  }
  if (status === 'BLOCKED') {
    return 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
  }
  return 'border-blue-200 bg-blue-50 text-[var(--brand)]'
}

const parseConstraints = (value) => value
  .split('\n')
  .map(item => item.trim())
  .filter(Boolean)

const buildTrafficAllocation = (groups = []) => groups.map(group => ({
  group: group.id,
  ratio: Number(group.trafficRatio) || 0
}))

const normalizeTraffic = (traffic = {}, groups = []) => ({
  strategy: traffic.strategy || DEFAULT_TRAFFIC_STRATEGY,
  totalTraffic: Number.isFinite(Number(traffic.totalTraffic)) ? Number(traffic.totalTraffic) : DEFAULT_TOTAL_TRAFFIC,
  allocation: buildTrafficAllocation(groups)
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
  const primaryMetricCount = metricDefinitions.filter(metric => metric?.primaryMetric).length

  if (eventDefinitions.length === 0) {
    return '请至少定义一个事件'
  }
  for (const eventDefinition of eventDefinitions) {
    if (!normalizeText(eventDefinition?.key) || !normalizeText(eventDefinition?.label)) {
      return '请完整填写事件定义'
    }
    if (!EVENT_KEY_PATTERN.test(normalizeText(eventDefinition.key).toUpperCase())) {
      return '事件编码只支持大写英文、数字和下划线'
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
      return '指标编码只支持大写英文、数字和下划线'
    }
    if (!normalizeText(metricDefinition?.numeratorEventType)) {
      return '请为指标选择事件'
    }
    if (metricDefinition?.aggregationType === 'RATE' && metricDefinition?.denominatorType === 'EVENT_COUNT'
      && !normalizeText(metricDefinition?.denominatorEventType)) {
      return 'RATE 指标需要选择分母事件'
    }
  }

  return ''
}

export default function CreateExperiment() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(CREATION_MODE_MANUAL)
  const [form, setForm] = useState({
    businessScenario: '',
    targetMetric: '',
    constraintsText: '保持品牌可信度\n避免误导性表述'
  })
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [response, setResponse] = useState(null)
  const [draftPayload, setDraftPayload] = useState(() => buildDefaultExperimentCreatePayload())
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [applicationDictionary, setApplicationDictionary] = useState(null)
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState('')
  const [dictionaryImportResult, setDictionaryImportResult] = useState(null)
  const [expandedDraftGroupPanels, setExpandedDraftGroupPanels] = useState({})
  const [activeDraftPanel, setActiveDraftPanel] = useState('basics')
  const [demoDialogOpen, setDemoDialogOpen] = useState(false)
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false)

  useEffect(() => {
    loadApplicationSpaces()
  }, [])

  useEffect(() => {
    if (!response && activeDraftPanel === 'summary') {
      setActiveDraftPanel('basics')
    }
  }, [activeDraftPanel, response])

  const replaceDraft = (nextDraft) => {
    setDraftPayload(current => ({
      ...buildExperimentCreatePayload({ experimentDraft: nextDraft }),
      appId: nextDraft?.appId || current?.appId || ''
    }))
    setApplicationDictionary(null)
    setDictionaryImportResult(null)
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
      setDictionaryError(error.response?.data?.message || error.message || '应用空间加载失败')
    }
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    if (nextMode === CREATION_MODE_MANUAL && !draftPayload) {
      replaceDraft(buildDefaultExperimentCreatePayload())
    }
    if (nextMode === CREATION_MODE_MANUAL) {
      setResponse(null)
      setAssistantDialogOpen(false)
    }
    if (nextMode === CREATION_MODE_ASSISTED) {
      setAssistantDialogOpen(true)
    }
  }

  const handleGenerateDraft = async () => {
    if (!form.businessScenario.trim() || !form.targetMetric.trim()) {
      alert('请先填写业务场景和目标指标')
      return
    }

    try {
      setLoading(true)
      const payload = {
        businessScenario: form.businessScenario.trim(),
        targetMetric: form.targetMetric.trim(),
        constraints: parseConstraints(form.constraintsText)
      }
      const result = await analysisAPI.designExperiment(payload)
      const nextResponse = result.data || result
      setMode(CREATION_MODE_ASSISTED)
      setResponse(nextResponse)
      replaceDraft(nextResponse.experimentDraft || buildDefaultExperimentCreatePayload())
      setAssistantDialogOpen(false)
    } catch (error) {
      alert('生成实验方案失败: ' + (error.response?.data?.message || error.message))
      setResponse(null)
    } finally {
      setLoading(false)
    }
  }

  const updateDraftField = (field, value) => {
    setDraftPayload(current => ({
      ...current,
      [field]: value
    }))
  }

  const updateDraftAppId = (value) => {
    updateDraftField('appId', value)
    setApplicationDictionary(null)
    setDictionaryImportResult(null)
    setDictionaryError('')
  }

  const loadApplicationDictionary = async (appId = draftPayload?.appId) => {
    const normalizedAppId = normalizeText(appId)
    if (!normalizedAppId) {
      alert('请先选择应用 ID')
      return
    }
    try {
      setDictionaryLoading(true)
      setDictionaryError('')
      const responseData = await applicationAPI.getDictionary(normalizedAppId)
      setApplicationDictionary(responseData.data || responseData)
      setDictionaryImportResult(null)
    } catch (error) {
      setApplicationDictionary(null)
      setDictionaryError(error.response?.data?.message || error.message || '应用字典加载失败')
    } finally {
      setDictionaryLoading(false)
    }
  }

  const importApplicationDictionary = () => {
    if (!applicationDictionary) {
      alert('请先加载应用字典')
      return
    }
    const result = mergeApplicationDictionaryIntoDraft(draftPayload, applicationDictionary)
    setDraftPayload(result.draft)
    setDictionaryImportResult(result)
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

  const addSchemaField = () => {
    setDraftPayload(current => ({
      ...current,
      groupConfigSchema: [...(current.groupConfigSchema || []), buildEmptyGroupConfigField()]
    }))
  }

  const addEventDefinition = () => {
    setDraftPayload(current => ({
      ...current,
      eventDefinitions: [...(current.eventDefinitions || []), buildEmptyEventDefinition()]
    }))
  }

  const updateEventDefinition = (index, field, value) => {
    setDraftPayload(current => ({
      ...current,
      eventDefinitions: (current.eventDefinitions || []).map((definition, definitionIndex) => (
        definitionIndex === index
          ? { ...definition, [field]: field === 'primary' ? Boolean(value) : value }
          : definition
      ))
    }))
  }

  const removeEventDefinition = (index) => {
    setDraftPayload(current => ({
      ...current,
      eventDefinitions: (current.eventDefinitions || []).filter((_, definitionIndex) => definitionIndex !== index)
    }))
  }

  const addMetricDefinition = () => {
    setDraftPayload(current => ({
      ...current,
      metricDefinitions: [...(current.metricDefinitions || []), buildEmptyMetricDefinition()]
    }))
  }

  const updateMetricDefinition = (index, field, value) => {
    setDraftPayload(current => ({
      ...current,
      metricDefinitions: (current.metricDefinitions || []).map((definition, definitionIndex) => (
        definitionIndex === index
          ? { ...definition, [field]: ['primaryMetric', 'guardrailMetric'].includes(field) ? Boolean(value) : value }
          : definition
      ))
    }))
  }

  const removeMetricDefinition = (index) => {
    setDraftPayload(current => ({
      ...current,
      metricDefinitions: (current.metricDefinitions || []).filter((_, definitionIndex) => definitionIndex !== index)
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
    setResponse(null)
    replaceDraft(buildDefaultExperimentCreatePayload())
    setExpandedDraftGroupPanels({})
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
      alert('创建实验失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setCreating(false)
    }
  }

  const isManualMode = mode === CREATION_MODE_MANUAL
  const shouldShowDraftEditor = isManualMode || Boolean(response)
  const draftGroups = draftPayload?.groups || []
  const eventDefinitions = draftPayload?.eventDefinitions || []
  const metricDefinitions = draftPayload?.metricDefinitions || []
  const groupConfigSchema = draftPayload?.groupConfigSchema || []
  const dictionaryEventCount = applicationDictionary?.eventDefinitions?.length || 0
  const dictionaryMetricCount = applicationDictionary?.metricDefinitions?.length || 0
  const availableEventOptions = eventDefinitions
    .map(definition => {
      const key = normalizeText(definition?.key).toUpperCase()
      if (!key) {
        return null
      }
      return {
        value: key,
        label: definition?.label
          ? `${definition.label}（${key}）`
          : key
      }
    })
    .filter(Boolean)
  const confidencePercent = Math.round(normalizeConfidence(response?.confidence) * 100)
  const draftEditorTabs = [
    ...(response ? [{ key: 'summary', label: '方案', meta: `${confidencePercent}%` }] : []),
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
              onClick={() => handleModeChange(CREATION_MODE_MANUAL)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${isManualMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              直接填写
            </button>
            <button
              onClick={() => handleModeChange(CREATION_MODE_ASSISTED)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${!isManualMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              生成方案
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isManualMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setAssistantDialogOpen(true)}
                  className="btn-primary shrink-0"
                >
                  <Radar size={18} />
                  打开生成器
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResponse(null)
                    replaceDraft(buildDefaultExperimentCreatePayload())
                    setAssistantDialogOpen(true)
                  }}
                  className="btn-secondary shrink-0"
                >
                  清空结果
                </button>
              </>
            ) : (
              <button onClick={handleResetManualDraft} className="btn-secondary shrink-0">
                <PencilLine size={18} />
                恢复默认配置
              </button>
            )}
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

      {assistantDialogOpen && !isManualMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6" role="dialog" aria-modal="true">
          <div className="relative max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-[1.4rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              title="关闭生成器"
              aria-label="关闭生成器"
              onClick={() => setAssistantDialogOpen(false)}
              className="absolute right-4 top-4 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
            >
              <X size={18} />
            </button>

            <div className="mb-5 pr-10">
              <p className="signal-label">Assisted</p>
              <h2 className="section-title mt-2">生成实验方案</h2>
              <p className="section-meta mt-2">描述业务目标和约束，生成后会回到主工作区继续编辑实验配置。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-600">业务场景</label>
                <textarea
                  value={form.businessScenario}
                  onChange={(event) => setForm(current => ({ ...current, businessScenario: event.target.value }))}
                  className="textarea min-h-[112px]"
                  placeholder="例如：二手手机详情页标题与 CTA 文案优化，希望提升支付转化率。"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">目标指标</label>
                <input
                  value={form.targetMetric}
                  onChange={(event) => setForm(current => ({ ...current, targetMetric: event.target.value }))}
                  className="input"
                  placeholder="例如：支付转化率"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">约束条件</label>
                <textarea
                  value={form.constraintsText}
                  onChange={(event) => setForm(current => ({ ...current, constraintsText: event.target.value }))}
                  className="textarea min-h-[92px]"
                  placeholder="每行一个约束，例如：不要削弱价格可信度"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setResponse(null)
                  replaceDraft(buildDefaultExperimentCreatePayload())
                }}
                className="btn-secondary"
              >
                清空结果
              </button>
              <button onClick={handleGenerateDraft} disabled={loading} className="btn-primary">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Radar size={18} />}
                生成实验方案
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="signal-label">Draft</p>
              <h2 className="section-title mt-2">实验配置</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {response?.guardrailStatus && (
                <span className={`badge border ${getDraftStatusTone(response.guardrailStatus)}`}>
                  {response.guardrailStatus}
                </span>
              )}
              {shouldShowDraftEditor && (
                <button onClick={handleCreateExperiment} disabled={creating} className="btn-primary shrink-0">
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isManualMode ? '直接创建实验' : '用方案创建实验'}
                </button>
              )}
            </div>
          </div>

          {!shouldShowDraftEditor ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <BrainCircuit size={32} className="mx-auto text-[var(--brand)]/70" />
              <p className="mt-4 text-lg font-semibold text-slate-900">方案还没生成</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">打开生成器填写业务目标后，这里会展示摘要、风险提示和实验配置。</p>
            </div>
          ) : (
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
                {activeDraftPanel === 'summary' && response && (
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="badge border border-blue-200 bg-blue-50 text-[var(--brand)]">
                      <Sparkles size={14} />
                      置信度 {confidencePercent}%
                    </span>
                    {(response.riskFlags || []).map(flag => (
                      <span key={flag} className="risk-chip">
                        <AlertTriangle size={14} />
                        {flag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-base leading-8 text-slate-600">{response.summary}</p>
                </div>
                )}

                {activeDraftPanel === 'basics' && (
                  <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-600">应用 ID</label>
                  <input
                    list="application-space-options"
                    value={draftPayload.appId || ''}
                    onChange={(event) => updateDraftAppId(event.target.value)}
                    className="input"
                    placeholder="例如：shop-app"
                  />
                  <datalist id="application-space-options">
                    {applicationSpaces.map(space => (
                      <option key={space.appId} value={space.appId}>
                        {space.displayName || space.appId}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">实验层 ID</label>
                  <input
                    value={draftPayload.layerId || ''}
                    onChange={(event) => updateDraftField('layerId', event.target.value)}
                    className="input"
                    placeholder="可选，例如：checkout-layer"
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
                      <h3 className="font-semibold text-slate-900">应用字典</h3>
                      <p className="mt-1 text-sm text-slate-500">复用当前应用已经沉淀的事件和指标。</p>
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
                      加载字典
                    </button>
                    <button
                      type="button"
                      onClick={importApplicationDictionary}
                      className="btn-primary"
                      disabled={!applicationDictionary}
                    >
                      <Download size={16} />
                      导入定义
                    </button>
                  </div>
                </div>

                {dictionaryError ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
                    <AlertTriangle size={18} />
                    {dictionaryError}
                  </div>
                ) : applicationDictionary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="signal-label">Events</p>
                      <p className="signal-value text-xl">{dictionaryEventCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="signal-label">Metrics</p>
                      <p className="signal-value text-xl">{dictionaryMetricCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">{applicationDictionary.appId || draftPayload.appId}</p>
                      <p className="mt-2">
                        草稿已有 {eventDefinitions.length} 个事件、{metricDefinitions.length} 个指标
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前尚未加载应用字典。
                  </div>
                )}

                {dictionaryImportResult ? (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--brand)]">
                    已导入 {dictionaryImportResult.importedEventCount} 个事件、{dictionaryImportResult.importedMetricCount} 个指标
                    {dictionaryImportResult.skippedMetricCount > 0
                      ? `，跳过 ${dictionaryImportResult.skippedMetricCount} 个引用缺失事件的指标`
                    : ''}
                  </div>
                ) : null}
                  </div>
                )}

                {activeDraftPanel === 'events' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">事件定义</h3>
                    <p className="mt-1 text-sm text-slate-500">每个实验必须先定义事件，后续指标和 SDK 上报都依赖这里的编码。</p>
                  </div>
                  <button onClick={addEventDefinition} className="btn-secondary">
                    <Plus size={16} />
                    新增事件
                  </button>
                </div>

                {eventDefinitions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前还没有事件定义。请先定义如 `PRODUCT_VIEW`、`PAY_SUCCESS` 这类事件。
                  </div>
                ) : (
                  <div className="mt-4 max-h-[44vh] space-y-4 overflow-y-auto pr-1">
                    {eventDefinitions.map((eventDefinition, index) => (
                      <div key={`event-definition-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">事件 {index + 1}</p>
                            {eventDefinition.label || eventDefinition.key ? (
                              <p className="mt-1 text-xs text-slate-500">
                                {eventDefinition.label || '未命名事件'}
                                {eventDefinition.key ? ` · ${eventDefinition.key}` : ''}
                              </p>
                            ) : null}
                          </div>
                          <button
                            onClick={() => removeEventDefinition(index)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-[#b44f42]"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">事件编码</label>
                            <input
                              value={eventDefinition.key || ''}
                              onChange={(event) => updateEventDefinition(index, 'key', event.target.value.toUpperCase())}
                              className="input"
                              placeholder="例如：PAY_SUCCESS"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">事件名称</label>
                            <input
                              value={eventDefinition.label || ''}
                              onChange={(event) => updateEventDefinition(index, 'label', event.target.value)}
                              className="input"
                              placeholder="例如：支付成功"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">事件分类</label>
                            <select
                              value={eventDefinition.category || 'BUSINESS'}
                              onChange={(event) => updateEventDefinition(index, 'category', event.target.value)}
                              className="input"
                            >
                              {EVENT_CATEGORY_OPTIONS.map(category => (
                                <option key={category.value} value={category.value}>{category.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">是否主事件</label>
                            <select
                              value={eventDefinition.primary ? 'true' : 'false'}
                              onChange={(event) => updateEventDefinition(index, 'primary', event.target.value === 'true')}
                              className="input"
                            >
                              <option value="false">否</option>
                              <option value="true">是</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">事件说明</label>
                          <input
                            value={eventDefinition.description || ''}
                            onChange={(event) => updateEventDefinition(index, 'description', event.target.value)}
                            className="input"
                            placeholder="说明这个事件何时上报"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                  </div>
                )}

                {activeDraftPanel === 'metrics' && (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">指标定义</h3>
                    <p className="mt-1 text-sm text-slate-500">先选统计方式，再选择要统计的事件。页面只显示中文说明，保存时仍会用规范编码提交。</p>
                  </div>
                  <button onClick={addMetricDefinition} className="btn-secondary">
                    <Plus size={16} />
                    新增指标
                  </button>
                </div>

                {metricDefinitions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    当前还没有指标定义。你可以新增“支付率”“咨询率”“下单人数”这类更贴近业务的指标。
                  </div>
                ) : (
                  <div className="mt-4 max-h-[44vh] space-y-4 overflow-y-auto pr-1">
                    {metricDefinitions.map((metricDefinition, index) => (
                      <div key={`metric-definition-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">指标 {index + 1}</p>
                            {metricDefinition.name || metricDefinition.key ? (
                              <p className="mt-1 text-xs text-slate-500">
                                {metricDefinition.name || '未命名指标'}
                                {metricDefinition.key ? ` · ${metricDefinition.key}` : ''}
                              </p>
                            ) : null}
                          </div>
                          <button
                            onClick={() => removeMetricDefinition(index)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-[#b44f42]"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">指标编码</label>
                            <input
                              value={metricDefinition.key || ''}
                              onChange={(event) => updateMetricDefinition(index, 'key', event.target.value.toUpperCase())}
                              className="input"
                              placeholder="例如：PAYMENT_RATE"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">指标名称</label>
                            <input
                              value={metricDefinition.name || ''}
                              onChange={(event) => updateMetricDefinition(index, 'name', event.target.value)}
                              className="input"
                              placeholder="例如：支付率"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">统计方式</label>
                            <select
                              value={metricDefinition.aggregationType || 'RATE'}
                              onChange={(event) => updateMetricDefinition(index, 'aggregationType', event.target.value)}
                              className="input"
                            >
                              {METRIC_AGGREGATION_TYPE_OPTIONS.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">统计哪个事件</label>
                            <select
                              value={metricDefinition.numeratorEventType || ''}
                              onChange={(event) => updateMetricDefinition(index, 'numeratorEventType', event.target.value)}
                              className="input"
                            >
                              <option value="">请选择</option>
                              {availableEventOptions.map(eventOption => (
                                <option key={eventOption.value} value={eventOption.value}>{eventOption.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">
                              {metricDefinition.aggregationType === 'COUNT' ? '数量口径' : '分母口径'}
                            </label>
                            <select
                              value={metricDefinition.denominatorType || 'EVENT_COUNT'}
                              onChange={(event) => updateMetricDefinition(index, 'denominatorType', event.target.value)}
                              className="input"
                              disabled={metricDefinition.aggregationType === 'COUNT'}
                            >
                              {METRIC_DENOMINATOR_TYPE_OPTIONS.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">分母事件</label>
                            <select
                              value={metricDefinition.denominatorEventType || ''}
                              onChange={(event) => updateMetricDefinition(index, 'denominatorEventType', event.target.value)}
                              className="input"
                              disabled={metricDefinition.aggregationType !== 'RATE' || metricDefinition.denominatorType !== 'EVENT_COUNT'}
                            >
                              <option value="">请选择</option>
                              {availableEventOptions.map(eventOption => (
                                <option key={eventOption.value} value={eventOption.value}>{eventOption.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          {metricDefinition.aggregationType === 'COUNT'
                            ? `当前是数量指标，会直接统计「${availableEventOptions.find(option => option.value === metricDefinition.numeratorEventType)?.label || '所选事件'}」的发生次数。`
                            : `当前是比率指标，会用「${availableEventOptions.find(option => option.value === metricDefinition.numeratorEventType)?.label || '所选事件'}」除以「${metricDefinition.denominatorType === 'EVENT_COUNT'
                              ? availableEventOptions.find(option => option.value === metricDefinition.denominatorEventType)?.label || '所选分母事件'
                              : getOptionLabel(METRIC_DENOMINATOR_TYPE_OPTIONS, metricDefinition.denominatorType, '所选口径')
                            }」计算结果。`}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[0.5fr_0.25fr_0.25fr]">
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">指标说明</label>
                            <input
                              value={metricDefinition.description || ''}
                              onChange={(event) => updateMetricDefinition(index, 'description', event.target.value)}
                              className="input"
                              placeholder="说明该指标衡量什么"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">是否主指标</label>
                            <select
                              value={metricDefinition.primaryMetric ? 'true' : 'false'}
                              onChange={(event) => updateMetricDefinition(index, 'primaryMetric', event.target.value === 'true')}
                              className="input"
                            >
                              <option value="false">否</option>
                              <option value="true">是</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-medium tracking-[0.08em] text-slate-500">是否护栏指标</label>
                            <select
                              value={metricDefinition.guardrailMetric ? 'true' : 'false'}
                              onChange={(event) => updateMetricDefinition(index, 'guardrailMetric', event.target.value === 'true')}
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
                    当前还没有配置字段定义。你可以直接新增 `mainTitle`、`subtitle`、`showQualityBadge` 这类字段。
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
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">字段 key</label>
                            <input
                              value={field.key || ''}
                              onChange={(event) => updateSchemaField(index, 'key', event.target.value)}
                              className="input"
                              placeholder="例如：mainTitle"
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
                                placeholder={field.valueType === 'OBJECT' ? '{"color":"blue"}' : '["官方质检"]'}
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
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-[#1e7e57]" />
                    <h3 className="font-semibold text-slate-900">实验组配置</h3>
                  </div>
                  <div className="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                    {draftGroups.map((group, index) => {
                      const groupKey = getEditableGroupPanelKey(group, index)
                      const isExpanded = Boolean(expandedDraftGroupPanels[groupKey])
                      const summary = buildEditableGroupSummary(group, groupConfigSchema)

                      return (
                        <div key={groupKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">实验组 ID</label>
                              <input
                                value={group.id || ''}
                                onChange={(event) => updateGroupField(index, 'id', event.target.value)}
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">实验组名称</label>
                              <input
                                value={group.name || ''}
                                onChange={(event) => updateGroupField(index, 'name', event.target.value)}
                                className="input"
                              />
                            </div>
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
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{summary.groupName}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{summary.groupId || '未设置 ID'}</span>
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
                                        <p className="text-xs text-slate-500">{field.key || '请先填写字段 key'} · {field.valueType}</p>
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
                                        placeholder={field.valueType === 'OBJECT' ? '{"theme":"standard"}' : '["标签1","标签2"]'}
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
                                        <option value="true">true</option>
                                        <option value="false">false</option>
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
                              <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-500">暂无实验组配置</div>
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
                        <option value="HASH">HASH</option>
                        <option value="RANDOM">RANDOM</option>
                        <option value="RULE">RULE</option>
                        <option value="THOMPSON_SAMPLING">THOMPSON_SAMPLING</option>
                        <option value="UCB">UCB</option>
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
                            <span>{item.group}</span>
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
          )}
      </section>
    </div>
  )
}
