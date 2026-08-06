import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShieldOff,
  X,
  XCircle,
} from 'lucide-react'
import { applicationAPI, experimentAPI } from '../services/api'
import {
  EVENT_CATEGORY_OPTIONS,
  EVENT_KEY_PATTERN,
  METRIC_AGGREGATION_TYPE_OPTIONS,
  METRIC_DENOMINATOR_TYPE_OPTIONS,
} from '../utils/aiDecisionTransformers'
import {
  buildApplicationSpaceDraft,
  buildApplicationSpacePayload,
  summarizeApplicationSpaces,
} from '../utils/applicationSpaceGovernance'
import {
  buildIntegrationHealthSummary,
  getIntegrationCheckStatusMeta,
  getIntegrationStatusMeta,
  getIntegrationTargetLabel,
} from '../utils/applicationIntegrationHealth'
import {
  getApprovalStatusLabel,
  getEscalationStatusLabel,
  getEventCategoryLabel,
  getExperimentStatusLabel,
  getGuardrailStatusLabel,
  getMetricAggregationLabel,
  getNotificationChannelLabel,
  getRiskFlagLabel,
  localizeSystemText,
} from '../utils/uiLabels'

const formatCount = (value) => Number(value || 0).toLocaleString()
const APPLICATION_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/
const buildDictionaryEditor = (type, item = {}) => type === 'event'
  ? {
      type,
      key: item.key || '',
      label: item.label || '',
      description: item.description || '',
      category: item.category || 'BUSINESS',
      primary: Boolean(item.primary),
    }
  : {
      type,
      key: item.key || '',
      name: item.name || '',
      description: item.description || '',
      aggregationType: item.aggregationType || 'RATE',
      numeratorEventType: item.numeratorEventType || '',
      denominatorType: item.denominatorType || 'EVENT_COUNT',
      denominatorEventType: item.denominatorEventType || '',
      primaryMetric: Boolean(item.primaryMetric),
      guardrailMetric: Boolean(item.guardrailMetric),
    }
const getApprovalTaskKey = (task) => (
  `${task.experimentId}:${task.approvalType || 'EXPERIMENT_START'}:${task.draftVersion || '-'}`
)
const getEscalationKey = (escalation) => escalation.escalationId || (
  `${escalation.experimentId}:${escalation.approvalType || 'EXPERIMENT_START'}:${escalation.draftVersion || '-'}`
)
const getApprovalTaskTypeLabel = (approvalType) => {
  if (approvalType === 'CONFIG_DRAFT') {
    return '配置草稿'
  }
  return '启动审批'
}
const getApprovalProgressText = (task) => (
  task.approvalProgressText
    || `审批进度 ${Number(task.approvalApprovedCount || 0)}/${Number(task.approvalRequiredCount || 1)}`
)
const getApprovalSlaClassName = (slaStatus) => {
  if (slaStatus === 'OVERDUE') {
    return 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
  }
  if (slaStatus === 'DUE_SOON') {
    return 'border-[#f3e3a0] bg-[#fffbea] text-[#8a6d1d]'
  }
  return 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
}
const getApprovalSlaText = (task) => {
  if (!task.approvalSlaHours || !task.approvalSlaStatus) {
    return ''
  }
  const elapsedHours = Number(task.approvalElapsedHours ?? 0)
  return `审批时效 ${elapsedHours}/${task.approvalSlaHours} 小时`
}
const notificationStatusMeta = {
  PENDING: {
    label: '待投递',
    className: 'border-[#d7deea] bg-white text-slate-600',
  },
  DISPATCHING: {
    label: '投递中',
    className: 'border-[#cfe0ff] bg-[#f4f8ff] text-[#2f63b7]',
  },
  SENT: {
    label: '已投递',
    className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]',
  },
  RETRY: {
    label: '待重试',
    className: 'border-[#f3e3a0] bg-white text-[#8a6d1d]',
  },
  DEAD: {
    label: '死信',
    className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]',
  },
}
const getNotificationStatusMeta = (status) => (
  notificationStatusMeta[status] || {
    label: status ? '未知投递状态' : '待投递',
    className: 'border-[#d7deea] bg-white text-slate-600',
  }
)
const formatDateTime = (value) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}
const releaseWindowDayLabels = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}
const getDraftReleaseWindowDays = (value) => new Set(
  String(value || '')
    .split(',')
    .map(day => Number(day.trim()))
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
)
const toggleDraftReleaseWindowDay = (value, day) => {
  const selectedDays = getDraftReleaseWindowDays(value)
  if (selectedDays.has(day)) {
    if (selectedDays.size === 1) {
      return value
    }
    selectedDays.delete(day)
  } else {
    selectedDays.add(day)
  }
  return [...selectedDays].sort((left, right) => left - right).join(', ')
}
const formatReleaseWindow = (space) => {
  if (!space.releaseWindowEnabled) {
    return '未启用'
  }
  const days = (space.releaseWindowDays || [1, 2, 3, 4, 5])
    .map(day => releaseWindowDayLabels[day] || day)
    .join('、')
  const timezone = space.releaseWindowTimezone === 'Asia/Shanghai'
    ? '中国标准时间'
    : (space.releaseWindowTimezone ? '其他时区' : '中国标准时间')
  return `${days} ${space.releaseWindowStartTime || '09:00'}-${space.releaseWindowEndTime || '18:00'} ${timezone}`
}
const formatApprovalSla = (space) => {
  if (!space.approvalSlaHours) {
    return '未配置'
  }
  const owners = (space.approvalEscalationOwners || []).join(', ') || '审批人'
  return `${space.approvalSlaHours} 小时后升级至 ${owners}`
}

