import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  BarChart3,
  Settings,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  PencilLine,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { experimentAPI, analysisAPI, trafficAPI } from '../services/api'
import {
  buildExperimentStatsHighlights,
  buildMabGroupRows,
  resolveExperimentGroupName,
  resolvePrimaryMetricDefinition
} from '../utils/experimentDetailUtils'
import { buildEditableGroupSummary, getEditableGroupPanelKey } from '../utils/editableGroupUtils'
import {
  buildEmptyEventDefinition,
  buildEmptyGroupConfigField,
  buildEmptyMetricDefinition,
  buildExperimentCreatePayload,
  buildExperimentDraftFromResponse,
  EVENT_CATEGORY_OPTIONS,
  EVENT_KEY_PATTERN,
  GROUP_CONFIG_VALUE_TYPE_OPTIONS,
  METRIC_AGGREGATION_TYPE_OPTIONS,
  METRIC_DENOMINATOR_TYPE_OPTIONS
} from '../utils/aiDecisionTransformers'

const statusConfig = {
  RUNNING: { badge: 'badge-running', text: '运行中' },
  DRAFT: { badge: 'badge-draft', text: '草稿' },
  PAUSED: { badge: 'badge-paused', text: '已暂停' },
  STOPPED: { badge: 'badge-stopped', text: '已停止' }
}

const conclusionStatusConfig = {
  NOT_READY: {
    label: '未就绪',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  RUNNING: {
    label: '运行中',
    className: 'bg-blue-50 text-[var(--brand)] border-blue-200',
  },
  READY_FOR_REVIEW: {
    label: '待审核',
    className: 'bg-[#fff8ef] text-[#9a6026] border-[#ecd8bf]',
  },
  GRADUATED: {
    label: '已毕业',
    className: 'bg-[#f6fbf8] text-[#1e7e57] border-[#cde5d7]',
  },
  REJECTED: {
    label: '已拒绝',
    className: 'bg-[#fff7f5] text-[#b44f42] border-[#e7c8c4]',
  },
}

const getAllowedConclusionStatuses = (status) => {
  switch (status) {
    case 'NOT_READY':
      return ['RUNNING']
    case 'RUNNING':
      return ['READY_FOR_REVIEW']
    case 'READY_FOR_REVIEW':
      return ['GRADUATED', 'REJECTED']
    default:
      return []
  }
}

const formatConfigValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

const getSchemaFieldLabel = (field) => field?.label || field?.key || '未命名字段'
const getDefinitionLabel = (definition) => definition?.label || definition?.name || definition?.key || '未命名'
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
const normalizeNumberInput = (value, fallback) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}
const formatDateTimeLocalValue = (value) => (value || '').slice(0, 16)
const getOptionLabel = (options, value, fallback = value) => (
  options.find(option => option.value === value)?.label || fallback
)
const buildTrafficAllocation = (groups = []) => groups.map(group => ({
  group: group.id,
  ratio: Number(group.trafficRatio) || 0
}))

const buildSchemaKeys = (schema = []) => schema
  .map(field => field?.key)
  .filter(Boolean)

const buildGroupConfigEntries = (config = {}, schema = []) => {
  const schemaKeys = buildSchemaKeys(schema)
  const schemaEntries = schema
    .filter(field => field?.key)
    .map(field => ({
      key: field.key,
      label: getSchemaFieldLabel(field),
      valueType: field.valueType || 'STRING',
      required: Boolean(field.required),
      description: field.description || '',
      value: Object.prototype.hasOwnProperty.call(config || {}, field.key)
        ? config[field.key]
        : field.defaultValue
    }))
  const extraEntries = Object.entries(config || {})
    .filter(([key]) => !schemaKeys.includes(key))
    .map(([key, value]) => ({
      key,
      label: key,
      valueType: 'UNSCHEMA',
      required: false,
      description: '',
      value
    }))
  return [...schemaEntries, ...extraEntries]
}

