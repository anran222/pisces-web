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
  History,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  PencilLine,
  Save,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  Boxes
} from 'lucide-react'
import DataPipelineStatus from '../components/DataPipelineStatus'
import ExperimentEffectPreview from '../components/ExperimentEffectPreview'
import { experimentAPI, analysisAPI, trafficAPI, applicationAPI } from '../services/api'
import {
  buildExperimentStatsHighlights,
  buildMabGroupRows,
  resolveExperimentGroupName,
  resolvePrimaryMetricDefinition
} from '../utils/experimentDetailUtils'
import {
  buildConclusionStatusPayload,
  conclusionStatusNeedsComment,
  getConclusionEvidenceBlocker,
  requiresConclusionEvidence,
  resolveLatestReportSnapshot
} from '../utils/conclusionEvidence'
import {
  buildEditableGroupSummary,
  buildExperimentGroupTrafficAllocation,
  buildNextExperimentGroup,
  getEditableGroupPanelKey,
  getOrderedGroupEntries,
  rebalanceExperimentGroupTraffic
} from '../utils/editableGroupUtils'
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
import {
  getConclusionStatusLabel,
  getEventCategoryLabel,
  getMetricAggregationLabel,
  getMetricDenominatorLabel,
  getTrafficStrategyLabel,
  getValueTypeLabel,
  localizeSystemText,
  TRAFFIC_STRATEGY_OPTIONS,
} from '../utils/uiLabels'

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

const approvalStatusConfig = {
  NOT_REQUIRED: {
    label: '无需审批',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: ShieldOff,
  },
  PENDING: {
    label: '待审批',
    className: 'bg-[#fff8ef] text-[#9a6026] border-[#ecd8bf]',
    icon: ShieldCheck,
  },
  APPROVED: {
    label: '已通过',
    className: 'bg-[#f6fbf8] text-[#1e7e57] border-[#cde5d7]',
    icon: ShieldCheck,
  },
  REJECTED: {
    label: '已拒绝',
    className: 'bg-[#fff7f5] text-[#b44f42] border-[#e7c8c4]',
    icon: ShieldX,
  },
}