export default function ApplicationSpaces() {
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [drafts, setDrafts] = useState({})
  const [newAppId, setNewAppId] = useState('')
  const [newDraft, setNewDraft] = useState(buildApplicationSpaceDraft())
  const [search, setSearch] = useState('')
  const [selectedDictionaryAppId, setSelectedDictionaryAppId] = useState('')
  const [dictionary, setDictionary] = useState(null)
  const [dictionaryLoading, setDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState('')
  const [dictionaryEditor, setDictionaryEditor] = useState(null)
  const [dictionarySaving, setDictionarySaving] = useState(false)
  const [approvalTasks, setApprovalTasks] = useState([])
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalError, setApprovalError] = useState('')
  const [approvalActionId, setApprovalActionId] = useState('')
  const [approvalComments, setApprovalComments] = useState({})
  const [approvalEscalations, setApprovalEscalations] = useState([])
  const [approvalEscalationStatus, setApprovalEscalationStatus] = useState(null)
  const [escalationLoading, setEscalationLoading] = useState(false)
  const [escalationError, setEscalationError] = useState('')
  const [escalationActionId, setEscalationActionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingAppId, setSavingAppId] = useState('')
  const [error, setError] = useState('')
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState('spaces')
  const [selectedAppId, setSelectedAppId] = useState('')
  const [integrationHealth, setIntegrationHealth] = useState(null)
  const [integrationHealthLoading, setIntegrationHealthLoading] = useState(false)
  const [integrationHealthError, setIntegrationHealthError] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createStep, setCreateStep] = useState(1)

  useEffect(() => {
    loadGovernance()
  }, [])

  useEffect(() => {
    if (selectedDictionaryAppId) {
      loadApplicationDictionary(selectedDictionaryAppId)
    }
  }, [selectedDictionaryAppId])

  useEffect(() => {
    if (activeWorkspacePanel === 'integration' && selectedAppId) {
      loadIntegrationHealth(selectedAppId)
    }
  }, [activeWorkspacePanel, selectedAppId])

  const summary = useMemo(
    () => summarizeApplicationSpaces(applicationSpaces),
    [applicationSpaces]
  )

  const filteredSpaces = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) {
      return applicationSpaces
    }
    return applicationSpaces.filter(space => [
      space.appId,
      space.displayName,
      space.defaultOwner,
      ...(space.approvalOwners || []),
      ...(space.owners || []),
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(keyword)))
  }, [applicationSpaces, search])

  const loadApplicationSpaces = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await applicationAPI.list()
      const spaces = response.data || response || []
      setApplicationSpaces(spaces)
      setDrafts(spaces.reduce((nextDrafts, space) => ({
        ...nextDrafts,
        [space.appId]: buildApplicationSpaceDraft(space),
      }), {}))
      if (!selectedDictionaryAppId && spaces.length > 0) {
        setSelectedDictionaryAppId(spaces[0].appId)
      }
      setSelectedAppId(current => (
        spaces.some(space => space.appId === current) ? current : (spaces[0]?.appId || '')
      ))
    } catch (loadError) {
      setError(localizeSystemText(loadError.response?.data?.message || loadError.message || '应用加载失败'))
    } finally {
      setLoading(false)
    }
  }

  const loadApprovalTasks = async () => {
    try {
      setApprovalLoading(true)
      setApprovalError('')
      const response = await experimentAPI.listApprovalTasks({ approvalStatus: 'PENDING' })
      setApprovalTasks(response.data || response || [])
    } catch (loadError) {
      setApprovalTasks([])
      setApprovalError(localizeSystemText(loadError.response?.data?.message || loadError.message || '审批任务加载失败'))
    } finally {
      setApprovalLoading(false)
    }
  }

  const loadApprovalEscalations = async () => {
    try {
      setEscalationLoading(true)
      setEscalationError('')
      const response = await experimentAPI.listApprovalEscalations({ escalationStatus: 'OPEN' })
      setApprovalEscalations(response.data || response || [])
    } catch (loadError) {
      setApprovalEscalations([])
      setEscalationError(localizeSystemText(loadError.response?.data?.message || loadError.message || '升级告警加载失败'))
    } finally {
      setEscalationLoading(false)
    }
  }

  const loadApprovalEscalationStatus = async () => {
    try {
      const response = await experimentAPI.getApprovalEscalationStatus()
      setApprovalEscalationStatus(response.data || response || null)
    } catch (loadError) {
      setApprovalEscalationStatus(null)
    }
  }

  const loadGovernance = () => {
    loadApplicationSpaces()
    loadApprovalTasks()
    loadApprovalEscalations()
    loadApprovalEscalationStatus()
  }

  const loadApplicationDictionary = async (appId = selectedDictionaryAppId) => {
    const normalizedAppId = String(appId || '').trim()
    if (!normalizedAppId) {
      return
    }
    try {
      setDictionaryLoading(true)
      setDictionaryError('')
      const response = await applicationAPI.getDictionary(normalizedAppId)
      setDictionary(response.data || response)
    } catch (loadError) {
      setDictionary(null)
      setDictionaryError(localizeSystemText(loadError.response?.data?.message || loadError.message || '应用字典加载失败'))
    } finally {
      setDictionaryLoading(false)
    }
  }

  const loadIntegrationHealth = async (appId = selectedAppId) => {
    const normalizedAppId = String(appId || '').trim()
    if (!normalizedAppId) {
      setIntegrationHealth(null)
      return
    }
    try {
      setIntegrationHealthLoading(true)
      setIntegrationHealthError('')
      const response = await applicationAPI.getIntegrationHealth(normalizedAppId)
      setIntegrationHealth(response.data || response || null)
    } catch (loadError) {
      setIntegrationHealth(null)
      setIntegrationHealthError(localizeSystemText(
        loadError.response?.data?.message || loadError.message || '应用接入检查加载失败'
      ))
    } finally {
      setIntegrationHealthLoading(false)
    }
  }

  const openDictionaryEditor = (type, item) => {
    setDictionaryError('')
    setDictionaryEditor(buildDictionaryEditor(type, item))
  }

  const updateDictionaryEditor = (field, value) => {
    setDictionaryEditor(current => ({ ...current, [field]: value }))
  }

  const saveDictionaryEntry = async () => {
    const key = String(dictionaryEditor?.key || '').trim().toUpperCase()
    if (!EVENT_KEY_PATTERN.test(key)) {
      setDictionaryError('编码只支持大写字母、数字和下划线')
      return
    }
    if (dictionaryEditor.type === 'event' && !String(dictionaryEditor.label || '').trim()) {
      setDictionaryError('请填写事件名称')
      return
    }
    if (dictionaryEditor.type === 'metric') {
      if (!String(dictionaryEditor.name || '').trim()) {
        setDictionaryError('请填写指标名称')
        return
      }
      if (!dictionaryEditor.numeratorEventType) {
        setDictionaryError('请选择指标的分子事件')
        return
      }
      if (dictionaryEditor.aggregationType === 'RATE'
        && dictionaryEditor.denominatorType === 'EVENT_COUNT'
        && !dictionaryEditor.denominatorEventType) {
        setDictionaryError('比率指标需要选择分母事件')
        return
      }
    }

    try {
      setDictionarySaving(true)
      setDictionaryError('')
      let payload
      if (dictionaryEditor.type === 'event') {
        const eventDefinition = { ...dictionaryEditor, key }
        delete eventDefinition.type
        const eventDefinitions = dictionaryEditor.primary
          ? [
              ...dictionaryEventDefinitions
                .filter(item => item.key !== key && item.primary)
                .map(item => ({ ...item, primary: false })),
              eventDefinition,
            ]
          : [eventDefinition]
        payload = { eventDefinitions, metricDefinitions: [] }
      } else {
        const metricDefinition = { ...dictionaryEditor, key }
        delete metricDefinition.type
        const metricDefinitions = dictionaryEditor.primaryMetric
          ? [
              ...dictionaryMetricDefinitions
                .filter(item => item.key !== key && item.primaryMetric)
                .map(item => ({ ...item, primaryMetric: false })),
              metricDefinition,
            ]
          : [metricDefinition]
        payload = { eventDefinitions: [], metricDefinitions }
      }
      const response = await applicationAPI.upsertDictionary(selectedDictionaryAppId, payload)
      setDictionary(response.data || response)
      setDictionaryEditor(null)
    } catch (saveError) {
      setDictionaryError(localizeSystemText(
        saveError.response?.data?.message || saveError.message || '应用字典保存失败'
      ))
    } finally {
      setDictionarySaving(false)
    }
  }

  const updateDraft = (appId, field, value) => {
    setDrafts(current => ({
      ...current,
      [appId]: {
        ...(current[appId] || buildApplicationSpaceDraft({ appId })),
        [field]: value,
      },
    }))
  }

  const updateNewDraft = (field, value) => {
    setNewDraft(current => ({
      ...current,
      [field]: value,
    }))
  }

  const openCreateDialog = () => {
    setCreateStep(1)
    setCreateDialogOpen(true)
  }

  const closeCreateDialog = () => {
    setCreateStep(1)
    setCreateDialogOpen(false)
    setNewAppId('')
    setNewDraft(buildApplicationSpaceDraft())
  }

  const updateApprovalComment = (taskKey, value) => {
    setApprovalComments(current => ({
      ...current,
      [taskKey]: value,
    }))
  }

  const updateApprovalTaskStatus = async (task, approvalStatus) => {
    const taskKey = getApprovalTaskKey(task)
    const actionId = `${taskKey}:${approvalStatus}`
    const fallbackComment = approvalStatus === 'APPROVED' ? '审批通过' : '审批拒绝'
    const comment = approvalComments[taskKey] || fallbackComment
    const riskOverride = approvalStatus === 'APPROVED'
      && task.approvalRiskDisabledReason
      && task.riskOverrideAllowed
    if (riskOverride && !String(approvalComments[taskKey] || '').trim()) {
      alert('请填写风险豁免原因')
      return
    }
    if (riskOverride && !window.confirm('最新报告存在阻断风险，确认豁免并通过审批？')) {
      return
    }
    try {
      setApprovalActionId(actionId)
      await experimentAPI.updateApprovalStatus(
        task.experimentId,
        approvalStatus,
        comment,
        'web-ui',
        riskOverride ? { riskOverride: true, riskOverrideReason: comment } : {}
      )
      setApprovalComments(current => {
        const nextComments = { ...current }
        delete nextComments[taskKey]
        return nextComments
      })
      await loadApprovalTasks()
      await loadApprovalEscalations()
      await loadApprovalEscalationStatus()
    } catch (approvalError) {
      alert('更新审批状态失败：' + localizeSystemText(approvalError.response?.data?.message || approvalError.message))
    } finally {
      setApprovalActionId('')
    }
  }

  const scanApprovalEscalations = async () => {
    try {
      setEscalationActionId('scan')
      const response = await experimentAPI.scanApprovalEscalations()
      setApprovalEscalations(response.data || response || [])
      await loadApprovalEscalations()
      await loadApprovalEscalationStatus()
    } catch (scanError) {
      alert('扫描审批升级告警失败：' + localizeSystemText(scanError.response?.data?.message || scanError.message))
    } finally {
      setEscalationActionId('')
    }
  }

  const acknowledgeApprovalEscalation = async (escalation) => {
    const escalationKey = getEscalationKey(escalation)
    try {
      setEscalationActionId(escalationKey)
      await experimentAPI.acknowledgeApprovalEscalation(
        escalation.escalationId,
        '已在管理台确认',
        'web-ui'
      )
      await loadApprovalEscalations()
      await loadApprovalEscalationStatus()
    } catch (ackError) {
      alert('确认审批升级告警失败：' + localizeSystemText(ackError.response?.data?.message || ackError.message))
    } finally {
      setEscalationActionId('')
    }
  }

  const retryDeadApprovalEscalations = async () => {
    if (!window.confirm('确认重新投递所有可见的死信审批升级告警？')) {
      return
    }
    try {
      setEscalationActionId('retry-dead')
      await experimentAPI.retryDeadApprovalEscalations({}, 'web-ui')
      await loadApprovalEscalations()
      await loadApprovalEscalationStatus()
    } catch (retryError) {
      alert('重投审批升级死信失败：' + localizeSystemText(retryError.response?.data?.message || retryError.message))
    } finally {
      setEscalationActionId('')
    }
  }

  const retryApprovalEscalationNotification = async (escalation) => {
    const escalationKey = getEscalationKey(escalation)
    try {
      setEscalationActionId(`retry:${escalationKey}`)
      await experimentAPI.retryApprovalEscalationNotification(escalation.escalationId, 'web-ui')
      await loadApprovalEscalations()
      await loadApprovalEscalationStatus()
    } catch (retryError) {
      alert('重投审批升级告警失败：' + localizeSystemText(retryError.response?.data?.message || retryError.message))
    } finally {
      setEscalationActionId('')
    }
  }

  const saveApplicationSpace = async (appId, draft) => {
    const normalizedAppId = appId.trim()
    if (!normalizedAppId) {
      alert('应用标识不能为空')
      return
    }

    try {
      setSavingAppId(normalizedAppId)
      const payload = buildApplicationSpacePayload(draft)
      const isRegistration = normalizedAppId === newAppId.trim()
      const response = isRegistration
        ? await applicationAPI.register(normalizedAppId, payload)
        : await applicationAPI.upsert(normalizedAppId, payload)
      const savedSpace = response.data || response
      setApplicationSpaces(current => {
        const existingIndex = current.findIndex(space => space.appId === savedSpace.appId)
        if (existingIndex < 0) {
          return [...current, savedSpace].sort((a, b) => a.appId.localeCompare(b.appId))
        }
        return current.map(space => (space.appId === savedSpace.appId ? savedSpace : space))
      })
      setDrafts(current => ({
        ...current,
        [savedSpace.appId]: buildApplicationSpaceDraft(savedSpace),
      }))
      if (isRegistration) {
        setNewAppId('')
        setNewDraft(buildApplicationSpaceDraft())
        setSelectedAppId(savedSpace.appId)
        setCreateStep(1)
        setCreateDialogOpen(false)
        setActiveWorkspacePanel('spaces')
      }
    } catch (saveError) {
      const actionName = normalizedAppId === newAppId.trim() ? '注册应用' : '保存应用配置'
      alert(`${actionName}失败：` + localizeSystemText(saveError.response?.data?.message || saveError.message))
    } finally {
      setSavingAppId('')
    }
  }

  const renderApprovalSwitch = (checked, onChange, label) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-8 w-14 items-center rounded-full border px-1 transition-colors ${
        checked ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-100'
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  )

  const renderDictionaryList = (title, items, emptyMessage, renderMeta, type) => (
    <div className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {formatCount(items.length)}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={`${title}-${item.key}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{item.key}</span>
                  {renderMeta(item)}
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-[var(--brand)]"
                  title={`编辑${type === 'event' ? '事件' : '指标'}`}
                  aria-label={`编辑${item.label || item.name || item.key}`}
                  onClick={() => openDictionaryEditor(type, item)}
                >
                  <PencilLine size={15} />
                </button>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">{item.label || item.name || '未命名'}</p>
              {item.description ? (
                <p className="mt-1 text-xs leading-6 text-slate-500">{item.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {item.sourceExperimentId ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    来源 {item.sourceExperimentId}
                  </span>
                ) : null}
                {item.updatedBy ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    {item.updatedBy}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const dictionaryEventDefinitions = dictionary?.eventDefinitions || []
  const dictionaryMetricDefinitions = dictionary?.metricDefinitions || []
  const escalationDeadCount = Number(approvalEscalationStatus?.deadCount || 0)
  const escalationRetryCount = Number(approvalEscalationStatus?.retryCount || 0)
  const escalationUndeliveredCount = Number(approvalEscalationStatus?.undeliveredCount || 0)
  const escalationDeliveryUndeliveredCount = Number(approvalEscalationStatus?.deliveryUndeliveredCount || 0)
  const escalationHealthy = approvalEscalationStatus?.healthy !== false
  const escalationDispatcherEnabled = approvalEscalationStatus?.dispatcherEnabled === true
  const escalationDispatcherTargetCount = Number(approvalEscalationStatus?.dispatcherTargetCount || 0)
  const escalationDispatcherChannels = Array.isArray(approvalEscalationStatus?.dispatcherChannels)
    ? approvalEscalationStatus.dispatcherChannels
    : []
  const escalationDispatcherChannelText = escalationDispatcherChannels
    .map(getNotificationChannelLabel)
    .join('、')
  const selectedSpace = applicationSpaces.find(space => space.appId === selectedAppId) || null
  const selectedDraft = selectedSpace
    ? (drafts[selectedSpace.appId] || buildApplicationSpaceDraft(selectedSpace))
    : null
  const integrationSummary = buildIntegrationHealthSummary(integrationHealth)
  const normalizedNewAppId = newAppId.trim()
  const newAppIdFormatValid = !normalizedNewAppId || APPLICATION_ID_PATTERN.test(normalizedNewAppId)
  const newAppIdAvailable = !applicationSpaces.some(space => space.appId === normalizedNewAppId)
  const newQuotaText = String(newDraft.experimentQuota ?? '').trim()
  const newQuotaValid = !newQuotaText
    || (Number.isInteger(Number(newQuotaText)) && Number(newQuotaText) >= 0)
  const createBasicInfoComplete = Boolean(
    normalizedNewAppId
    && newAppIdFormatValid
    && newAppIdAvailable
    && newDraft.displayName.trim()
    && newDraft.defaultOwner.trim()
    && newQuotaValid
  )
  const newApprovalOwnerCount = new Set(
    String(newDraft.approvalOwners || '')
      .split(',')
      .map(owner => owner.trim())
      .filter(Boolean)
  ).size || 1
  const newApprovalRequiredCount = Number(newDraft.approvalRequiredCount)
  const newApprovalRequiredCountValid = !newDraft.approvalRequired
    || (Number.isInteger(newApprovalRequiredCount)
      && newApprovalRequiredCount >= 1
      && newApprovalRequiredCount <= newApprovalOwnerCount)
  const newApprovalSlaText = String(newDraft.approvalSlaHours ?? '').trim()
  const newApprovalSlaValid = !newDraft.approvalRequired
    || !newApprovalSlaText
    || (Number.isInteger(Number(newApprovalSlaText)) && Number(newApprovalSlaText) >= 1)
  const newReleaseWindowValid = !newDraft.releaseWindowEnabled
    || (newDraft.releaseWindowStartTime && newDraft.releaseWindowEndTime
      && newDraft.releaseWindowStartTime < newDraft.releaseWindowEndTime)
  const createGovernanceComplete = newApprovalRequiredCountValid
    && newApprovalSlaValid
    && newReleaseWindowValid
  const workspaceTabs = [
    { key: 'spaces', label: '应用列表', count: applicationSpaces.length, icon: Building2 },
    { key: 'integration', label: '接入检查', count: integrationSummary.total, icon: ShieldCheck },
    { key: 'dictionary', label: '事件字典', count: dictionaryEventDefinitions.length + dictionaryMetricDefinitions.length, icon: BookOpen },
    { key: 'approvals', label: '审批待办', count: approvalTasks.length, icon: Clock3 },
    { key: 'escalations', label: '升级告警', count: approvalEscalations.length, icon: BellRing },
  ]

  return (
    <div className="space-y-6">
      <section className="glass-card overflow-hidden">
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div>
            <div className="eyebrow mb-2">应用治理</div>
            <h1 className="page-title">应用管理</h1>
            <p className="page-subtitle mt-2">集中管理应用、负责人、实验额度、审批策略和发布时间。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="mr-2 hidden items-center divide-x divide-slate-200 text-sm xl:flex">
              <div className="px-4">
                <p className="text-xs text-slate-500">应用</p>
                <p className="mt-1 font-bold text-slate-900">{formatCount(summary.applicationCount)}</p>
              </div>
              <div className="px-4">
                <p className="text-xs text-slate-500">实验</p>
                <p className="mt-1 font-bold text-slate-900">{formatCount(summary.experimentCount)}</p>
              </div>
              <div className="px-4">
                <p className="text-xs text-slate-500">运行中</p>
                <p className="mt-1 font-bold text-[#1e7e57]">{formatCount(summary.runningExperimentCount)}</p>
              </div>
              <div className="px-4">
                <p className="text-xs text-slate-500">待审批</p>
                <p className="mt-1 font-bold text-[#9a6026]">{formatCount(approvalTasks.length)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadGovernance}
              className="btn-secondary px-3"
              title="刷新应用管理数据"
              disabled={loading || approvalLoading || escalationLoading}
            >
              <RefreshCw size={17} className={loading || approvalLoading || escalationLoading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={openCreateDialog}
              className="btn-primary"
            >
              <Plus size={17} />
              注册应用
            </button>
          </div>
        </div>
        <nav className="border-t border-slate-200 bg-slate-50/70 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto">
          {workspaceTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                activeWorkspacePanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveWorkspacePanel(tab.key)}
            >
              <tab.icon size={15} />
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {formatCount(tab.count)}
              </span>
            </button>
          ))}
        </div>
        </nav>
      </section>

      {activeWorkspacePanel === 'integration' ? (
        <section className="glass-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="signal-label">应用接入检查</p>
              <h2 className="section-title mt-1">从应用登记到业务事件的完整链路</h2>
              <p className="mt-1 text-sm text-slate-500">逐段核对配置和真实数据，问题可直接跳转到对应处理位置。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedAppId}
                onChange={(event) => setSelectedAppId(event.target.value)}
                className="input h-11 min-w-[260px]"
                aria-label="选择需要检查的应用"
              >
                {applicationSpaces.map(space => (
                  <option key={space.appId} value={space.appId}>
                    {space.displayName || space.appId} · {space.appId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary px-3"
                title="重新检查应用接入链路"
                onClick={() => loadIntegrationHealth()}
                disabled={!selectedAppId || integrationHealthLoading}
              >
                <RefreshCw size={17} className={integrationHealthLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {integrationHealthError ? (
            <div className="m-5 flex items-center gap-3 rounded-xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
              <AlertTriangle size={18} />
              {integrationHealthError}
            </div>
          ) : integrationHealthLoading ? (
            <div className="grid gap-3 p-5 xl:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 7].map(index => (
                <div key={index} className="h-44 rounded-xl bg-slate-200/60 animate-shimmer" />
              ))}
            </div>
          ) : integrationHealth ? (
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${getIntegrationStatusMeta(integrationHealth.status).className}`}>
                    {getIntegrationStatusMeta(integrationHealth.status).label}
                  </span>
                  <span className="font-semibold text-slate-900">{integrationHealth.displayName || integrationHealth.appId}</span>
                  <span className="font-mono text-xs text-slate-500">{integrationHealth.appId}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span><strong className="text-[#1e7e57]">{integrationSummary.passed}</strong> 已完成</span>
                  <span><strong className="text-[#8a6d1d]">{integrationSummary.waiting + integrationSummary.warning}</strong> 待处理</span>
                  <span><strong className="text-[#9a6026]">{integrationSummary.blocked}</strong> 阻断</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                {(integrationHealth.checks || []).map((check, index) => {
                  const statusMeta = getIntegrationCheckStatusMeta(check.status)
                  const targetHref = check.target === 'experiments'
                    ? `/ai-design?appId=${encodeURIComponent(integrationHealth.appId)}`
                    : (check.target === 'runtime'
                      ? `/experiments?appId=${encodeURIComponent(integrationHealth.appId)}`
                      : '')
                  return (
                    <article key={check.code || index} className="flex min-h-[190px] flex-col rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-slate-900">{check.title}</h3>
                      <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{check.detail}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-500">事实数 {formatCount(check.evidenceCount)}</span>
                        {check.action ? (
                          targetHref ? (
                            <Link to={targetHref} className="font-semibold text-[var(--brand)] hover:underline">
                              {getIntegrationTargetLabel(check.target)}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="font-semibold text-[var(--brand)] hover:underline"
                              onClick={() => {
                                if (check.target === 'dictionary') {
                                  setSelectedDictionaryAppId(integrationHealth.appId)
                                  setActiveWorkspacePanel('dictionary')
                                } else {
                                  setActiveWorkspacePanel('spaces')
                                }
                              }}
                            >
                              {getIntegrationTargetLabel(check.target)}
                            </button>
                          )
                        ) : <span className="font-semibold text-[#1e7e57]">无需处理</span>}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['事件定义', integrationHealth.eventDefinitionCount],
                  ['指标定义', integrationHealth.metricDefinitionCount],
                  ['实验配置', integrationHealth.experimentCount],
                  ['分流事实', integrationHealth.assignmentCount],
                  ['曝光事实', integrationHealth.exposureCount],
                  ['业务事件', integrationHealth.eventCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCount(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-500">请选择应用后开始接入检查</div>
          )}
        </section>
      ) : null}

      {activeWorkspacePanel === 'approvals' ? (
      <section className="glass-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff8ef] text-[#9a6026]">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="signal-label">审批待办</p>
              <h2 className="section-title mt-1">配置/启动审批待办</h2>
            </div>
          </div>
          <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-3 py-1 text-sm font-semibold text-[#9a6026]">
            {formatCount(approvalTasks.length)} 待处理
          </span>
        </div>

        {approvalError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            <AlertTriangle size={18} />
            {approvalError}
          </div>
        ) : approvalLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[1, 2].map(index => (
              <div key={index} className="h-36 rounded-2xl bg-slate-200/60 animate-shimmer" />
            ))}
          </div>
        ) : approvalTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            当前没有待审批实验
          </div>
        ) : (
          <div className="grid max-h-[56vh] gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
            {approvalTasks.map(task => {
              const taskKey = getApprovalTaskKey(task)
              const approveActionId = `${taskKey}:APPROVED`
              const rejectActionId = `${taskKey}:REJECTED`
              const riskDisabled = Boolean(task.approvalRiskDisabledReason)
              const riskOverrideAllowed = Boolean(task.riskOverrideAllowed)
              const permissionDisabled = task.approvable === false
                && (!riskDisabled || task.approvalDisabledReason !== task.approvalRiskDisabledReason)
              const approveDisabled = permissionDisabled || (riskDisabled && !riskOverrideAllowed)
              const rejectDisabled = permissionDisabled
              return (
                <div key={taskKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{task.experimentName || task.experimentId}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{task.experimentId}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {getApprovalTaskTypeLabel(task.approvalType)}
                      </span>
                      <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2.5 py-1 text-xs font-semibold text-[#9a6026]">
                        {getApprovalStatusLabel(task.approvalStatus || 'PENDING')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.appId || '默认应用'}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.owner || '系统'}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                      提交 {task.approvalRequestedBy || '-'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                      审批 {(task.approvalOwners || []).join(', ') || task.approvalOwner || '未配置'}
                    </span>
                    <span className="rounded-full border border-[#cde5d7] bg-[#f6fbf8] px-2 py-1 text-[#1e7e57]">
                      {getApprovalProgressText(task)}
                    </span>
                    {getApprovalSlaText(task) ? (
                      <span className={`rounded-full border px-2 py-1 ${getApprovalSlaClassName(task.approvalSlaStatus)}`}>
                        {getApprovalSlaText(task)}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                      {getExperimentStatusLabel(task.experimentStatus || 'DRAFT')}
                    </span>
                    {task.layerId ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.layerId}</span>
                    ) : null}
                    {task.configVersion ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">v{task.configVersion}</span>
                    ) : null}
                    {task.draftVersion ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        草稿 v{task.draftVersion}
                      </span>
                    ) : null}
                    {task.baseConfigVersion ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        基线 v{task.baseConfigVersion}
                      </span>
                    ) : null}
                    {task.approvalRiskLevel && task.approvalRiskLevel !== 'UNKNOWN' ? (
                      <span className={`rounded-full border px-2 py-1 ${
                        task.approvalRiskLevel === 'BLOCKED'
                          ? 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>
                        风险 {task.approvalRiskLevel === 'BLOCKED'
                          ? getGuardrailStatusLabel(task.approvalRiskLevel)
                          : '需关注'}
                      </span>
                    ) : null}
                    {task.latestReportSnapshotVersion ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        报告 v{task.latestReportSnapshotVersion}
                      </span>
                    ) : null}
                    {(task.approvalRiskFlags || []).map(flag => (
                      <span key={flag} className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-1 text-[#9a6026]">
                        {getRiskFlagLabel(flag)}
                      </span>
                    ))}
                  </div>
                  {(task.breachedGuardrails || []).length > 0 ? (
                    <p className="mt-3 rounded-xl border border-[#ecd8bf] bg-[#fff8ef] px-3 py-2 text-sm text-[#9a6026]">
                      护栏异常：{task.breachedGuardrails.join('；')}
                    </p>
                  ) : null}
                  {task.approvalEscalationReason ? (
                    <p className="mt-3 rounded-xl border border-[#ecd8bf] bg-[#fff8ef] px-3 py-2 text-sm text-[#9a6026]">
                      {localizeSystemText(task.approvalEscalationReason)}
                      {(task.approvalEscalationOwners || []).length > 0
                        ? `，升级接收人：${task.approvalEscalationOwners.join(', ')}`
                        : ''}
                    </p>
                  ) : null}
                  {task.draftComment ? (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                      {task.draftComment}
                    </p>
                  ) : null}
                  {task.approvalComment ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{task.approvalComment}</p>
                  ) : null}
                  {task.approvalDisabledReason ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#ecd8bf] bg-[#fff8ef] px-3 py-2 text-sm text-[#9a6026]">
                      <AlertTriangle size={16} />
                      {localizeSystemText(task.approvalDisabledReason) || '当前身份不可审批'}
                    </div>
                  ) : null}
                  <input
                    value={approvalComments[taskKey] || ''}
                    onChange={(event) => updateApprovalComment(taskKey, event.target.value)}
                    className="input mt-4 h-10 px-3 py-2"
                    placeholder="审批备注"
                    disabled={permissionDisabled}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary py-2"
                      onClick={() => updateApprovalTaskStatus(task, 'APPROVED')}
                      disabled={approveDisabled || approvalActionId === approveActionId}
                    >
                      <CheckCircle2 size={16} />
                      {approvalActionId === approveActionId ? '处理中' : riskOverrideAllowed ? '豁免通过' : '通过'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary py-2 text-[#b44f42]"
                      onClick={() => updateApprovalTaskStatus(task, 'REJECTED')}
                      disabled={rejectDisabled || approvalActionId === rejectActionId}
                    >
                      <XCircle size={16} />
                      {approvalActionId === rejectActionId ? '处理中' : '拒绝'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      ) : null}

      {activeWorkspacePanel === 'escalations' ? (
      <section className="glass-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fffbea] text-[#8a6d1d]">
              <BellRing size={18} />
            </div>
            <div>
              <p className="signal-label">通知投递</p>
              <h2 className="section-title mt-1">审批升级告警</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#f3e3a0] bg-[#fffbea] px-3 py-1 text-sm font-semibold text-[#8a6d1d]">
              {formatCount(approvalEscalations.length)} 条待确认
            </span>
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              escalationHealthy
                ? 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
                : 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
            }`}>
              {escalationHealthy ? '投递健康' : '投递异常'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600">
              未送达 {formatCount(escalationUndeliveredCount)}
            </span>
            {escalationDeliveryUndeliveredCount > 0 ? (
              <span className="rounded-full border border-[#f3e3a0] bg-white px-3 py-1 text-sm font-semibold text-[#8a6d1d]">
                通道未送达 {formatCount(escalationDeliveryUndeliveredCount)}
              </span>
            ) : null}
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              escalationDispatcherEnabled
                ? 'border-[#cde5d7] bg-white text-[#1e7e57]'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              {escalationDispatcherEnabled
                ? `目标 ${formatCount(escalationDispatcherTargetCount)}`
                : '投递未启用'}
            </span>
            {escalationDispatcherChannelText ? (
              <span
                className="max-w-[18rem] truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600"
                title={escalationDispatcherChannelText}
              >
                通道 {escalationDispatcherChannelText}
              </span>
            ) : null}
            {escalationRetryCount > 0 ? (
              <span className="rounded-full border border-[#f3e3a0] bg-white px-3 py-1 text-sm font-semibold text-[#8a6d1d]">
                重试 {formatCount(escalationRetryCount)}
              </span>
            ) : null}
            {escalationDeadCount > 0 ? (
              <span className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-3 py-1 text-sm font-semibold text-[#9a6026]">
                死信 {formatCount(escalationDeadCount)}
              </span>
            ) : null}
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 py-2"
              onClick={retryDeadApprovalEscalations}
              disabled={escalationDeadCount === 0 || escalationActionId === 'retry-dead'}
            >
              <RotateCcw size={16} className={escalationActionId === 'retry-dead' ? 'animate-spin' : ''} />
              重投死信
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 py-2"
              onClick={scanApprovalEscalations}
              disabled={escalationActionId === 'scan'}
            >
              <RefreshCw size={16} className={escalationActionId === 'scan' ? 'animate-spin' : ''} />
              扫描
            </button>
          </div>
        </div>

        {escalationError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            <AlertTriangle size={18} />
            {escalationError}
          </div>
        ) : escalationLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[1, 2].map(index => (
              <div key={index} className="h-28 rounded-2xl bg-slate-200/60 animate-shimmer" />
            ))}
          </div>
        ) : approvalEscalations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            当前没有打开的审批升级告警
          </div>
        ) : (
          <div className="grid max-h-[56vh] gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
            {approvalEscalations.map(escalation => {
              const escalationKey = getEscalationKey(escalation)
              const notificationStatus = getNotificationStatusMeta(escalation.notificationStatus)
              const notificationAttemptCount = Number(escalation.notificationAttemptCount || 0)
              const notificationNextAttemptAt = formatDateTime(escalation.notificationNextAttemptAt)
              const notificationDeliveredAt = formatDateTime(escalation.notificationDeliveredAt)
              const notificationDeliveries = Array.isArray(escalation.notificationDeliveries)
                ? escalation.notificationDeliveries
                : []
              return (
                <div key={escalationKey} className="rounded-2xl border border-[#f3e3a0] bg-[#fffbea] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {escalation.experimentName || escalation.experimentId}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{escalation.escalationId}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        notificationStatus.className
                      }`}>
                        {notificationStatus.label}
                      </span>
                      <span className="rounded-full border border-[#ecd8bf] bg-white px-2.5 py-1 text-xs font-semibold text-[#9a6026]">
                        {getEscalationStatusLabel(escalation.escalationStatus || 'OPEN')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {escalation.appId || '默认应用'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {getApprovalTaskTypeLabel(escalation.approvalType)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      审批时效 {Number(escalation.approvalElapsedHours || 0)}/{escalation.approvalSlaHours || '-'} 小时
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      通道 {getNotificationChannelLabel(escalation.notificationChannel || 'OUTBOX')}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      投递 {notificationAttemptCount} 次
                    </span>
                    {notificationNextAttemptAt ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                        下次 {notificationNextAttemptAt}
                      </span>
                    ) : null}
                    {notificationDeliveredAt ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                        送达 {notificationDeliveredAt}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[#8a6d1d] ring-1 ring-[#f3e3a0]">
                    {localizeSystemText(escalation.escalationReason || '审批已超过审批时效')}
                    {(escalation.escalationOwners || []).length > 0
                      ? `，接收人：${escalation.escalationOwners.join(', ')}`
                      : ''}
                  </p>
                  {escalation.notificationLastError ? (
                    <p className="mt-2 break-words rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-xs text-[#9a6026]">
                      最近错误：{localizeSystemText(escalation.notificationLastError)}
                    </p>
                  ) : null}
                  {notificationDeliveries.length > 0 ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {notificationDeliveries.map(delivery => {
                        const deliveryStatus = getNotificationStatusMeta(delivery.notificationStatus)
                        const deliveryNextAttemptAt = formatDateTime(delivery.notificationNextAttemptAt)
                        const deliveryDeliveredAt = formatDateTime(delivery.notificationDeliveredAt)
                        return (
                          <div
                            key={`${escalationKey}:${delivery.targetKey || delivery.channelName}`}
                            className="border-t border-[#f3e3a0] pt-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-800">
                                {getNotificationChannelLabel(delivery.channelName || 'DEFAULT')}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 font-semibold ${deliveryStatus.className}`}>
                                {deliveryStatus.label}
                              </span>
                              <span className="font-mono text-slate-500">
                                {delivery.targetKey || '-'}
                              </span>
                              <span>
                                {Number(delivery.notificationAttemptCount || 0)} 次
                              </span>
                              {deliveryNextAttemptAt ? (
                                <span>下次 {deliveryNextAttemptAt}</span>
                              ) : null}
                              {deliveryDeliveredAt ? (
                                <span>送达 {deliveryDeliveredAt}</span>
                              ) : null}
                            </div>
                            {delivery.notificationLastError ? (
                              <p className="mt-1 break-words text-[#9a6026]">
                                {localizeSystemText(delivery.notificationLastError)}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {escalation.notificationStatus === 'DEAD' ? (
                      <button
                        type="button"
                        className="btn-secondary py-2 text-[#9a6026]"
                        onClick={() => retryApprovalEscalationNotification(escalation)}
                        disabled={escalationActionId === `retry:${escalationKey}`}
                      >
                        <RotateCcw size={16} />
                        {escalationActionId === `retry:${escalationKey}` ? '重投中' : '重投'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary py-2"
                      onClick={() => acknowledgeApprovalEscalation(escalation)}
                      disabled={escalationActionId === escalationKey}
                    >
                      <CheckCircle2 size={16} />
                      {escalationActionId === escalationKey ? '处理中' : '确认'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      ) : null}

      {activeWorkspacePanel === 'dictionary' ? (
      <section className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand)]">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="signal-label">应用字典</p>
            <h2 className="section-title mt-1">事件与指标字典</h2>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="listbox" aria-label="选择应用">
            {applicationSpaces.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                暂无可选应用
              </div>
            ) : applicationSpaces.map(space => {
              const selected = selectedDictionaryAppId === space.appId
              return (
                <button
                  key={space.appId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setSelectedDictionaryAppId(space.appId)}
                  className={`flex min-w-[240px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${selected
                    ? 'border-blue-300 bg-blue-50 text-[var(--brand)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-slate-900">{space.displayName || space.appId}</strong>
                    <small className="mt-0.5 block truncate text-xs opacity-70">{space.appId}</small>
                  </span>
                  {selected ? <Check size={16} className="shrink-0" /> : null}
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadApplicationDictionary()}
              className="btn-secondary flex items-center gap-2"
              disabled={!selectedDictionaryAppId || dictionaryLoading}
              title="刷新当前应用字典"
            >
              <RefreshCw size={16} className={dictionaryLoading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              type="button"
              onClick={() => openDictionaryEditor('event')}
              className="btn-secondary flex items-center gap-2"
              disabled={!selectedDictionaryAppId}
            >
              <Plus size={16} />
              新增事件
            </button>
            <button
              type="button"
              onClick={() => openDictionaryEditor('metric')}
              className="btn-primary flex items-center gap-2"
              disabled={!selectedDictionaryAppId || dictionaryEventDefinitions.length === 0}
            >
              <Plus size={16} />
              新增指标
            </button>
          </div>
        </div>

        {dictionaryError ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            <AlertTriangle size={18} />
            {dictionaryError}
          </div>
        ) : dictionaryLoading ? (
          <div className="mt-5 grid max-h-[58vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
            {[1, 2].map(index => (
              <div key={index} className="h-48 rounded-[1.2rem] bg-slate-200/60 animate-shimmer" />
            ))}
          </div>
        ) : selectedDictionaryAppId ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {renderDictionaryList(
              '事件定义',
              dictionaryEventDefinitions,
              '当前应用还没有沉淀事件定义',
              item => (
                <>
                  {item.category ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-[var(--brand)]">
                      {getEventCategoryLabel(item.category)}
                    </span>
                  ) : null}
                  {item.primary ? (
                    <span className="rounded-full bg-[#f6fbf8] px-2 py-1 text-xs text-[#1e7e57]">主事件</span>
                  ) : null}
                </>
              ),
              'event'
            )}
            {renderDictionaryList(
              '指标定义',
              dictionaryMetricDefinitions,
              '当前应用还没有沉淀指标定义',
              item => (
                <>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                    {getMetricAggregationLabel(item.aggregationType || 'RATE')}
                  </span>
                  {item.primaryMetric ? (
                    <span className="rounded-full bg-[#f6fbf8] px-2 py-1 text-xs text-[#1e7e57]">主指标</span>
                  ) : null}
                  {item.guardrailMetric ? (
                    <span className="rounded-full bg-[#fff8ef] px-2 py-1 text-xs text-[#9a6026]">护栏</span>
                  ) : null}
                </>
              ),
              'metric'
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            先注册或配置一个应用
          </div>
        )}
      </section>
      ) : null}

      {dictionaryEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="signal-label">应用字典</p>
                <h2 className="section-title mt-1">{dictionaryEditor.type === 'event' ? '维护事件定义' : '维护指标定义'}</h2>
              </div>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900" title="关闭" aria-label="关闭字典编辑器" onClick={() => setDictionaryEditor(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-600">{dictionaryEditor.type === 'event' ? '事件编码' : '指标编码'}
                <input className="input mt-2 font-mono" value={dictionaryEditor.key} onChange={event => updateDictionaryEditor('key', event.target.value.toUpperCase())} placeholder={dictionaryEditor.type === 'event' ? 'PRODUCT_VIEW' : 'ORDER_RATE'} />
              </label>
              <label className="block text-sm text-slate-600">{dictionaryEditor.type === 'event' ? '事件名称' : '指标名称'}
                <input className="input mt-2" value={dictionaryEditor.type === 'event' ? dictionaryEditor.label : dictionaryEditor.name} onChange={event => updateDictionaryEditor(dictionaryEditor.type === 'event' ? 'label' : 'name', event.target.value)} placeholder={dictionaryEditor.type === 'event' ? '例如：浏览商品详情' : '例如：下单转化率'} />
              </label>

              {dictionaryEditor.type === 'event' ? (
                <>
                  <label className="block text-sm text-slate-600">事件分类
                    <select className="input mt-2" value={dictionaryEditor.category} onChange={event => updateDictionaryEditor('category', event.target.value)}>
                      {EVENT_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={dictionaryEditor.primary} onChange={event => updateDictionaryEditor('primary', event.target.checked)} />
                    设为主事件
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm text-slate-600">聚合方式
                    <select className="input mt-2" value={dictionaryEditor.aggregationType} onChange={event => updateDictionaryEditor('aggregationType', event.target.value)}>
                      {METRIC_AGGREGATION_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-600">分子事件
                    <select className="input mt-2" value={dictionaryEditor.numeratorEventType} onChange={event => updateDictionaryEditor('numeratorEventType', event.target.value)}>
                      <option value="">选择事件</option>
                      {dictionaryEventDefinitions.map(item => <option key={item.key} value={item.key}>{item.label}（{item.key}）</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-600">分母口径
                    <select className="input mt-2" value={dictionaryEditor.denominatorType} onChange={event => updateDictionaryEditor('denominatorType', event.target.value)} disabled={dictionaryEditor.aggregationType === 'COUNT'}>
                      {METRIC_DENOMINATOR_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-600">分母事件
                    <select className="input mt-2" value={dictionaryEditor.denominatorEventType} onChange={event => updateDictionaryEditor('denominatorEventType', event.target.value)} disabled={dictionaryEditor.aggregationType !== 'RATE' || dictionaryEditor.denominatorType !== 'EVENT_COUNT'}>
                      <option value="">选择事件</option>
                      {dictionaryEventDefinitions.map(item => <option key={item.key} value={item.key}>{item.label}（{item.key}）</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={dictionaryEditor.primaryMetric} onChange={event => updateDictionaryEditor('primaryMetric', event.target.checked)} />
                    设为主指标
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={dictionaryEditor.guardrailMetric} onChange={event => updateDictionaryEditor('guardrailMetric', event.target.checked)} />
                    设为护栏指标
                  </label>
                </>
              )}

              <label className="block text-sm text-slate-600 md:col-span-2">说明
                <textarea className="textarea mt-2 resize-none" rows="3" value={dictionaryEditor.description} onChange={event => updateDictionaryEditor('description', event.target.value)} placeholder="说明采集时机、计算口径或使用范围" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setDictionaryEditor(null)}>取消</button>
              <button type="button" className="btn-primary" onClick={saveDictionaryEntry} disabled={dictionarySaving}>
                {dictionarySaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {dictionarySaving ? '保存中' : '保存字典'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeWorkspacePanel === 'spaces' ? (
      <>
      <section className="glass-card flex flex-col overflow-hidden lg:h-[calc(100vh-19rem)] lg:min-h-[420px]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">应用列表</h2>
            <p className="mt-1 text-sm text-slate-500">选择应用后，直接在右侧维护完整配置。</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <div className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Search size={16} />
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input h-11 pr-4"
              style={{ paddingLeft: '3rem' }}
              placeholder="搜索应用、展示名或负责人"
            />
          </div>
        </div>

        {error ? (
          <div className="m-5 flex items-center gap-3 rounded-2xl border border-[#ecd8bf] bg-[#fff8ef] p-4 text-sm text-[#9a6026]">
            <AlertTriangle size={18} />
            {error}
          </div>
        ) : loading ? (
          <div className="grid min-h-[420px] flex-1 gap-0 lg:min-h-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-3 border-r border-slate-200 p-4">
              {[1, 2, 3].map(index => <div key={index} className="h-20 rounded-xl bg-slate-200/60 animate-shimmer" />)}
            </div>
            <div className="m-5 rounded-xl bg-slate-100 animate-shimmer" />
          </div>
        ) : applicationSpaces.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-slate-500">
            <Building2 size={44} className="mx-auto mb-4 text-slate-400" />
            <p className="font-semibold text-slate-700">还没有应用</p>
            <button type="button" className="btn-primary mt-4" onClick={openCreateDialog}>
              <Plus size={16} />
              注册第一个应用
            </button>
          </div>
        ) : (
          <div className="grid min-h-[460px] flex-1 lg:min-h-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50/60 xl:border-b-0 xl:border-r">
              <div className="max-h-[64vh] space-y-2 overflow-y-auto p-3 lg:h-full lg:max-h-none">
                {filteredSpaces.length === 0 ? (
                  <div className="px-3 py-12 text-center text-sm text-slate-500">没有匹配的应用</div>
                ) : filteredSpaces.map(space => (
                  <button
                    key={space.appId}
                    type="button"
                    onClick={() => setSelectedAppId(space.appId)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedAppId === space.appId
                        ? 'border-blue-200 bg-white shadow-sm'
                        : 'border-transparent hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        selectedAppId === space.appId ? 'bg-blue-50 text-[var(--brand)]' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Building2 size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{space.displayName || space.appId}</p>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{space.appId}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{formatCount(space.experimentCount)}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                      <span>{space.defaultOwner || '未设负责人'}</span>
                      <span>{formatCount(space.runningExperimentCount)} 运行中</span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedSpace && selectedDraft ? (
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="flex shrink-0 flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xl font-bold text-slate-900">{selectedSpace.displayName || selectedSpace.appId}</h3>
                      {selectedDraft.approvalRequired ? (
                        <span className="badge border border-blue-200 bg-blue-50 text-[var(--brand)]">需要审批</span>
                      ) : (
                        <span className="badge border border-slate-200 bg-slate-50 text-slate-600">无需审批</span>
                      )}
                      {selectedDraft.releaseWindowEnabled ? (
                        <span className="badge border border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]">已设发布窗口</span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{selectedSpace.appId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedDictionaryAppId(selectedSpace.appId)
                        setActiveWorkspacePanel('dictionary')
                      }}
                    >
                      <BookOpen size={16} />
                      查看字典
                    </button>
                    <Link to={`/experiments?appId=${encodeURIComponent(selectedSpace.appId)}`} className="btn-secondary">
                      {formatCount(selectedSpace.experimentCount)} 个实验
                    </Link>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => saveApplicationSpace(selectedSpace.appId, selectedDraft)}
                      disabled={savingAppId === selectedSpace.appId}
                    >
                      <Save size={16} />
                      {savingAppId === selectedSpace.appId ? '保存中' : '保存配置'}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <section className="border-b border-slate-200 p-5">
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-900">基础信息</h4>
                      <p className="mt-1 text-sm text-slate-500">应用名称、负责人和可创建实验数量。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="text-sm text-slate-600">
                        展示名称
                        <input value={selectedDraft.displayName} onChange={event => updateDraft(selectedSpace.appId, 'displayName', event.target.value)} className="input mt-2" />
                      </label>
                      <label className="text-sm text-slate-600">
                        默认负责人
                        <input value={selectedDraft.defaultOwner} onChange={event => updateDraft(selectedSpace.appId, 'defaultOwner', event.target.value)} className="input mt-2" placeholder="输入负责人" />
                      </label>
                      <label className="text-sm text-slate-600">
                        实验配额
                        <input value={selectedDraft.experimentQuota} onChange={event => updateDraft(selectedSpace.appId, 'experimentQuota', event.target.value)} className="input mt-2" placeholder="不限制" inputMode="numeric" />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-lg bg-slate-100 px-3 py-2">已用 {formatCount(selectedSpace.quotaUsed)}，剩余 {selectedSpace.quotaRemaining ?? '不限'}</span>
                      {(selectedSpace.owners || []).map(owner => <span key={owner} className="rounded-lg bg-slate-100 px-3 py-2">成员 {owner}</span>)}
                    </div>
                  </section>

                  <section className="border-b border-slate-200 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">审批策略</h4>
                        <p className="mt-1 text-sm text-slate-500">控制配置发布和实验启动前是否需要人工确认。</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        {selectedDraft.approvalRequired ? <ShieldCheck size={18} className="text-[var(--brand)]" /> : <ShieldOff size={18} className="text-slate-400" />}
                        {selectedDraft.approvalRequired ? '已启用' : '未启用'}
                        {renderApprovalSwitch(
                          selectedDraft.approvalRequired,
                          value => updateDraft(selectedSpace.appId, 'approvalRequired', value),
                          '切换审批策略'
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="text-sm text-slate-600">
                        审批人
                        <input value={selectedDraft.approvalOwners} onChange={event => updateDraft(selectedSpace.appId, 'approvalOwners', event.target.value)} className="input mt-2" placeholder="多人使用逗号分隔" disabled={!selectedDraft.approvalRequired} />
                      </label>
                      <label className="text-sm text-slate-600">
                        通过人数
                        <input value={selectedDraft.approvalRequiredCount} onChange={event => updateDraft(selectedSpace.appId, 'approvalRequiredCount', event.target.value)} className="input mt-2" inputMode="numeric" disabled={!selectedDraft.approvalRequired} />
                      </label>
                      <label className="text-sm text-slate-600">
                        审批时效（小时）
                        <input value={selectedDraft.approvalSlaHours} onChange={event => updateDraft(selectedSpace.appId, 'approvalSlaHours', event.target.value)} className="input mt-2" inputMode="numeric" disabled={!selectedDraft.approvalRequired} />
                      </label>
                      <label className="text-sm text-slate-600">
                        升级接收人
                        <input value={selectedDraft.approvalEscalationOwners} onChange={event => updateDraft(selectedSpace.appId, 'approvalEscalationOwners', event.target.value)} className="input mt-2" placeholder="多人使用逗号分隔" disabled={!selectedDraft.approvalRequired} />
                      </label>
                    </div>
                  </section>

                  <section className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">发布窗口</h4>
                        <p className="mt-1 text-sm text-slate-500">限制配置可以正式发布的星期和时间范围。</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <Clock3 size={18} className={selectedDraft.releaseWindowEnabled ? 'text-[var(--brand)]' : 'text-slate-400'} />
                        {selectedDraft.releaseWindowEnabled ? '已启用' : '未启用'}
                        {renderApprovalSwitch(
                          selectedDraft.releaseWindowEnabled,
                          value => updateDraft(selectedSpace.appId, 'releaseWindowEnabled', value),
                          '切换发布窗口'
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(300px,1.5fr)_repeat(3,minmax(130px,1fr))]">
                      <fieldset className="text-sm text-slate-600" disabled={!selectedDraft.releaseWindowEnabled}>
                        <legend>发布星期</legend>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(releaseWindowDayLabels).map(([day, label]) => {
                            const numericDay = Number(day)
                            const selected = getDraftReleaseWindowDays(selectedDraft.releaseWindowDays).has(numericDay)
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => updateDraft(
                                  selectedSpace.appId,
                                  'releaseWindowDays',
                                  toggleDraftReleaseWindowDay(selectedDraft.releaseWindowDays, numericDay)
                                )}
                                className={`h-10 min-w-10 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                                  selected
                                    ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                                    : 'border-slate-200 bg-white text-slate-500'
                                } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                                disabled={!selectedDraft.releaseWindowEnabled}
                                aria-pressed={selected}
                              >
                                {label.replace('周', '')}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>
                      <label className="text-sm text-slate-600">
                        开始时间
                        <input value={selectedDraft.releaseWindowStartTime} onChange={event => updateDraft(selectedSpace.appId, 'releaseWindowStartTime', event.target.value)} className="input mt-2" type="time" disabled={!selectedDraft.releaseWindowEnabled} />
                      </label>
                      <label className="text-sm text-slate-600">
                        结束时间
                        <input value={selectedDraft.releaseWindowEndTime} onChange={event => updateDraft(selectedSpace.appId, 'releaseWindowEndTime', event.target.value)} className="input mt-2" type="time" disabled={!selectedDraft.releaseWindowEnabled} />
                      </label>
                      <label className="text-sm text-slate-600">
                        时区
                        <select value={selectedDraft.releaseWindowTimezone} onChange={event => updateDraft(selectedSpace.appId, 'releaseWindowTimezone', event.target.value)} className="input mt-2" disabled={!selectedDraft.releaseWindowEnabled}>
                          <option value="Asia/Shanghai">中国标准时间</option>
                        </select>
                      </label>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">从左侧选择一个应用</div>
            )}
          </div>
        )}
      </section>

      {createDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6" role="dialog" aria-modal="true">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="signal-label">注册应用</p>
                  <h2 className="section-title mt-1">建立新应用</h2>
                  <p className="mt-1 text-sm text-slate-500">完成应用信息后，再按需设置审批和发布规则。</p>
                </div>
                <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" onClick={closeCreateDialog} title="关闭">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3" aria-label="注册步骤">
                <button type="button" className="flex items-center gap-3 text-left" onClick={() => setCreateStep(1)} aria-current={createStep === 1 ? 'step' : undefined}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    createStep === 1 ? 'bg-[var(--brand)] text-white' : 'bg-[#e8f5ee] text-[#1e7e57]'
                  }`}>
                    {createStep === 2 ? <Check size={16} /> : '1'}
                  </span>
                  <span><strong className="block text-sm text-slate-900">基本信息</strong><small className="text-xs text-slate-500">标识、名称和负责人</small></span>
                </button>
                <span className={`h-px w-16 ${createStep === 2 ? 'bg-[var(--brand)]' : 'bg-slate-200'}`} />
                <button type="button" className="flex items-center gap-3 text-left disabled:cursor-not-allowed" onClick={() => createBasicInfoComplete && setCreateStep(2)} disabled={!createBasicInfoComplete} aria-current={createStep === 2 ? 'step' : undefined}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    createStep === 2 ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-500'
                  }`}>2</span>
                  <span><strong className="block text-sm text-slate-900">管理规则</strong><small className="text-xs text-slate-500">审批和发布时间</small></span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {createStep === 1 ? (
                <section className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">填写应用信息</h3>
                      <p className="mt-1 text-sm text-slate-500">标有“必填”的信息完成后可以继续。</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">1 / 2</span>
                  </div>

                  <div className="mt-5 grid gap-x-5 gap-y-6 md:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      <span className="flex items-center gap-2 font-medium">应用标识 <em className="not-italic text-[#b44f42]">必填</em></span>
                      <input
                        value={newAppId}
                        onChange={event => setNewAppId(event.target.value.toLowerCase())}
                        className={`input mt-2 ${normalizedNewAppId && (!newAppIdFormatValid || !newAppIdAvailable) ? 'border-[#d89a91]' : ''}`}
                        placeholder="例如 phone-shop"
                        aria-invalid={Boolean(normalizedNewAppId && (!newAppIdFormatValid || !newAppIdAvailable))}
                      />
                      <span className={`mt-1.5 block text-xs ${normalizedNewAppId && (!newAppIdFormatValid || !newAppIdAvailable) ? 'text-[#b44f42]' : 'text-slate-500'}`}>
                        {!newAppIdFormatValid ? '仅支持小写字母、数字、短横线、下划线和点号，最长 128 位' : !newAppIdAvailable ? '该标识已存在，请更换' : '创建后不可修改'}
                      </span>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="flex items-center gap-2 font-medium">展示名称 <em className="not-italic text-[#b44f42]">必填</em></span>
                      <input value={newDraft.displayName} onChange={event => updateNewDraft('displayName', event.target.value)} className="input mt-2" placeholder="例如 二手手机商城" />
                      <span className="mt-1.5 block text-xs text-slate-500">用于页面展示和搜索</span>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="flex items-center gap-2 font-medium">默认负责人 <em className="not-italic text-[#b44f42]">必填</em></span>
                      <input value={newDraft.defaultOwner} onChange={event => updateNewDraft('defaultOwner', event.target.value)} className="input mt-2" placeholder="输入负责人" />
                      <span className="mt-1.5 block text-xs text-slate-500">承接应用实验和异常处理</span>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="font-medium">实验配额 <em className="ml-2 not-italic text-slate-400">可选</em></span>
                      <input
                        value={newDraft.experimentQuota}
                        onChange={event => updateNewDraft('experimentQuota', event.target.value)}
                        className={`input mt-2 ${!newQuotaValid ? 'border-[#d89a91]' : ''}`}
                        placeholder="留空表示不限制"
                        inputMode="numeric"
                        aria-invalid={!newQuotaValid}
                      />
                      <span className={`mt-1.5 block text-xs ${newQuotaValid ? 'text-slate-500' : 'text-[#b44f42]'}`}>
                        {newQuotaValid ? '限制该应用可创建的实验数量' : '请输入大于或等于 0 的整数'}
                      </span>
                    </label>
                  </div>
                </section>
              ) : (
                <>
                  <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm sm:grid-cols-4">
                    <div><span className="block text-xs text-slate-500">应用</span><strong className="mt-1 block truncate text-slate-900">{newDraft.displayName}</strong></div>
                    <div><span className="block text-xs text-slate-500">标识</span><strong className="mt-1 block truncate font-mono text-slate-900">{normalizedNewAppId}</strong></div>
                    <div><span className="block text-xs text-slate-500">负责人</span><strong className="mt-1 block truncate text-slate-900">{newDraft.defaultOwner}</strong></div>
                    <div><span className="block text-xs text-slate-500">实验配额</span><strong className="mt-1 block text-slate-900">{newQuotaText || '不限制'}</strong></div>
                  </div>

                  <section className="border-b border-slate-200 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div><h3 className="font-semibold text-slate-900">审批策略</h3><p className="mt-1 text-sm text-slate-500">开启后，配置发布和实验启动均需审批。</p></div>
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                        {newDraft.approvalRequired ? '已开启' : '暂不开启'}
                        {renderApprovalSwitch(newDraft.approvalRequired, value => updateNewDraft('approvalRequired', value), '切换审批策略')}
                      </div>
                    </div>
                    {newDraft.approvalRequired ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-sm text-slate-600">审批人<input value={newDraft.approvalOwners} onChange={event => updateNewDraft('approvalOwners', event.target.value)} className="input mt-2" placeholder="留空使用默认负责人" /></label>
                        <label className="text-sm text-slate-600">通过人数<input value={newDraft.approvalRequiredCount} onChange={event => updateNewDraft('approvalRequiredCount', event.target.value)} className={`input mt-2 ${!newApprovalRequiredCountValid ? 'border-[#d89a91]' : ''}`} inputMode="numeric" />{!newApprovalRequiredCountValid ? <span className="mt-1.5 block text-xs text-[#b44f42]">通过人数不能超过审批人数</span> : null}</label>
                        <label className="text-sm text-slate-600">审批时效（小时）<input value={newDraft.approvalSlaHours} onChange={event => updateNewDraft('approvalSlaHours', event.target.value)} className={`input mt-2 ${!newApprovalSlaValid ? 'border-[#d89a91]' : ''}`} inputMode="numeric" placeholder="留空表示不限时" />{!newApprovalSlaValid ? <span className="mt-1.5 block text-xs text-[#b44f42]">请输入正整数</span> : null}</label>
                        <label className="text-sm text-slate-600">超时接收人<input value={newDraft.approvalEscalationOwners} onChange={event => updateNewDraft('approvalEscalationOwners', event.target.value)} className="input mt-2" placeholder="留空使用审批人" /></label>
                      </div>
                    ) : null}
                  </section>

                  <section className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div><h3 className="font-semibold text-slate-900">发布窗口</h3><p className="mt-1 text-sm text-slate-500">开启后，只允许在指定时间发布配置。</p></div>
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                        {newDraft.releaseWindowEnabled ? '已开启' : '暂不开启'}
                        {renderApprovalSwitch(newDraft.releaseWindowEnabled, value => updateNewDraft('releaseWindowEnabled', value), '切换发布窗口')}
                      </div>
                    </div>
                    {newDraft.releaseWindowEnabled ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <fieldset className="text-sm text-slate-600">
                          <legend>允许发布的星期</legend>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(releaseWindowDayLabels).map(([day, label]) => {
                              const numericDay = Number(day)
                              const selected = getDraftReleaseWindowDays(newDraft.releaseWindowDays).has(numericDay)
                              return <button key={day} type="button" onClick={() => updateNewDraft('releaseWindowDays', toggleDraftReleaseWindowDay(newDraft.releaseWindowDays, numericDay))} className={`h-10 min-w-10 rounded-lg border px-2 text-xs font-semibold ${selected ? 'border-blue-200 bg-blue-50 text-[var(--brand)]' : 'border-slate-200 bg-white text-slate-500'}`} aria-pressed={selected}>{label.replace('周', '')}</button>
                            })}
                          </div>
                        </fieldset>
                        <label className="text-sm text-slate-600">时区<select value={newDraft.releaseWindowTimezone} onChange={event => updateNewDraft('releaseWindowTimezone', event.target.value)} className="input mt-2"><option value="Asia/Shanghai">中国标准时间</option></select></label>
                        <label className="text-sm text-slate-600">开始时间<input value={newDraft.releaseWindowStartTime} onChange={event => updateNewDraft('releaseWindowStartTime', event.target.value)} className="input mt-2" type="time" /></label>
                        <label className="text-sm text-slate-600">结束时间<input value={newDraft.releaseWindowEndTime} onChange={event => updateNewDraft('releaseWindowEndTime', event.target.value)} className={`input mt-2 ${!newReleaseWindowValid ? 'border-[#d89a91]' : ''}`} type="time" />{!newReleaseWindowValid ? <span className="mt-1.5 block text-xs text-[#b44f42]">结束时间必须晚于开始时间</span> : null}</label>
                      </div>
                    ) : null}
                  </section>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4">
              <p className="hidden text-xs text-slate-500 sm:block">{createStep === 1 ? '请先完成 3 项必填信息' : '确认规则后完成注册'}</p>
              <div className="ml-auto flex gap-3">
                {createStep === 1 ? (
                  <>
                    <button type="button" className="btn-secondary" onClick={closeCreateDialog}>取消</button>
                    <button type="button" className="btn-primary" onClick={() => setCreateStep(2)} disabled={!createBasicInfoComplete}>
                      下一步：设置管理规则
                      <ArrowRight size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => setCreateStep(1)}><ArrowLeft size={16} />上一步</button>
                    <button type="button" className="btn-primary" onClick={() => saveApplicationSpace(newAppId, newDraft)} disabled={!createGovernanceComplete || savingAppId === normalizedNewAppId}>
                      <Check size={16} />
                      {savingAppId === normalizedNewAppId ? '注册中' : '完成注册'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  )
}