const getMissingRequiredDraftMessage = (draftPayload) => {
  const eventDefinitions = draftPayload?.eventDefinitions || []
  const metricDefinitions = draftPayload?.metricDefinitions || []
  const primaryMetricCount = metricDefinitions.filter(metric => metric?.primaryMetric).length

  if (!normalizeText(draftPayload?.name)) {
    return '请填写实验名称'
  }
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
    if (metricDefinition?.aggregationType === 'RATE'
      && metricDefinition?.denominatorType === 'EVENT_COUNT'
      && !normalizeText(metricDefinition?.denominatorEventType)) {
      return '比率指标需要选择分母事件'
    }
  }
  return ''
}

export default function ExperimentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [mabSummary, setMabSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [savingExperiment, setSavingExperiment] = useState(false)
  const [conclusionStatusDraft, setConclusionStatusDraft] = useState('')
  const [conclusionSaving, setConclusionSaving] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [expandedEditGroupPanels, setExpandedEditGroupPanels] = useState({})

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      setStatsError('')

      const [expRes, statsRes] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id)
      ])

      if (expRes.status === 'fulfilled') {
        const expData = expRes.value.data || expRes.value
        setExperiment(expData)
        setEditDraft(buildExperimentDraftFromResponse(expData))
        const candidateStatuses = getAllowedConclusionStatuses(expData?.conclusionStatus)
        setConclusionStatusDraft(candidateStatuses[0] || '')
      } else {
        throw expRes.reason
      }

      if (statsRes.status === 'fulfilled') {
        setStatistics(statsRes.value.data || statsRes.value)
      } else {
        setStatistics(null)
        setStatsError(statsRes.reason?.response?.data?.message || statsRes.reason?.message || '暂无统计数据')
      }

      try {
        const mabRes = await trafficAPI.getMABSummary(id)
        setMabSummary(mabRes.data || mabRes)
      } catch (error) {
        console.log('MAB data not available')
        setMabSummary(null)
      }
    } catch (error) {
      console.error('Failed to load experiment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    try {
      setActionLoading(true)
      switch (action) {
        case 'start':
          await experimentAPI.start(id)
          break
        case 'pause':
          await experimentAPI.pause(id)
          break
        case 'resume':
          await experimentAPI.resume(id)
          break
        case 'stop':
          await experimentAPI.stop(id)
          break
      }
      await loadData()
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateData = async () => {
    try {
      setActionLoading(true)
      const response = await experimentAPI.simulateData(id, {
        visitorCount: 150,
        daysAgo: 7
      })
      alert(response.message || '实验数据生成完成')
      await loadData()
    } catch (error) {
      alert('生成实验数据失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const updateDraftField = (field, value) => {
    setEditDraft(current => ({
      ...current,
      [field]: value
    }))
  }

  const updateTrafficField = (field, value) => {
    setEditDraft(current => ({
      ...current,
      traffic: {
        ...current.traffic,
        [field]: field === 'totalTraffic'
          ? normalizeNumberInput(value, current.traffic?.totalTraffic ?? 1)
          : value
      }
    }))
  }

  const updateGroupField = (index, field, value) => {
    setEditDraft(current => {
      const groups = (current.groups || []).map((group, groupIndex) => (
        groupIndex === index
          ? {
              ...group,
              [field]: field === 'trafficRatio'
                ? normalizeNumberInput(value, group.trafficRatio)
                : value
            }
          : group
      ))
      return {
        ...current,
        groups,
        traffic: {
          ...current.traffic,
          allocation: buildTrafficAllocation(groups)
        }
      }
    })
  }

  const addEventDefinition = () => {
    setEditDraft(current => ({
      ...current,
      eventDefinitions: [...(current.eventDefinitions || []), buildEmptyEventDefinition()]
    }))
  }

  const updateEventDefinition = (index, field, value) => {
    setEditDraft(current => ({
      ...current,
      eventDefinitions: (current.eventDefinitions || []).map((definition, definitionIndex) => (
        definitionIndex === index
          ? { ...definition, [field]: field === 'primary' ? Boolean(value) : value }
          : definition
      ))
    }))
  }

  const removeEventDefinition = (index) => {
    setEditDraft(current => ({
      ...current,
      eventDefinitions: (current.eventDefinitions || []).filter((_, definitionIndex) => definitionIndex !== index)
    }))
  }

  const addMetricDefinition = () => {
    setEditDraft(current => ({
      ...current,
      metricDefinitions: [...(current.metricDefinitions || []), buildEmptyMetricDefinition()]
    }))
  }

  const updateMetricDefinition = (index, field, value) => {
    setEditDraft(current => ({
      ...current,
      metricDefinitions: (current.metricDefinitions || []).map((definition, definitionIndex) => (
        definitionIndex === index
          ? { ...definition, [field]: ['primaryMetric', 'guardrailMetric'].includes(field) ? Boolean(value) : value }
          : definition
      ))
    }))
  }

  const removeMetricDefinition = (index) => {
    setEditDraft(current => ({
      ...current,
      metricDefinitions: (current.metricDefinitions || []).filter((_, definitionIndex) => definitionIndex !== index)
    }))
  }

  const addSchemaField = () => {
    setEditDraft(current => ({
      ...current,
      groupConfigSchema: [...(current.groupConfigSchema || []), buildEmptyGroupConfigField()]
    }))
  }

  const updateSchemaField = (index, field, value) => {
    setEditDraft(current => {
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
    setEditDraft(current => {
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
    setEditDraft(current => ({
      ...current,
      groups: (current.groups || []).map((group, index) => (
        index === groupIndex
          ? {
              ...group,
              config: {
                ...(group.config || {}),
                [fieldKey]: value
              }
            }
          : group
      ))
    }))
  }

  const toggleEditGroupPanel = (groupKey) => {
    setExpandedEditGroupPanels(current => ({
      ...current,
      [groupKey]: !current[groupKey]
    }))
  }

  const handleEditStart = () => {
    setEditDraft(buildExperimentDraftFromResponse(experiment))
    setExpandedEditGroupPanels({})
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setEditDraft(buildExperimentDraftFromResponse(experiment))
    setExpandedEditGroupPanels({})
    setIsEditing(false)
  }

  const handleSaveExperiment = async () => {
    const validationMessage = getMissingRequiredDraftMessage(editDraft)
    if (validationMessage) {
      alert(validationMessage)
      return
    }

    try {
      setSavingExperiment(true)
      const payload = buildExperimentCreatePayload({ experimentDraft: editDraft })
      await experimentAPI.update(id, payload)
      await loadData()
      setIsEditing(false)
    } catch (error) {
      alert('保存实验失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setSavingExperiment(false)
    }
  }

  const handleConclusionStatusUpdate = async () => {
    if (!conclusionStatusDraft) {
      return
    }

    try {
      setConclusionSaving(true)
      await experimentAPI.updateConclusionStatus(id, conclusionStatusDraft, 'frontend')
      await loadData()
    } catch (error) {
      alert('更新结论状态失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setConclusionSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 rounded-lg bg-slate-200/60 animate-shimmer" />
        <div className="h-64 rounded-xl bg-slate-200/60 animate-shimmer" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="glass-card py-16 text-center">
        <p className="mb-4 text-slate-500">实验不存在</p>
        <button onClick={() => navigate('/experiments')} className="btn-primary">
          返回列表
        </button>
      </div>
    )
  }

  const status = statusConfig[experiment.status] || statusConfig.DRAFT
  const currentConclusionStatus = experiment.conclusionStatus || 'NOT_READY'
  const suggestedConclusionStatus = experiment.suggestedConclusionStatus || '-'
  const allowedConclusionStatuses = getAllowedConclusionStatuses(currentConclusionStatus)
  const groupConfigSchema = experiment.groupConfigSchema || []
  const experimentGroups = experiment.groups || {}
  const eventDefinitions = experiment.eventDefinitions || []
  const metricDefinitions = experiment.metricDefinitions || []
  const mabGroupRows = buildMabGroupRows(mabSummary, experimentGroups)
  const leadingGroupName = resolveExperimentGroupName(mabSummary?.leadingGroup, experimentGroups)
  const primaryMetricDefinition = resolvePrimaryMetricDefinition(experiment, statistics?.summary)
  const editGroups = editDraft?.groups || []
  const editEventDefinitions = editDraft?.eventDefinitions || []
  const editMetricDefinitions = editDraft?.metricDefinitions || []
  const editGroupConfigSchema = editDraft?.groupConfigSchema || []
  const editAvailableEventOptions = editEventDefinitions
    .map(definition => {
      const key = normalizeText(definition?.key).toUpperCase()
      if (!key) {
        return null
      }
      return {
        value: key,
        label: definition?.label ? `${definition.label}（${key}）` : key
      }
    })
    .filter(Boolean)

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/experiments')}
              className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="page-title">{experiment.name}</h1>
                <span className={`badge ${status.badge}`}>{status.text}</span>
              </div>
              <p className="page-subtitle mt-2">查看实验配置和运行状态，准备好后进入分析页查看建议和结论。</p>
              <p className="mt-3 font-mono text-xs text-slate-500">{experiment.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-[520px] xl:justify-end">
            <button
              type="button"
              onClick={handleEditStart}
              className="btn-secondary flex items-center gap-2"
            >
              <PencilLine size={16} /> 编辑实验
            </button>
            {experiment.status === 'DRAFT' && (
              <button disabled={actionLoading} onClick={() => handleAction('start')} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                <Play size={16} /> 启动
              </button>
            )}
            {experiment.status === 'RUNNING' && (
              <>
                <button disabled={actionLoading} onClick={() => handleAction('pause')} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
                  <Pause size={16} /> 暂停
                </button>
                <button disabled={actionLoading} onClick={() => handleAction('stop')} className="btn-danger flex items-center gap-2 disabled:opacity-60">
                  <Square size={16} /> 停止
                </button>
              </>
            )}
            {experiment.status === 'PAUSED' && (
              <>
                <button disabled={actionLoading} onClick={() => handleAction('resume')} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  <RotateCcw size={16} /> 恢复
                </button>
                <button disabled={actionLoading} onClick={() => handleAction('stop')} className="btn-danger flex items-center gap-2 disabled:opacity-60">
                  <Square size={16} /> 停止
                </button>
              </>
            )}
            <button disabled={actionLoading} onClick={handleGenerateData} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
              <Sparkles size={16} /> 生成实验数据
            </button>
            <Link to={`/experiments/${id}/decision`} className="btn-primary flex items-center gap-2">
              <BarChart3 size={16} /> 查看分析
            </Link>
          </div>
        </div>
      </section>

      {isEditing && editDraft ? (
        <section className="glass-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="signal-label">Edit</p>
              <h2 className="section-title mt-2">编辑实验内容</h2>
              <p className="section-meta mt-2">可以直接修改实验基础信息、事件定义、指标定义和实验组配置，保存后立即覆盖当前实验。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEditCancel}
                className="btn-secondary flex items-center gap-2"
                disabled={savingExperiment}
              >
                <X size={16} /> 取消
              </button>
              <button
                type="button"
                onClick={handleSaveExperiment}
                className="btn-primary flex items-center gap-2"
                disabled={savingExperiment}
              >
                {savingExperiment ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                保存实验
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-600">实验名称</label>
                <input
                  value={editDraft.name || ''}
                  onChange={(event) => updateDraftField('name', event.target.value)}
                  className="input"
                  placeholder="例如：二手手机标题实验"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">实验描述</label>
                <input
                  value={editDraft.description || ''}
                  onChange={(event) => updateDraftField('description', event.target.value)}
                  className="input"
                  placeholder="补充实验背景、范围和关键说明"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">开始时间</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocalValue(editDraft.startTime)}
                  onChange={(event) => updateDraftField('startTime', event.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">结束时间</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocalValue(editDraft.endTime)}
                  onChange={(event) => updateDraftField('endTime', event.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">事件定义</h3>
                  <p className="mt-1 text-sm text-slate-500">实验数据上报和指标计算都依赖这里的事件编码。</p>
                </div>
                <button onClick={addEventDefinition} className="btn-secondary" type="button">
                  <Plus size={16} />
                  新增事件
                </button>
              </div>

              {editEventDefinitions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                  当前还没有事件定义，请至少新增一个事件。
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {editEventDefinitions.map((eventDefinition, index) => (
                    <div key={`detail-event-definition-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                          type="button"
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
                          placeholder="说明这个事件在什么情况下上报"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">指标定义</h3>
                  <p className="mt-1 text-sm text-slate-500">先选统计方式，再选择要统计的事件。</p>
                </div>
                <button onClick={addMetricDefinition} className="btn-secondary" type="button">
                  <Plus size={16} />
                  新增指标
                </button>
              </div>

              {editMetricDefinitions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                  当前还没有指标定义，请至少新增一个主指标。
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {editMetricDefinitions.map((metricDefinition, index) => (
                    <div key={`detail-metric-definition-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                          type="button"
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
                            {editAvailableEventOptions.map(eventOption => (
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
                            {editAvailableEventOptions.map(eventOption => (
                              <option key={eventOption.value} value={eventOption.value}>{eventOption.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {metricDefinition.aggregationType === 'COUNT'
                          ? `当前是数量指标，会直接统计「${editAvailableEventOptions.find(option => option.value === metricDefinition.numeratorEventType)?.label || '所选事件'}」的发生次数。`
                          : `当前是比率指标，会用「${editAvailableEventOptions.find(option => option.value === metricDefinition.numeratorEventType)?.label || '所选事件'}」除以「${metricDefinition.denominatorType === 'EVENT_COUNT'
                            ? editAvailableEventOptions.find(option => option.value === metricDefinition.denominatorEventType)?.label || '所选分母事件'
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

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">配置字段定义</h3>
                  <p className="mt-1 text-sm text-slate-500">先定义实验组字段，再为每个实验组填写具体值。</p>
                </div>
                <button onClick={addSchemaField} className="btn-secondary" type="button">
                  <Plus size={16} />
                  新增字段
                </button>
              </div>

              {editGroupConfigSchema.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                  当前还没有配置字段定义。
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {editGroupConfigSchema.map((field, index) => (
                    <div key={`detail-schema-field-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">字段 {index + 1}</p>
                        <button
                          onClick={() => removeSchemaField(index)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-[#b44f42]"
                          type="button"
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
                              value={formatConfigValue(field.defaultValue).replace(/^-$|^null$/g, '')}
                              onChange={(event) => updateSchemaField(index, 'defaultValue', event.target.value)}
                              className="textarea min-h-[110px]"
                              placeholder={field.valueType === 'OBJECT' ? '{"style":"standard"}' : '["官方质检"]'}
                            />
                          ) : (
                            <input
                              value={field.defaultValue ?? ''}
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

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">实验组配置</h3>
                <div className="mt-4 space-y-3">
                  {editGroups.map((group, index) => {
                    const groupKey = getEditableGroupPanelKey(group, index)
                    const isExpanded = Boolean(expandedEditGroupPanels[groupKey])
                    const summary = buildEditableGroupSummary(group, editGroupConfigSchema)

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
                          onClick={() => toggleEditGroupPanel(groupKey)}
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
                          editGroupConfigSchema.length > 0 ? (
                            <div className="mt-4 space-y-3">
                              {editGroupConfigSchema.map(field => (
                                <div key={`${group.id || index}-${field.key || 'field'}`} className="rounded-xl bg-white px-4 py-3">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-slate-900">{field.label || field.key || '未命名字段'}</p>
                                      <p className="text-xs text-slate-500">{field.key || '请先填写字段 key'} · {getOptionLabel(GROUP_CONFIG_VALUE_TYPE_OPTIONS, field.valueType, field.valueType)}</p>
                                    </div>
                                    {field.required ? (
                                      <span className="badge border border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]">必填</span>
                                    ) : null}
                                  </div>
                                  {(field.valueType === 'OBJECT' || field.valueType === 'JSON') ? (
                                    <textarea
                                      value={formatConfigValue(group.config?.[field.key] ?? field.defaultValue).replace(/^-$|^null$/g, '')}
                                      onChange={(event) => updateGroupConfigValue(index, field.key, event.target.value)}
                                      className="textarea min-h-[110px]"
                                      placeholder={field.valueType === 'OBJECT' ? '{"theme":"standard"}' : '["标签1","标签2"]'}
                                      disabled={!field.key}
                                    />
                                  ) : field.valueType === 'BOOLEAN' ? (
                                    <select
                                      value={String(group.config?.[field.key] ?? field.defaultValue ?? '')}
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
                                      value={group.config?.[field.key] ?? field.defaultValue ?? ''}
                                      onChange={(event) => updateGroupConfigValue(index, field.key, event.target.value)}
                                      className="input"
                                      placeholder={field.description || `填写 ${field.label || field.key || '配置值'}`}
                                      disabled={!field.key}
                                    />
                                  )}
                                  {field.description ? (
                                    <p className="mt-2 text-xs leading-6 text-slate-500">{field.description}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
                              当前没有定义独立配置字段，可直接在实验返回结果中查看自由结构配置。
                            </div>
                          )
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">流量与执行策略</h3>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">流量策略</label>
                    <select
                      value={editDraft.traffic?.strategy || 'HASH'}
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
                      value={editDraft.traffic?.totalTraffic ?? 1}
                      onChange={(event) => updateTrafficField('totalTraffic', event.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">分配明细</p>
                    <div className="mt-2 space-y-2">
                      {(editDraft.traffic?.allocation || buildTrafficAllocation(editGroups)).map(item => (
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
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Clock size={20} />
            </div>
            <span className="text-slate-500">实验时间</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">开始时间</span>
              <span className="text-slate-900 text-right">
                {experiment.startTime ? new Date(experiment.startTime).toLocaleString() : '-'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">结束时间</span>
              <span className="text-slate-900 text-right">
                {experiment.endTime ? new Date(experiment.endTime).toLocaleString() : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Layers size={20} />
            </div>
            <span className="text-slate-500">实验组</span>
          </div>
          <div className="space-y-3">
            {Object.entries(experimentGroups).map(([groupId, group]) => {
              const configEntries = buildGroupConfigEntries(group.config, groupConfigSchema)
              const isExpanded = expandedGroupId === groupId

              return (
                <div key={groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setExpandedGroupId(current => current === groupId ? null : groupId)}
                        className="flex items-center gap-2 text-left text-sm font-medium text-slate-900 transition-colors hover:text-[var(--brand)]"
                      >
                        <span>{group.name || groupId}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1">{groupId}</span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                          流量 {((group.trafficRatio || 0) * 100).toFixed(0)}%
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                          {configEntries.length} 个配置项
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                      {configEntries.length > 0 ? (
                        configEntries.map((entry) => (
                          <div key={`${groupId}-${entry.key}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-slate-700 font-medium">{entry.label}</p>
                                <p className="mt-1 text-slate-500">{entry.key} · {entry.valueType}</p>
                              </div>
                              {entry.required && (
                                <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-0.5 text-[11px] text-[#9a6026]">
                                  必填
                                </span>
                              )}
                            </div>
                            {entry.description && (
                              <p className="mt-2 text-slate-500 leading-5">{entry.description}</p>
                            )}
                            <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-2 font-sans text-slate-700">
                              {formatConfigValue(entry.value)}
                            </pre>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-sm">暂无实验组配置</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-[#f6fbf8] p-2 text-[#1e7e57]">
              <Settings size={20} />
            </div>
            <span className="text-slate-500">流量配置</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">分配策略</span>
              <span className="text-slate-900">{experiment.traffic?.strategy || 'HASH'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">总流量</span>
              <span className="text-slate-900">{((experiment.traffic?.totalTraffic || 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
            <Settings size={20} />
          </div>
          <span className="text-slate-500">配置字段定义</span>
        </div>
        {groupConfigSchema.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
            当前实验没有单独定义配置字段，实验组配置按自由结构保存。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {groupConfigSchema.map((field) => (
              <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-slate-900 font-medium">{getSchemaFieldLabel(field)}</p>
                    <p className="mt-1 text-sm text-slate-500">{field.key} · {field.valueType}</p>
                  </div>
                  {field.required && (
                    <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-0.5 text-xs text-[#9a6026]">
                      必填
                    </span>
                  )}
                </div>
                {field.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{field.description}</p>
                )}
                {field.defaultValue !== null && field.defaultValue !== undefined && field.defaultValue !== '' && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <span className="mr-2 text-slate-500">默认值</span>
                    <span>{formatConfigValue(field.defaultValue)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Sparkles size={20} />
            </div>
            <span className="text-slate-500">事件定义</span>
          </div>
          {eventDefinitions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              当前实验还没有事件定义。
            </div>
          ) : (
            <div className="space-y-3">
              {eventDefinitions.map((definition) => (
                <div key={definition.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{getDefinitionLabel(definition)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {definition.key}
                        {definition.category ? ` · ${getOptionLabel(EVENT_CATEGORY_OPTIONS, definition.category, definition.category)}` : ''}
                      </p>
                    </div>
                    {definition.primary ? (
                      <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs text-[var(--brand)]">
                        主事件
                      </span>
                    ) : null}
                  </div>
                  {definition.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">{definition.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-[#f6fbf8] p-2 text-[#1e7e57]">
              <TrendingUp size={20} />
            </div>
            <span className="text-slate-500">指标定义</span>
          </div>
          {metricDefinitions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              当前实验还没有指标定义。
            </div>
          ) : (
            <div className="space-y-3">
              {metricDefinitions.map((definition) => (
                <div key={definition.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{getDefinitionLabel(definition)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {definition.key} · {getOptionLabel(METRIC_AGGREGATION_TYPE_OPTIONS, definition.aggregationType, definition.aggregationType)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {definition.primaryMetric ? (
                        <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs text-[var(--brand)]">
                          主指标
                        </span>
                      ) : null}
                      {definition.guardrailMetric ? (
                        <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-1 text-xs text-[#9a6026]">
                          护栏
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    <p>分子事件：{definition.numeratorEventType || '-'}</p>
                    <p>分母类型：{getOptionLabel(METRIC_DENOMINATOR_TYPE_OPTIONS, definition.denominatorType, definition.denominatorType || '-')}</p>
                    {definition.denominatorType === 'EVENT_COUNT' ? (
                      <p>分母事件：{definition.denominatorEventType || '-'}</p>
                    ) : null}
                    {definition.description ? <p className="mt-2">{definition.description}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结论状态</h2>
              <span className={`badge border ${conclusionStatusConfig[currentConclusionStatus]?.className || conclusionStatusConfig.NOT_READY.className}`}>
                {conclusionStatusConfig[currentConclusionStatus]?.label || currentConclusionStatus}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">当前人工状态</p>
                <p className="text-slate-900 font-medium">
                  {conclusionStatusConfig[currentConclusionStatus]?.label || currentConclusionStatus}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.conclusionUpdatedAt ? new Date(experiment.conclusionUpdatedAt).toLocaleString() : '暂无更新时间'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">系统建议状态</p>
                <p className="text-slate-900 font-medium">
                  {suggestedConclusionStatus !== '-' 
                    ? (conclusionStatusConfig[suggestedConclusionStatus]?.label || suggestedConclusionStatus)
                    : '-'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.suggestedConclusionUpdatedAt ? new Date(experiment.suggestedConclusionUpdatedAt).toLocaleString() : '暂无建议更新时间'}
                </p>
              </div>
            </div>
          </div>

          <div className="min-w-[280px] w-full lg:w-80">
            <label className="block text-sm text-slate-400 mb-2">更新人工结论状态</label>
            <select
              className="input mb-3"
              value={conclusionStatusDraft}
              onChange={(e) => setConclusionStatusDraft(e.target.value)}
              disabled={allowedConclusionStatuses.length === 0}
            >
              {allowedConclusionStatuses.length === 0 ? (
                <option value="">当前状态不可继续迁移</option>
              ) : (
                allowedConclusionStatuses.map(statusKey => (
                  <option key={statusKey} value={statusKey}>
                    {conclusionStatusConfig[statusKey]?.label || statusKey}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={conclusionSaving || !conclusionStatusDraft}
              onClick={handleConclusionStatusUpdate}
              className="btn-primary w-full disabled:opacity-60"
            >
              {conclusionSaving ? '保存中...' : '保存结论状态'}
            </button>
            <p className="text-xs text-slate-500 mt-2 leading-5">
              仅允许按状态机流转，不会自动回写为快照结论。
            </p>
          </div>
        </div>
      </div>

      {statistics?.groupStatistics ? (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-[var(--brand)]" />
            实时统计
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(statistics.groupStatistics).map(([groupId, stats]) => {
              const statHighlights = buildExperimentStatsHighlights({
                ...experiment,
                metricDefinitions: primaryMetricDefinition ? [primaryMetricDefinition] : metricDefinitions
              }, stats)

              return (
              <div key={groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-slate-900">{stats.groupName || groupId}</span>
                  {stats.isBaseline && (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">基准组</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {statHighlights.map((item) => (
                    <div key={`${groupId}-${item.key}`}>
                      <p className="text-slate-500">{item.label}</p>
                      <p className="text-lg font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
                {stats.liftRate !== undefined && stats.liftRate !== null && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">相对提升</span>
                      <span className={stats.liftRate >= 0 ? 'text-[#1e7e57]' : 'text-[#b44f42]'}>
                        {stats.liftRate >= 0 ? '+' : ''}{(stats.liftRate * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <Sparkles size={40} className="mx-auto mb-4 text-[var(--brand)]/70" />
          <p className="text-slate-900 font-medium mb-2">还没有真实统计数据</p>
          <p className="text-slate-500 text-sm mb-4">{statsError || '先生成实验数据，再查看实验表现。'}</p>
          <button disabled={actionLoading} onClick={handleGenerateData} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
            <Sparkles size={16} /> 立即生成数据
          </button>
        </div>
      )}

      {mabSummary && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-[var(--brand)]" />
            多臂老虎机算法状态
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-slate-500 text-sm">总实验次数</p>
              <p className="text-2xl font-bold text-slate-900">{mabSummary.totalTrials?.toLocaleString() || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-slate-500 text-sm">领先变体</p>
              <p className="text-2xl font-bold text-[var(--brand)]">{leadingGroupName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-slate-500 text-sm">是否收敛</p>
              <p className={`text-2xl font-bold ${mabSummary.converged ? 'text-[#1e7e57]' : 'text-[#9a6026]'}`}>
                {mabSummary.converged ? '已收敛' : '未收敛'}
              </p>
            </div>
          </div>
          {mabSummary.recommendation && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-[var(--brand)]">{mabSummary.recommendation}</p>
            </div>
          )}
          {mabGroupRows.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {mabGroupRows.map((row) => (
                <div key={row.groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{row.groupName}</p>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs text-[var(--brand)]">
                      {(row.allocationProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">成功次数</p>
                      <p className="font-semibold text-slate-900">{row.successes}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">成功率</p>
                      <p className="font-semibold text-slate-900">{(row.successRate * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {experiment.description && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">实验描述</h2>
          <p className="text-slate-600">{experiment.description}</p>
        </div>
      )}
    </div>
  )
}