const auditActionConfig = {
  EXPERIMENT_CREATE: { label: '创建实验', className: 'border-blue-200 bg-blue-50 text-[var(--brand)]' },
  EXPERIMENT_UPDATE: { label: '更新配置', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  EXPERIMENT_START: { label: '启动实验', className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]' },
  EXPERIMENT_PAUSE: { label: '暂停实验', className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]' },
  EXPERIMENT_RESUME: { label: '恢复实验', className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]' },
  EXPERIMENT_STOP: { label: '停止实验', className: 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]' },
  EXPERIMENT_DELETE: { label: '删除实验', className: 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]' },
  EXPERIMENT_APPROVAL_UPDATE: { label: '审批流转', className: 'border-blue-200 bg-white text-[var(--brand)]' },
  EXPERIMENT_CONFIG_DRAFT_SAVE: { label: '保存草稿', className: 'border-blue-200 bg-white text-[var(--brand)]' },
  EXPERIMENT_CONFIG_DRAFT_PUBLISH: { label: '发布草稿', className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]' },
  EXPERIMENT_CONFIG_PUBLISH: { label: '发布配置', className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]' },
  EXPERIMENT_CONFIG_ROLLBACK: { label: '回滚配置', className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]' },
  CONCLUSION_STATUS_UPDATE: { label: '结论流转', className: 'border-blue-200 bg-white text-[var(--brand)]' }
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
  return localizeSystemText(value)
}

const getSchemaFieldLabel = (field) => field?.label || field?.key || '未命名字段'
const getDefinitionLabel = (definition) => definition?.label || definition?.name || definition?.key || '未命名'
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
const normalizeNumberInput = (value, fallback) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}
const formatDateTimeLocalValue = (value) => (value || '').slice(0, 16)
const formatAuditDateTime = (value) => (
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
)
const getResponseData = (value) => (
  value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')
    ? value.data
    : value
)
const formatConfigSourceType = (sourceType) => {
  if (sourceType === 'DRAFT_PUBLISH') {
    return '草稿发布'
  }
  if (sourceType === 'ROLLBACK') {
    return '回滚'
  }
  if (sourceType === 'PUBLISH') {
    return '发布'
  }
  return sourceType ? '其他来源' : '-'
}
const formatConfigVersionScale = (version) => (
  `${version?.groupCount ?? 0}组 / ${version?.eventDefinitionCount ?? 0}事件 / ${version?.metricDefinitionCount ?? 0}指标`
)
const formatExperimentResponseScale = (experiment) => (
  `${Object.keys(experiment?.groups || {}).length}组 / ${(experiment?.eventDefinitions || []).length}事件 / ${(experiment?.metricDefinitions || []).length}指标`
)
const formatAuditStatusChange = (auditLog) => {
  if (!auditLog?.beforeStatus && !auditLog?.afterStatus) {
    return '-'
  }
  if (!auditLog.beforeStatus) {
    return localizeSystemText(auditLog.afterStatus) || '-'
  }
  return `${localizeSystemText(auditLog.beforeStatus)} → ${localizeSystemText(auditLog.afterStatus) || '-'}`
}
const getOptionLabel = (options, value, fallback = value) => (
  options.find(option => option.value === value)?.label || fallback
)
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
  const groups = draftPayload?.groups || []
  const primaryMetricCount = metricDefinitions.filter(metric => metric?.primaryMetric).length

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
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [mabSummary, setMabSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [savingExperiment, setSavingExperiment] = useState(false)
  const [conclusionStatusDraft, setConclusionStatusDraft] = useState('')
  const [conclusionComment, setConclusionComment] = useState('')
  const [conclusionError, setConclusionError] = useState('')
  const [conclusionSuccess, setConclusionSuccess] = useState('')
  const [conclusionSaving, setConclusionSaving] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [approvalSaving, setApprovalSaving] = useState('')
  const [statsError, setStatsError] = useState('')
  const [reportSnapshots, setReportSnapshots] = useState([])
  const [reportSnapshotError, setReportSnapshotError] = useState('')
  const [reportSnapshotCreating, setReportSnapshotCreating] = useState(false)
  const [eventPipelineStatus, setEventPipelineStatus] = useState(null)
  const [eventReplayJobs, setEventReplayJobs] = useState([])
  const [eventReplayPlan, setEventReplayPlan] = useState(null)
  const [eventReplayPlanError, setEventReplayPlanError] = useState('')
  const [eventReplayPlanLoading, setEventReplayPlanLoading] = useState(false)
  const [eventPipelineError, setEventPipelineError] = useState('')
  const [eventPipelineActionLoading, setEventPipelineActionLoading] = useState('')
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogError, setAuditLogError] = useState('')
  const [configVersions, setConfigVersions] = useState([])
  const [configVersionError, setConfigVersionError] = useState('')
  const [configDraft, setConfigDraft] = useState(null)
  const [configDraftError, setConfigDraftError] = useState('')
  const [configDraftApprovals, setConfigDraftApprovals] = useState([])
  const [configDraftApprovalError, setConfigDraftApprovalError] = useState('')
  const [configDraftComment, setConfigDraftComment] = useState('')
  const [configDraftPublishComment, setConfigDraftPublishComment] = useState('')
  const [configPublishComment, setConfigPublishComment] = useState('')
  const [configRollbackComments, setConfigRollbackComments] = useState({})
  const [configVersionAction, setConfigVersionAction] = useState('')
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [expandedEditGroupPanels, setExpandedEditGroupPanels] = useState({})
  const [activeDetailPanel, setActiveDetailPanel] = useState('effect')
  const [activeEditPanel, setActiveEditPanel] = useState('basic')
  const [activeConfigPanel, setActiveConfigPanel] = useState('draft')
  const [activeRuntimePanel, setActiveRuntimePanel] = useState('overview')
  const [activeStatsPanel, setActiveStatsPanel] = useState('groups')

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    let isActive = true

    const loadApplicationSpaces = async () => {
      try {
        const response = await applicationAPI.list()
        if (isActive) {
          setApplicationSpaces(getResponseData(response) || [])
        }
      } catch (error) {
        console.warn('Failed to load application spaces:', error)
      }
    }

    loadApplicationSpaces()
    return () => {
      isActive = false
    }
  }, [])

  const loadData = async () => {
    let shouldLoadMabSummary = false

    try {
      setLoading(true)
      setStatsError('')
      setReportSnapshotError('')
      setEventPipelineError('')
      setEventReplayPlan(null)
      setEventReplayPlanError('')
      setAuditLogError('')
      setConfigVersionError('')
      setConfigDraftError('')
      setConfigDraftApprovalError('')
      setMabSummary(null)

      const [
        expRes,
        statsRes,
        reportSnapshotRes,
        eventPipelineRes,
        eventReplayJobRes,
        auditLogRes,
        configVersionRes,
        configDraftRes,
        configDraftApprovalRes
      ] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id),
        analysisAPI.listReportSnapshots(id),
        analysisAPI.getEventPipelineStatus(id),
        analysisAPI.listEventReplayJobs(id, 3),
        experimentAPI.listAuditLogs(id),
        experimentAPI.listConfigVersions(id),
        experimentAPI.getConfigDraft(id),
        experimentAPI.listConfigDraftApprovals(id)
      ])

      if (expRes.status === 'fulfilled') {
        const expData = getResponseData(expRes.value)
        setExperiment(expData)
        setEditDraft(buildExperimentDraftFromResponse(expData))
        const candidateStatuses = getAllowedConclusionStatuses(expData?.conclusionStatus)
        setConclusionStatusDraft(candidateStatuses[0] || '')
        setConclusionComment('')
        setConclusionError('')
        setConclusionSuccess('')
        setApprovalComment('')
        shouldLoadMabSummary = true
      } else {
        throw expRes.reason
      }

      if (statsRes.status === 'fulfilled') {
        setStatistics(getResponseData(statsRes.value))
      } else {
        setStatistics(null)
        setStatsError(localizeSystemText(statsRes.reason?.response?.data?.message || statsRes.reason?.message || '暂无统计数据'))
      }

      if (reportSnapshotRes.status === 'fulfilled') {
        setReportSnapshots(getResponseData(reportSnapshotRes.value) || [])
      } else {
        setReportSnapshots([])
        setReportSnapshotError(localizeSystemText(
          reportSnapshotRes.reason?.response?.data?.message
            || reportSnapshotRes.reason?.message
            || '报告快照暂不可用'
        ))
      }

      if (eventPipelineRes.status === 'fulfilled') {
        setEventPipelineStatus(getResponseData(eventPipelineRes.value))
      } else {
        setEventPipelineStatus(null)
        setEventPipelineError(localizeSystemText(
          eventPipelineRes.reason?.response?.data?.message
            || eventPipelineRes.reason?.message
            || '事件管道状态暂不可用'
        ))
      }

      if (eventReplayJobRes.status === 'fulfilled') {
        setEventReplayJobs(getResponseData(eventReplayJobRes.value) || [])
      } else {
        setEventReplayJobs([])
      }

      if (auditLogRes.status === 'fulfilled') {
        setAuditLogs(getResponseData(auditLogRes.value) || [])
      } else {
        setAuditLogs([])
        setAuditLogError(localizeSystemText(
          auditLogRes.reason?.response?.data?.message
            || auditLogRes.reason?.message
            || '审计日志暂不可用'
        ))
      }

      if (configVersionRes.status === 'fulfilled') {
        setConfigVersions(getResponseData(configVersionRes.value) || [])
      } else {
        setConfigVersions([])
        setConfigVersionError(localizeSystemText(
          configVersionRes.reason?.response?.data?.message
            || configVersionRes.reason?.message
            || '配置版本暂不可用'
        ))
      }

      if (configDraftRes.status === 'fulfilled') {
        const draftData = getResponseData(configDraftRes.value)
        setConfigDraft(draftData || null)
      } else {
        setConfigDraft(null)
        setConfigDraftError(localizeSystemText(
          configDraftRes.reason?.response?.data?.message
            || configDraftRes.reason?.message
            || '配置草稿暂不可用'
        ))
      }

      if (configDraftApprovalRes.status === 'fulfilled') {
        setConfigDraftApprovals(getResponseData(configDraftApprovalRes.value) || [])
      } else {
        setConfigDraftApprovals([])
        setConfigDraftApprovalError(localizeSystemText(
          configDraftApprovalRes.reason?.response?.data?.message
            || configDraftApprovalRes.reason?.message
            || '配置草稿审批历史暂不可用'
        ))
      }
    } catch (error) {
      console.error('Failed to load experiment:', error)
    } finally {
      setLoading(false)
    }

    if (!shouldLoadMabSummary) {
      return
    }

    try {
      const mabRes = await trafficAPI.getMABSummary(id)
      setMabSummary(getResponseData(mabRes))
    } catch (error) {
      console.log('MAB data not available')
      setMabSummary(null)
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
      alert('操作失败：' + localizeSystemText(error.response?.data?.message || error.message))
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
      alert(localizeSystemText(response.message || '实验数据生成完成'))
      await loadData()
    } catch (error) {
      alert('生成实验数据失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRetryDeadEvents = async () => {
    try {
      setEventPipelineActionLoading('retry')
      const response = await analysisAPI.retryDeadEvents(id)
      alert(localizeSystemText(response.message || response.data?.message || '死信事件已重新投递'))
      await loadData()
    } catch (error) {
      alert('重投死信失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handleReplayEventPipeline = async () => {
    try {
      setEventPipelineActionLoading('replay')
      const response = await analysisAPI.replayEventPipeline(id)
      alert(localizeSystemText(response.message || response.data?.message || '事件管道派生数据已重建'))
      await loadData()
    } catch (error) {
      alert('重放派生数据失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handlePlanEventReplay = async (request) => {
    try {
      setEventReplayPlanLoading(true)
      setEventReplayPlanError('')
      const response = await analysisAPI.planEventReplay(id, request)
      setEventReplayPlan(getResponseData(response))
    } catch (error) {
      setEventReplayPlan(null)
      setEventReplayPlanError(localizeSystemText(error.response?.data?.message || error.message || '重放计划生成失败'))
    } finally {
      setEventReplayPlanLoading(false)
    }
  }

  const handleRepairEventMaterialization = async (request = {}, segmentIndex = null) => {
    try {
      const repairingSegment = Number.isInteger(segmentIndex)
      setEventPipelineActionLoading(repairingSegment ? `repair-segment-${segmentIndex}` : 'repair-materialization')
      const response = repairingSegment
        ? await analysisAPI.repairEventMaterializationSegment(id, segmentIndex, request)
        : await analysisAPI.repairEventMaterialization(id, request)
      alert(localizeSystemText(response.message || response.data?.message || '缺失派生物化账本已修复'))
      await loadData()
    } catch (error) {
      alert('修复缺账本失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
    }
  }

  const handleCancelReplayJob = async (replayJobId) => {
    try {
      setEventPipelineActionLoading('cancel-replay')
      const response = await analysisAPI.cancelEventReplayJob(id, replayJobId)
      alert(localizeSystemText(response.message || response.data?.message || '事件重放任务已取消'))
      await loadData()
    } catch (error) {
      alert('取消重放任务失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setEventPipelineActionLoading('')
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
          allocation: buildExperimentGroupTrafficAllocation(groups)
        }
      }
    })
  }

  const addExperimentGroup = () => {
    setEditDraft(current => {
      const nextGroup = buildNextExperimentGroup(current.groups || [])
      const groups = rebalanceExperimentGroupTraffic([...(current.groups || []), nextGroup])
      return {
        ...current,
        groups,
        traffic: {
          ...current.traffic,
          allocation: buildExperimentGroupTrafficAllocation(groups)
        }
      }
    })
  }

  const removeExperimentGroup = (index) => {
    setEditDraft(current => {
      if ((current.groups || []).length <= 2) {
        return current
      }

      const groups = rebalanceExperimentGroupTraffic(
        (current.groups || []).filter((_, groupIndex) => groupIndex !== index)
      )
      return {
        ...current,
        groups,
        traffic: {
          ...current.traffic,
          allocation: buildExperimentGroupTrafficAllocation(groups)
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

  const handleEditStart = (initialPanel = 'basic') => {
    setEditDraft(buildExperimentDraftFromResponse(configDraft?.draftExperiment || experiment))
    setConfigDraftComment(configDraft?.draftComment || '')
    setExpandedEditGroupPanels({})
    setActiveEditPanel(initialPanel)
    setIsEditing(true)
  }

  const addSchemaFieldFromGroups = () => {
    addSchemaField()
    setActiveEditPanel('schema')
  }

  const handleEditCancel = () => {
    setEditDraft(buildExperimentDraftFromResponse(experiment))
    setConfigDraftComment('')
    setExpandedEditGroupPanels({})
    setActiveEditPanel('basic')
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
      await experimentAPI.saveConfigDraft(id, payload, configDraftComment, 'frontend')
      setConfigDraftComment('')
      await loadData()
      setIsEditing(false)
    } catch (error) {
      alert('保存配置草稿失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setSavingExperiment(false)
    }
  }

  const handleConclusionStatusUpdate = async () => {
    if (!conclusionStatusDraft) {
      return
    }

    const currentLatestReportSnapshot = resolveLatestReportSnapshot(reportSnapshots)
    const blocker = getConclusionEvidenceBlocker({
      targetStatus: conclusionStatusDraft,
      experiment,
      latestReportSnapshot: currentLatestReportSnapshot
    })
    if (blocker) {
      setConclusionError(blocker)
      setConclusionSuccess('')
      return
    }

    if (
      conclusionStatusNeedsComment(conclusionStatusDraft, currentLatestReportSnapshot)
      && !normalizeText(conclusionComment)
    ) {
      setConclusionError('当前人工结论与最新报告建议不一致，请填写人工依据。')
      setConclusionSuccess('')
      return
    }

    try {
      setConclusionSaving(true)
      setConclusionError('')
      setConclusionSuccess('')
      await experimentAPI.updateConclusionStatus(id, buildConclusionStatusPayload({
        targetStatus: conclusionStatusDraft,
        experiment,
        latestReportSnapshot: currentLatestReportSnapshot,
        operator: 'frontend',
        comment: conclusionComment
      }))
      await loadData()
      setConclusionSuccess('结论状态已保存，证据版本已绑定。')
    } catch (error) {
      setConclusionError(localizeSystemText(error.response?.data?.message || error.message || '更新结论状态失败'))
      setConclusionSuccess('')
    } finally {
      setConclusionSaving(false)
    }
  }

  const handleCreateReportSnapshot = async () => {
    try {
      setReportSnapshotCreating(true)
      setReportSnapshotError('')
      await analysisAPI.createReportSnapshot(id, 'frontend')
      await loadData()
    } catch (error) {
      setReportSnapshotError(localizeSystemText(error.response?.data?.message || error.message || '生成报告快照失败'))
    } finally {
      setReportSnapshotCreating(false)
    }
  }

  const handleApprovalStatusUpdate = async (approvalStatus) => {
    try {
      setApprovalSaving(approvalStatus)
      await experimentAPI.updateApprovalStatus(id, approvalStatus, approvalComment, 'frontend')
      await loadData()
    } catch (error) {
      alert('更新审批状态失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setApprovalSaving('')
    }
  }

  const updateConfigRollbackComment = (configVersion, comment) => {
    setConfigRollbackComments(current => ({
      ...current,
      [configVersion]: comment
    }))
  }

  const handlePublishConfigVersion = async () => {
    try {
      setConfigVersionAction('publish')
      await experimentAPI.publishConfigVersion(id, configPublishComment, 'frontend')
      setConfigPublishComment('')
      await loadData()
    } catch (error) {
      alert('发布配置失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setConfigVersionAction('')
    }
  }

  const handlePublishConfigDraft = async () => {
    if (!configDraft?.draftExperiment) {
      return
    }
    if (configDraft.stale) {
      alert('配置草稿已落后于当前版本，请先重新保存草稿后再发布')
      return
    }
    const confirmed = window.confirm('确定发布当前配置草稿？发布后会生成新的运行时配置版本。')
    if (!confirmed) {
      return
    }

    try {
      setConfigVersionAction('publish-draft')
      await experimentAPI.publishConfigDraft(
        id,
        configDraftPublishComment || `发布草稿 v${configDraft.draftVersion || '-'}`,
        'frontend'
      )
      setConfigDraftPublishComment('')
      await loadData()
    } catch (error) {
      alert('发布配置草稿失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setConfigVersionAction('')
    }
  }

  const handleRollbackConfigVersion = async (version) => {
    if (!version?.configVersion) {
      return
    }
    const confirmed = window.confirm(`确定回滚到配置版本 v${version.configVersion}？`)
    if (!confirmed) {
      return
    }

    const actionId = `rollback:${version.configVersion}`
    try {
      setConfigVersionAction(actionId)
      const comment = configRollbackComments[version.configVersion] || `回滚到 v${version.configVersion}`
      await experimentAPI.rollbackConfigVersion(id, version.configVersion, comment, 'frontend')
      setConfigRollbackComments(current => {
        const nextComments = { ...current }
        delete nextComments[version.configVersion]
        return nextComments
      })
      await loadData()
    } catch (error) {
      alert('回滚配置失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setConfigVersionAction('')
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
  const latestReportSnapshot = resolveLatestReportSnapshot(reportSnapshots)
  const conclusionEvidenceRequired = requiresConclusionEvidence(conclusionStatusDraft)
  const conclusionEvidenceBlocker = getConclusionEvidenceBlocker({
    targetStatus: conclusionStatusDraft,
    experiment,
    latestReportSnapshot
  })
  const conclusionCommentRequired = conclusionStatusNeedsComment(
    conclusionStatusDraft,
    latestReportSnapshot
  )
  const conclusionSubmitDisabled = conclusionSaving
    || !conclusionStatusDraft
    || Boolean(conclusionEvidenceBlocker)
    || (conclusionCommentRequired && !normalizeText(conclusionComment))
  const currentApprovalStatus = experiment.approvalStatus || 'NOT_REQUIRED'
  const approvalStatus = approvalStatusConfig[currentApprovalStatus] || approvalStatusConfig.NOT_REQUIRED
  const ApprovalIcon = approvalStatus.icon
  const groupConfigSchema = experiment.groupConfigSchema || []
  const experimentGroups = experiment.groups || {}
  const eventDefinitions = experiment.eventDefinitions || []
  const metricDefinitions = experiment.metricDefinitions || []
  const mabGroupRows = buildMabGroupRows(mabSummary, experimentGroups)
  const leadingGroupName = resolveExperimentGroupName(mabSummary?.leadingGroup, experimentGroups)
  const primaryMetricDefinition = resolvePrimaryMetricDefinition(experiment, statistics?.summary)
  const applicationSpace = applicationSpaces.find(space => space.appId === experiment.appId)
  const applicationName = applicationSpace?.displayName || experiment.appId || '未关联应用空间'
  const editGroups = editDraft?.groups || []
  const editEventDefinitions = editDraft?.eventDefinitions || []
  const editMetricDefinitions = editDraft?.metricDefinitions || []
  const editGroupConfigSchema = editDraft?.groupConfigSchema || []
  const currentConfigVersion = experiment.configVersion
  const draftExperiment = configDraft?.draftExperiment || null
  const hasConfigDraft = Boolean(draftExperiment)
  const configDraftIsStale = Boolean(configDraft?.stale)
  const configDraftApprovalStatusValue = configDraft?.approvalStatus || currentApprovalStatus
  const configDraftApprovalStatus = approvalStatusConfig[configDraftApprovalStatusValue] || approvalStatusConfig.NOT_REQUIRED
  const configDraftBlockedByApproval = hasConfigDraft
    && !configDraftIsStale
    && configDraftApprovalStatusValue !== 'APPROVED'
    && configDraftApprovalStatusValue !== 'NOT_REQUIRED'
  const configDraftStatusClass = configDraftIsStale || configDraftApprovalStatusValue === 'REJECTED'
    ? 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
    : configDraftBlockedByApproval
      ? 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
      : 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
  const configDraftStatusText = configDraftIsStale
    ? '已过期'
    : configDraftBlockedByApproval
      ? configDraftApprovalStatus.label
      : '可发布'
  const configDraftPublishDisabled = !hasConfigDraft
    || configDraftIsStale
    || configDraftBlockedByApproval
    || configVersionAction === 'publish-draft'
  const configDraftPublishButtonText = configVersionAction === 'publish-draft'
    ? '发布中'
    : !hasConfigDraft
      ? '无可发布草稿'
      : configDraftIsStale
        ? '草稿已过期'
        : configDraftBlockedByApproval
          ? '待审批通过'
          : '发布草稿'
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
  const statisticsGroupCount = statistics?.groupStatistics
    ? Object.keys(statistics.groupStatistics).length
    : 0
  const detailTabs = [
    { key: 'effect', label: '应用效果', count: Object.keys(experimentGroups).length },
    { key: 'data', label: '数据链路', count: eventReplayJobs.length + (eventReplayPlan ? 1 : 0) },
    { key: 'config', label: '配置版本', count: configVersions.length + (hasConfigDraft ? 1 : 0) },
    { key: 'audit', label: '审计', count: auditLogs.length },
    { key: 'runtime', label: '实验结构', count: Object.keys(experimentGroups).length },
    { key: 'decision', label: '结论', count: currentConclusionStatus === 'READY_FOR_REVIEW' ? 1 : 0 },
    { key: 'approval', label: '审批', count: currentApprovalStatus === 'PENDING' ? 1 : 0 },
    { key: 'stats', label: '统计', count: statisticsGroupCount + (mabSummary ? 1 : 0) }
  ]
  const editTabs = [
    { key: 'basic', label: '基础', count: 5 },
    { key: 'events', label: '事件', count: editEventDefinitions.length },
    { key: 'metrics', label: '指标', count: editMetricDefinitions.length },
    { key: 'schema', label: '字段', count: editGroupConfigSchema.length },
    { key: 'groups', label: '分组与流量', count: editGroups.length }
  ]
  const configTabs = [
    { key: 'draft', label: '待发布草稿', count: hasConfigDraft ? 1 : 0 },
    { key: 'approvals', label: '审批历史', count: configDraftApprovals.length },
    { key: 'snapshot', label: '补录快照', count: currentConfigVersion ? 1 : 0 },
    { key: 'versions', label: '发布版本', count: configVersions.length }
  ]
  const runtimeTabs = [
    { key: 'overview', label: '概览', count: Object.keys(experimentGroups).length },
    { key: 'schema', label: '配置字段', count: groupConfigSchema.length },
    { key: 'definitions', label: '事件与指标', count: eventDefinitions.length + metricDefinitions.length }
  ]
  const statsTabs = [
    { key: 'groups', label: '分组统计', count: statisticsGroupCount },
    { key: 'mab', label: '动态分流状态', count: mabSummary ? mabGroupRows.length || 1 : 0 }
  ]

  return (
    <div className="space-y-6">
      <section className="glass-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/experiments')}
              className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold leading-tight text-slate-950 lg:text-3xl">{experiment.name}</h1>
                <span className={`badge ${status.badge}`}>{status.text}</span>
              </div>
              <p className="page-subtitle mt-2">查看实验配置和运行状态，准备好后进入分析页查看建议和结论。</p>
              <p className="mt-3 font-mono text-xs text-slate-500">{experiment.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[460px] lg:justify-end">
            <button
              type="button"
              onClick={() => handleEditStart()}
              className="btn-secondary flex items-center gap-2"
            >
              <PencilLine size={16} /> {hasConfigDraft ? '编辑草稿' : '编辑实验'}
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
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Boxes size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">所属应用空间</span>
                <span className="text-sm font-semibold text-slate-900">{applicationName}</span>
                {experiment.appId ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500">
                    {experiment.appId}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">实验通过应用空间关联事件字典、指标口径、负责人和审批规则。</p>
            </div>
          </div>
          <Link to="/applications" className="btn-secondary shrink-0 text-sm">
            查看应用空间
          </Link>
        </div>
      </section>

      {isEditing && editDraft ? (
        <section className="glass-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="signal-label">配置编辑</p>
              <h2 className="section-title mt-2">编辑实验内容</h2>
              <p className="section-meta mt-2">可以修改实验基础信息、事件定义、指标定义和实验组配置，保存后进入配置草稿，不会立即覆盖运行时配置。</p>
              {hasConfigDraft ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    草稿 v{configDraft.draftVersion || '-'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    基于 v{configDraft.baseConfigVersion || '-'}
                  </span>
                  {configDraftIsStale ? (
                    <span className="rounded-full border border-[#e7c8c4] bg-[#fff7f5] px-3 py-1 text-[#b44f42]">
                      已过期
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="w-full lg:w-[360px]">
              <label className="mb-2 block text-sm text-slate-400">草稿备注</label>
              <textarea
                value={configDraftComment}
                onChange={(event) => setConfigDraftComment(event.target.value)}
                className="textarea min-h-[76px]"
                placeholder="说明这次配置草稿调整"
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
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
                  保存草稿
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap gap-2">
              {editTabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                    activeEditPanel === tab.key
                      ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setActiveEditPanel(tab.key)}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5">
            <div className={activeEditPanel === 'basic' ? 'grid gap-4 md:grid-cols-2' : 'hidden'}>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">应用空间：{applicationName}</p>
                    <p className="mt-1 text-xs text-slate-500">{experiment.appId || '当前实验未设置应用空间'} · 应用归属创建后保持不变</p>
                  </div>
                  <Link to="/applications" className="text-sm font-medium text-[var(--brand)] hover:underline">
                    查看关联配置
                  </Link>
                </div>
              </div>
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

            <div className={activeEditPanel === 'events' ? 'rounded-[1.5rem] border border-slate-200 bg-white p-5' : 'hidden'}>
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
                <div className="mt-4 max-h-[52vh] space-y-4 overflow-y-auto pr-1">
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
                            placeholder="输入事件编码"
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

            <div className={activeEditPanel === 'metrics' ? 'rounded-[1.5rem] border border-slate-200 bg-white p-5' : 'hidden'}>
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
                <div className="mt-4 max-h-[52vh] space-y-4 overflow-y-auto pr-1">
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
                            placeholder="输入指标编码"
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

            <div className={activeEditPanel === 'schema' ? 'rounded-[1.5rem] border border-slate-200 bg-white p-5' : 'hidden'}>
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
                <div className="mt-4 max-h-[52vh] space-y-4 overflow-y-auto pr-1">
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
                              value={formatConfigValue(field.defaultValue).replace(/^-$|^null$/g, '')}
                              onChange={(event) => updateSchemaField(index, 'defaultValue', event.target.value)}
                              className="textarea min-h-[110px]"
                              placeholder={field.valueType === 'OBJECT' ? '{"样式":"标准"}' : '["官方质检"]'}
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

            <div className={activeEditPanel === 'groups' ? 'grid gap-4 xl:grid-cols-[1.1fr_0.9fr]' : 'hidden'}>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">实验组配置</h3>
                    <p className="mt-1 text-sm text-slate-500">新增或删除实验组时会自动重新均分流量。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addSchemaFieldFromGroups} className="btn-secondary flex items-center gap-2" type="button">
                      <Plus size={16} />
                      新增字段
                    </button>
                    <button onClick={addExperimentGroup} className="btn-primary flex items-center gap-2" type="button">
                      <Plus size={16} />
                      新增实验组
                    </button>
                  </div>
                </div>
                <div className="mt-4 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                  {editGroups.map((group, index) => {
                    const groupKey = getEditableGroupPanelKey(group, index)
                    const isExpanded = Boolean(expandedEditGroupPanels[groupKey])
                    const summary = buildEditableGroupSummary(group, editGroupConfigSchema)

                    return (
                      <div key={groupKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">实验组 {index + 1}</p>
                          <button
                            onClick={() => removeExperimentGroup(index)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-[#b44f42] disabled:cursor-not-allowed disabled:opacity-40"
                            type="button"
                            disabled={editGroups.length <= 2}
                            title={editGroups.length <= 2 ? '实验至少需要两个分组' : '删除实验组'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{localizeSystemText(summary.groupName)}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{localizeSystemText(summary.groupId) || '未设置标识'}</span>
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
                                      <p className="text-xs text-slate-500">{field.key || '请先填写字段标识'} · {getValueTypeLabel(field.valueType)}</p>
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
                                      placeholder={field.valueType === 'OBJECT' ? '{"主题":"标准"}' : '["标签1","标签2"]'}
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
                                      <option value="true">是</option>
                                      <option value="false">否</option>
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
                                    <p className="mt-2 text-xs leading-6 text-slate-500">{localizeSystemText(field.description)}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
                              <span>当前没有配置字段，新增字段后可为各实验组填写不同的页面参数。</span>
                              <button type="button" onClick={addSchemaFieldFromGroups} className="font-medium text-[var(--brand)] hover:underline">
                                新增字段并配置
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
                <h3 className="font-semibold text-slate-900">流量与执行策略</h3>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">流量策略</label>
                    <select
                      value={editDraft.traffic?.strategy || 'HASH'}
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
                      value={editDraft.traffic?.totalTraffic ?? 1}
                      onChange={(event) => updateTrafficField('totalTraffic', event.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-slate-500">分配明细</p>
                    <div className="mt-2 space-y-2">
                      {(editDraft.traffic?.allocation || buildExperimentGroupTrafficAllocation(editGroups)).map(item => (
                        <div key={item.group} className="flex items-center justify-between text-sm">
                          <span>{localizeSystemText(
                            editGroups.find(group => group.id === item.group)?.name || item.group
                          )}</span>
                          <span>{Math.round((item.ratio || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>
      ) : null}

      <nav className="rounded-[1.2rem] border border-slate-200 bg-white/85 p-2">
        <div className="flex flex-wrap gap-2">
          {detailTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeDetailPanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveDetailPanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {activeDetailPanel === 'effect' ? (
        <ExperimentEffectPreview
          experimentId={experiment.id}
          applicationName={applicationName}
          appId={experiment.appId}
          configVersion={experiment.configVersion}
          groups={experimentGroups}
          schema={groupConfigSchema}
        />
      ) : null}

      {activeDetailPanel === 'data' ? (
      <DataPipelineStatus
        statistics={statistics}
        statsError={statsError}
        eventPipelineStatus={eventPipelineStatus}
        eventReplayJobs={eventReplayJobs}
        eventReplayPlan={eventReplayPlan}
        eventReplayPlanError={eventReplayPlanError}
        eventReplayPlanLoading={eventReplayPlanLoading}
        eventPipelineError={eventPipelineError}
        eventPipelineActionLoading={eventPipelineActionLoading}
        onRetryDeadEvents={handleRetryDeadEvents}
        onReplayEventPipeline={handleReplayEventPipeline}
        onPlanEventReplay={handlePlanEventReplay}
        onRepairEventMaterialization={handleRepairEventMaterialization}
        onCancelReplayJob={handleCancelReplayJob}
      />
      ) : null}

      {activeDetailPanel === 'config' ? (
      <section className="glass-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Save size={20} />
            </div>
            <div>
              <h2 className="section-title">配置草稿与版本</h2>
              <p className="section-meta">当前运行版本 v{currentConfigVersion || '-'}，配置变更先保存草稿，再发布为新版本。</p>
            </div>
          </div>

          <span className="badge border border-slate-200 bg-slate-50 text-slate-600">
            {configVersions.length} 个发布记录
          </span>
        </div>

        {configDraftError ? (
          <div className="mt-5 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            {configDraftError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {configTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeConfigPanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveConfigPanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {activeConfigPanel === 'draft' ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">待发布草稿</p>
                <p className="mt-1 text-sm text-slate-500">
                  草稿不会影响客户端组件和在线分流，发布后才会成为新的运行时配置。
                </p>
              </div>
              {hasConfigDraft ? (
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${configDraftStatusClass}`}>
                  {configDraftStatusText}
                </span>
              ) : null}
            </div>

            {hasConfigDraft ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">草稿版本</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900">v{configDraft.draftVersion || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">基线版本</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900">v{configDraft.baseConfigVersion || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">当前版本</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900">v{configDraft.currentConfigVersion || '-'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{draftExperiment.name || '未命名实验'}</p>
                      <p className="mt-1 text-slate-500">{formatExperimentResponseScale(draftExperiment)}</p>
                    </div>
                    <p className="text-slate-500">
                      {configDraft.updatedBy || '-'} · {formatAuditDateTime(configDraft.updatedAt)}
                    </p>
                  </div>
                  {configDraft.draftComment ? (
                    <p className="mt-3 rounded-lg bg-white px-3 py-2 text-slate-600">{configDraft.draftComment}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">草稿审批</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{configDraftApprovalStatus.label}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">审批人</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{configDraft.approvalOperator || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">审批时间</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatAuditDateTime(configDraft.approvalUpdatedAt)}
                    </p>
                  </div>
                </div>
                {configDraft.approvalComment ? (
                  <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    {configDraft.approvalComment}
                  </p>
                ) : null}

                {configDraftIsStale ? (
                  <div className="rounded-xl border border-[#e7c8c4] bg-[#fff7f5] px-4 py-3 text-sm text-[#b44f42]">
                    当前运行版本已经变化，发布前请重新进入编辑并保存草稿，避免旧配置覆盖新版本。
                  </div>
                ) : null}
                {configDraftBlockedByApproval ? (
                  <div className="rounded-xl border border-[#ecd8bf] bg-[#fff8ef] px-4 py-3 text-sm text-[#9a6026]">
                    配置草稿发布前需要审批通过，当前审批状态：{configDraftApprovalStatus.label}。
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有待发布配置草稿。
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="block text-sm text-slate-400 mb-2">草稿发布备注</label>
            <textarea
              value={configDraftPublishComment}
              onChange={(event) => setConfigDraftPublishComment(event.target.value)}
              className="textarea mb-3 min-h-[104px]"
              placeholder="记录本次草稿发布说明"
              disabled={configDraftPublishDisabled}
            />
            <button
              type="button"
              onClick={handlePublishConfigDraft}
              disabled={configDraftPublishDisabled}
              className="btn-primary w-full disabled:opacity-60"
            >
              {configDraftPublishButtonText}
            </button>
          </div>
        </div>
        ) : null}

        {activeConfigPanel === 'approvals' ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">草稿审批历史</p>
              <p className="mt-1 text-sm text-slate-500">按草稿版本倒序展示每次配置草稿的审批记录。</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {configDraftApprovals.length} 条记录
            </span>
          </div>

          {configDraftApprovalError ? (
            <div className="mt-4 rounded-xl border border-[#ecd8bf] bg-[#fff8ef] px-4 py-3 text-sm text-[#9a6026]">
              {configDraftApprovalError}
            </div>
          ) : configDraftApprovals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              当前实验还没有配置草稿审批记录。
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[880px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">草稿</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">提交</th>
                    <th className="px-4 py-3">审批</th>
                    <th className="px-4 py-3">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {configDraftApprovals.map((approval, index) => {
                    const approvalStatusMeta =
                      approvalStatusConfig[approval.approvalStatus] || approvalStatusConfig.NOT_REQUIRED
                    return (
                      <tr key={`${approval.draftVersion || index}-${approval.approvalStatus || 'UNKNOWN'}`}>
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            v{approval.draftVersion || '-'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            基于 v{approval.baseConfigVersion || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${approvalStatusMeta.className}`}>
                            {approvalStatusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p className="font-medium text-slate-900">{approval.requestedBy || '-'}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatAuditDateTime(approval.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p className="font-medium text-slate-900">{approval.approvalOperator || '-'}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatAuditDateTime(approval.approvalUpdatedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{approval.draftComment || '-'}</p>
                          {approval.approvalComment ? (
                            <p className="mt-1 text-xs text-slate-400">{approval.approvalComment}</p>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : null}

        {activeConfigPanel === 'snapshot' ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">补录当前版本快照</p>
              <p className="mt-1 text-sm text-slate-500">仅用于把当前运行配置写入发布历史，不会应用草稿内容。</p>
            </div>
            <div className="w-full lg:w-[360px]">
              <label className="block text-sm text-slate-400 mb-2">快照备注</label>
              <textarea
                value={configPublishComment}
                onChange={(event) => setConfigPublishComment(event.target.value)}
                className="textarea mb-3 min-h-[84px]"
                placeholder="记录当前版本快照说明"
              />
              <button
                type="button"
                onClick={handlePublishConfigVersion}
                disabled={configVersionAction === 'publish'}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {configVersionAction === 'publish' ? '记录中' : `记录 v${currentConfigVersion || '-'} 快照`}
              </button>
            </div>
          </div>
        </div>
        ) : null}

        {activeConfigPanel === 'versions' ? (
        <>
        {configVersionError ? (
          <div className="mt-5 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            {configVersionError}
          </div>
        ) : configVersions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前实验还没有已发布配置版本。
          </div>
        ) : (
          <div className="mt-5 max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">版本</th>
                  <th className="px-4 py-3">来源</th>
                  <th className="px-4 py-3">发布时间</th>
                  <th className="px-4 py-3">发布人</th>
                  <th className="px-4 py-3">配置规模</th>
                  <th className="px-4 py-3">备注</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configVersions.map((version) => {
                  const isCurrentVersion = version.configVersion === currentConfigVersion
                  const rollbackActionId = `rollback:${version.configVersion}`
                  return (
                    <tr key={`${version.configVersion}-${version.sourceType || 'PUBLISH'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900">v{version.configVersion}</span>
                          {isCurrentVersion ? (
                            <span className="rounded-full border border-[#cde5d7] bg-[#f6fbf8] px-2 py-0.5 text-xs text-[#1e7e57]">
                              当前
                            </span>
                          ) : null}
                        </div>
                        {version.sourceConfigVersion ? (
                          <p className="mt-1 text-xs text-slate-400">来自 v{version.sourceConfigVersion}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatConfigSourceType(version.sourceType)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatAuditDateTime(version.publishedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {version.publishedBy || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatConfigVersionScale(version)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {version.publishComment || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] items-center gap-2">
                          <input
                            value={configRollbackComments[version.configVersion] || ''}
                            onChange={(event) => updateConfigRollbackComment(version.configVersion, event.target.value)}
                            className="input h-9 text-xs"
                            placeholder="回滚备注"
                            disabled={isCurrentVersion}
                          />
                          <button
                            type="button"
                            onClick={() => handleRollbackConfigVersion(version)}
                            disabled={isCurrentVersion || configVersionAction === rollbackActionId}
                            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RotateCcw size={14} />
                            {configVersionAction === rollbackActionId ? '回滚中' : '回滚'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
        ) : null}
      </section>
      ) : null}

      {activeDetailPanel === 'audit' ? (
      <section className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <History size={20} />
            </div>
            <div>
              <h2 className="section-title">审计日志</h2>
              <p className="section-meta">记录实验配置、生命周期和结论状态的管理操作。</p>
            </div>
          </div>
          <span className="badge border border-slate-200 bg-slate-50 text-slate-600">
            {auditLogs.length} 条记录
          </span>
        </div>

        {auditLogError ? (
          <div className="mt-5 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            {auditLogError}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前实验还没有审计日志。
          </div>
        ) : (
          <div className="mt-5 max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">操作</th>
                  <th className="px-4 py-3">操作人</th>
                  <th className="px-4 py-3">状态变化</th>
                  <th className="px-4 py-3">摘要</th>
                  <th className="px-4 py-3">版本</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((auditLog, index) => {
                  const actionConfig = auditActionConfig[auditLog.action] || {
                    label: auditLog.action ? '其他操作' : '-',
                    className: 'border-slate-200 bg-slate-50 text-slate-600'
                  }
                  const auditLogKey = auditLog.auditId || [
                    auditLog.resourceId,
                    auditLog.action,
                    auditLog.createdAt,
                    String(index)
                  ].filter(Boolean).join(':')

                  return (
                    <tr key={auditLogKey}>
                      <td className="px-4 py-3 text-slate-600">
                        {formatAuditDateTime(auditLog.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${actionConfig.className}`}>
                          {actionConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {auditLog.operator || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {formatAuditStatusChange(auditLog)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {localizeSystemText(auditLog.summary) || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {auditLog.detail?.configVersion ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeDetailPanel === 'runtime' ? (
      <>
      <nav className="rounded-[1.2rem] border border-slate-200 bg-white/85 p-2">
        <div className="flex flex-wrap gap-2">
          {runtimeTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeRuntimePanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveRuntimePanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className={activeRuntimePanel === 'overview' ? 'grid grid-cols-1 gap-6 md:grid-cols-3' : 'hidden'}>
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
            {experiment.description ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="mb-2 text-slate-500">实验描述</p>
                <p className="leading-6 text-slate-700">{localizeSystemText(experiment.description)}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
                <Layers size={20} />
              </div>
              <span className="text-slate-500">实验组</span>
            </div>
            <button
              type="button"
              onClick={() => handleEditStart('groups')}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-blue-200 hover:text-[var(--brand)]"
              title="编辑实验组"
            >
              <PencilLine size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {getOrderedGroupEntries(experimentGroups).map(([groupId, group]) => {
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
                        <span>{localizeSystemText(group.name || groupId)}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1">{localizeSystemText(groupId)}</span>
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
                                <p className="mt-1 text-slate-500">{entry.key} · {getValueTypeLabel(entry.valueType)}</p>
                              </div>
                              {entry.required && (
                                <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-0.5 text-[11px] text-[#9a6026]">
                                  必填
                                </span>
                              )}
                            </div>
                            {entry.description && (
                              <p className="mt-2 text-slate-500 leading-5">{localizeSystemText(entry.description)}</p>
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
              <span className="text-slate-900">{getTrafficStrategyLabel(experiment.traffic?.strategy || 'HASH')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">总流量</span>
              <span className="text-slate-900">{((experiment.traffic?.totalTraffic || 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className={activeRuntimePanel === 'schema' ? 'glass-card p-6' : 'hidden'}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
              <Settings size={20} />
            </div>
            <span className="text-slate-500">配置字段定义</span>
          </div>
          <button
            type="button"
            onClick={() => handleEditStart('schema')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-blue-200 hover:text-[var(--brand)]"
            title="编辑配置字段"
          >
            <PencilLine size={16} />
          </button>
        </div>
        {groupConfigSchema.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
            当前实验没有单独定义配置字段，实验组配置按自由结构保存。
          </div>
        ) : (
          <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
            {groupConfigSchema.map((field) => (
              <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-slate-900 font-medium">{getSchemaFieldLabel(field)}</p>
                    <p className="mt-1 text-sm text-slate-500">{field.key} · {getValueTypeLabel(field.valueType)}</p>
                  </div>
                  {field.required && (
                    <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-0.5 text-xs text-[#9a6026]">
                      必填
                    </span>
                  )}
                </div>
                {field.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{localizeSystemText(field.description)}</p>
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

      <div className={activeRuntimePanel === 'definitions' ? 'grid grid-cols-1 gap-6 xl:grid-cols-2' : 'hidden'}>
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
            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {eventDefinitions.map((definition) => (
                <div key={definition.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{getDefinitionLabel(definition)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {definition.key}
                        {definition.category ? ` · ${getEventCategoryLabel(definition.category)}` : ''}
                      </p>
                    </div>
                    {definition.primary ? (
                      <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs text-[var(--brand)]">
                        主事件
                      </span>
                    ) : null}
                  </div>
                  {definition.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">{localizeSystemText(definition.description)}</p>
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
            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {metricDefinitions.map((definition) => (
                <div key={definition.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{getDefinitionLabel(definition)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {definition.key} · {getMetricAggregationLabel(definition.aggregationType)}
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
                    <p>分母类型：{getMetricDenominatorLabel(definition.denominatorType)}</p>
                    {definition.denominatorType === 'EVENT_COUNT' ? (
                      <p>分母事件：{definition.denominatorEventType || '-'}</p>
                    ) : null}
                    {definition.description ? <p className="mt-2">{localizeSystemText(definition.description)}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      ) : null}

      {activeDetailPanel === 'decision' ? (
      <div className="glass-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结论状态</h2>
              <span className={`badge border ${conclusionStatusConfig[currentConclusionStatus]?.className || conclusionStatusConfig.NOT_READY.className}`}>
                {getConclusionStatusLabel(currentConclusionStatus)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">当前人工状态</p>
                <p className="text-slate-900 font-medium">
                  {getConclusionStatusLabel(currentConclusionStatus)}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.conclusionUpdatedAt ? new Date(experiment.conclusionUpdatedAt).toLocaleString() : '暂无更新时间'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">系统建议状态</p>
                <p className="text-slate-900 font-medium">
                  {suggestedConclusionStatus !== '-' 
                    ? getConclusionStatusLabel(suggestedConclusionStatus)
                    : '-'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {experiment.suggestedConclusionUpdatedAt ? new Date(experiment.suggestedConclusionUpdatedAt).toLocaleString() : '暂无建议更新时间'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">已绑定配置</p>
                <p className="text-slate-900 font-medium">
                  {experiment.conclusionConfigVersion ? `v${experiment.conclusionConfigVersion}` : '-'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  当前配置 v{currentConfigVersion || '-'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">已绑定报告</p>
                <p className="text-slate-900 font-medium">
                  {experiment.conclusionReportSnapshotVersion ? `v${experiment.conclusionReportSnapshotVersion}` : '-'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  最新报告 v{latestReportSnapshot?.snapshotVersion || '-'}
                </p>
              </div>
            </div>

            {experiment.conclusionOperator || experiment.conclusionComment ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-900">
                    人工确认人：{experiment.conclusionOperator || '-'}
                  </span>
                  <span className="text-slate-400">
                    {experiment.conclusionUpdatedAt ? new Date(experiment.conclusionUpdatedAt).toLocaleString() : '-'}
                  </span>
                </div>
                {experiment.conclusionComment ? (
                  <p className="mt-2 leading-6 text-slate-600">{experiment.conclusionComment}</p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium text-slate-900">最新报告快照证据</p>
                  <p className="mt-1 text-slate-500">
                    提交待审核或终态结论时，会绑定当前配置版本和最新报告快照版本。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {latestReportSnapshot ? (
                    <span className={`badge border ${
                      latestReportSnapshot.analysisReady === false
                        ? 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
                        : 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
                    }`}>
                      {latestReportSnapshot.analysisReady === false ? '未就绪' : '分析就绪'}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCreateReportSnapshot}
                    disabled={reportSnapshotCreating}
                    className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-60"
                  >
                    {reportSnapshotCreating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {reportSnapshotCreating ? '生成中' : '生成快照'}
                  </button>
                </div>
              </div>
              {reportSnapshotError ? (
                <p className="mt-3 rounded-xl border border-[#e7c8c4] bg-[#fff7f5] px-3 py-2 text-[#b44f42]">
                  {reportSnapshotError}
                </p>
              ) : latestReportSnapshot ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-slate-400">快照版本</p>
                    <p className="mt-1 font-medium text-slate-900">v{latestReportSnapshot.snapshotVersion || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">报告建议</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {getConclusionStatusLabel(latestReportSnapshot.conclusionStatus)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">样本比例异常</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {latestReportSnapshot.hasSrm ? '已发现' : '未发现'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">生成时间</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {latestReportSnapshot.generatedAt ? new Date(latestReportSnapshot.generatedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
                  暂无报告快照。
                </p>
              )}
              {(latestReportSnapshot?.breachedGuardrails || []).length > 0 ? (
                <p className="mt-3 rounded-xl border border-[#e7c8c4] bg-[#fff7f5] px-3 py-2 text-[#b44f42]">
                  护栏异常：{latestReportSnapshot.breachedGuardrails.join('、')}
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-w-[280px] w-full lg:w-80">
            <label className="block text-sm text-slate-400 mb-2">更新人工结论状态</label>
            <select
              className="input mb-3"
              value={conclusionStatusDraft}
              onChange={(e) => {
                setConclusionStatusDraft(e.target.value)
                setConclusionError('')
                setConclusionSuccess('')
              }}
              disabled={allowedConclusionStatuses.length === 0}
            >
              {allowedConclusionStatuses.length === 0 ? (
                <option value="">当前状态不可继续迁移</option>
              ) : (
                allowedConclusionStatuses.map(statusKey => (
                  <option key={statusKey} value={statusKey}>
                    {getConclusionStatusLabel(statusKey)}
                  </option>
                ))
              )}
            </select>
            {conclusionEvidenceRequired ? (
              <div className={`mb-3 rounded-2xl border p-3 text-xs leading-5 ${
                conclusionEvidenceBlocker
                  ? 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
                  : 'border-blue-200 bg-blue-50 text-slate-600'
              }`}>
                {conclusionEvidenceBlocker ? (
                  conclusionEvidenceBlocker
                ) : (
                  <>
                    本次将绑定配置 v{currentConfigVersion || '-'} 与报告 v{latestReportSnapshot?.snapshotVersion || '-'}。
                    {conclusionCommentRequired ? ' 当前选择与报告建议不同，必须填写人工依据。' : ''}
                  </>
                )}
              </div>
            ) : null}
            <label className="mb-2 block text-sm text-slate-400">人工依据</label>
            <textarea
              className="input mb-3 min-h-[96px] resize-none leading-6"
              value={conclusionComment}
              onChange={(e) => {
                setConclusionComment(e.target.value)
                setConclusionError('')
                setConclusionSuccess('')
              }}
              placeholder={
                conclusionCommentRequired
                  ? '当前选择与最新报告建议不一致，请填写人工判断依据'
                  : '可填写本次人工确认的依据'
              }
            />
            {conclusionError ? (
              <div className="mb-3 rounded-2xl border border-[#e7c8c4] bg-[#fff7f5] px-3 py-2 text-xs leading-5 text-[#b44f42]">
                {conclusionError}
              </div>
            ) : null}
            {conclusionSuccess ? (
              <div className="mb-3 rounded-2xl border border-[#cde5d7] bg-[#f6fbf8] px-3 py-2 text-xs leading-5 text-[#1e7e57]">
                {conclusionSuccess}
              </div>
            ) : null}
            <button
              type="button"
              disabled={conclusionSubmitDisabled}
              onClick={handleConclusionStatusUpdate}
              className="btn-primary w-full disabled:opacity-60"
            >
              {conclusionSaving ? '保存中...' : '保存结论状态'}
            </button>
            <p className="text-xs text-slate-500 mt-2 leading-5">
              仅允许按状态机流转；待审核和终态会绑定证据版本。
            </p>
          </div>
        </div>
      </div>
      ) : null}

      {activeDetailPanel === 'approval' ? (
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-[var(--brand)]">
                <ApprovalIcon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">配置/启动审批</h2>
              <span className={`badge border ${approvalStatus.className}`}>
                {approvalStatus.label}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">审批状态</p>
                <p className="font-medium text-slate-900">{approvalStatus.label}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {experiment.approvalUpdatedAt ? new Date(experiment.approvalUpdatedAt).toLocaleString() : '-'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">操作人</p>
                <p className="font-medium text-slate-900">{experiment.approvalOperator || '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-500 mb-1">备注</p>
                <p className="font-medium text-slate-900">{experiment.approvalComment || '-'}</p>
              </div>
            </div>
          </div>

          {currentApprovalStatus === 'PENDING' ? (
            <div className="min-w-[280px] w-full lg:w-80">
              <label className="block text-sm text-slate-400 mb-2">审批备注</label>
              <textarea
                value={approvalComment}
                onChange={(event) => setApprovalComment(event.target.value)}
                className="textarea mb-3 min-h-[96px]"
                placeholder="填写本次审批备注"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(approvalSaving)}
                  onClick={() => handleApprovalStatusUpdate('APPROVED')}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {approvalSaving === 'APPROVED' ? '保存中' : '通过'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(approvalSaving)}
                  onClick={() => handleApprovalStatusUpdate('REJECTED')}
                  className="btn-danger w-full disabled:opacity-60"
                >
                  {approvalSaving === 'REJECTED' ? '保存中' : '拒绝'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      {activeDetailPanel === 'stats' ? (
      <>
      <nav className="rounded-[1.2rem] border border-slate-200 bg-white/85 p-2">
        <div className="flex flex-wrap gap-2">
          {statsTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeStatsPanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveStatsPanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {activeStatsPanel === 'groups' ? (
        statistics?.groupStatistics ? (
          <div className="glass-card p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <TrendingUp size={20} className="text-[var(--brand)]" />
              实时统计
            </h2>
            <div className="grid max-h-[58vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(statistics.groupStatistics).map(([groupId, stats]) => {
                const statHighlights = buildExperimentStatsHighlights({
                  ...experiment,
                  metricDefinitions: primaryMetricDefinition ? [primaryMetricDefinition] : metricDefinitions
                }, stats)

                return (
                  <div key={groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-medium text-slate-900">{localizeSystemText(stats.groupName || groupId)}</span>
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
                )
              })}
            </div>
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <Sparkles size={40} className="mx-auto mb-4 text-[var(--brand)]/70" />
            <p className="mb-2 font-medium text-slate-900">还没有真实统计数据</p>
            <p className="mb-4 text-sm text-slate-500">{statsError || '先生成实验数据，再查看实验表现。'}</p>
            <button disabled={actionLoading} onClick={handleGenerateData} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
              <Sparkles size={16} /> 立即生成数据
            </button>
          </div>
        )
      ) : null}

      {activeStatsPanel === 'mab' ? (
        mabSummary ? (
          <div className="glass-card p-6">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <BarChart3 size={20} className="text-[var(--brand)]" />
              多臂老虎机算法状态
            </h2>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">总实验次数</p>
                <p className="text-2xl font-bold text-slate-900">{mabSummary.totalTrials?.toLocaleString() || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">领先变体</p>
                <p className="text-2xl font-bold text-[var(--brand)]">{leadingGroupName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">是否收敛</p>
                <p className={`text-2xl font-bold ${mabSummary.converged ? 'text-[#1e7e57]' : 'text-[#9a6026]'}`}>
                  {mabSummary.converged ? '已收敛' : '未收敛'}
                </p>
              </div>
            </div>
            {mabSummary.recommendation && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-[var(--brand)]">{localizeSystemText(mabSummary.recommendation)}</p>
              </div>
            )}
            {mabGroupRows.length > 0 ? (
              <div className="mt-4 grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-3">
                {mabGroupRows.map((row) => (
                  <div key={row.groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{localizeSystemText(row.groupName)}</p>
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
        ) : (
          <div className="glass-card p-8 text-center">
            <BarChart3 size={40} className="mx-auto mb-4 text-[var(--brand)]/70" />
            <p className="mb-2 font-medium text-slate-900">还没有动态分流状态</p>
            <p className="text-sm text-slate-500">当前实验还没有返回多臂老虎机算法摘要。</p>
          </div>
        )
      ) : null}
      </>
      ) : null}

    </div>
  )
}
