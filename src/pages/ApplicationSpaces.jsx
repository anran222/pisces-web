import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from 'lucide-react'
import { applicationAPI, experimentAPI } from '../services/api'
import {
  buildApplicationSpaceDraft,
  buildApplicationSpacePayload,
  summarizeApplicationSpaces,
} from '../utils/applicationSpaceGovernance'

const formatCount = (value) => Number(value || 0).toLocaleString()
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
  return `SLA ${elapsedHours}/${task.approvalSlaHours}h`
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
    label: status || '待投递',
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
const formatReleaseWindow = (space) => {
  if (!space.releaseWindowEnabled) {
    return '未启用'
  }
  const days = (space.releaseWindowDays || [1, 2, 3, 4, 5])
    .map(day => releaseWindowDayLabels[day] || day)
    .join('、')
  return `${days} ${space.releaseWindowStartTime || '09:00'}-${space.releaseWindowEndTime || '18:00'} ${
    space.releaseWindowTimezone || 'Asia/Shanghai'
  }`
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
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState('approvals')

  useEffect(() => {
    loadGovernance()
  }, [])

  useEffect(() => {
    if (selectedDictionaryAppId) {
      loadApplicationDictionary(selectedDictionaryAppId)
    }
  }, [selectedDictionaryAppId])

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
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || '应用空间加载失败')
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
      setApprovalError(loadError.response?.data?.message || loadError.message || '审批任务加载失败')
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
      setEscalationError(loadError.response?.data?.message || loadError.message || '升级告警加载失败')
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
      setDictionaryError(loadError.response?.data?.message || loadError.message || '应用字典加载失败')
    } finally {
      setDictionaryLoading(false)
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
      alert('更新审批状态失败: ' + (approvalError.response?.data?.message || approvalError.message))
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
      alert('扫描审批升级告警失败: ' + (scanError.response?.data?.message || scanError.message))
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
      alert('确认审批升级告警失败: ' + (ackError.response?.data?.message || ackError.message))
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
      alert('重投审批升级死信失败: ' + (retryError.response?.data?.message || retryError.message))
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
      alert('重投审批升级告警失败: ' + (retryError.response?.data?.message || retryError.message))
    } finally {
      setEscalationActionId('')
    }
  }

  const saveApplicationSpace = async (appId, draft) => {
    const normalizedAppId = appId.trim()
    if (!normalizedAppId) {
      alert('应用 ID 不能为空')
      return
    }

    try {
      setSavingAppId(normalizedAppId)
      const payload = buildApplicationSpacePayload(draft)
      const response = await applicationAPI.upsert(normalizedAppId, payload)
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
      if (normalizedAppId === newAppId.trim()) {
        setNewAppId('')
        setNewDraft(buildApplicationSpaceDraft())
      }
    } catch (saveError) {
      alert('保存应用空间失败: ' + (saveError.response?.data?.message || saveError.message))
    } finally {
      setSavingAppId('')
    }
  }

  const renderApprovalSwitch = (checked, onChange) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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

  const renderDictionaryList = (title, items, emptyMessage, renderMeta) => (
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-slate-900">{item.key}</span>
                {renderMeta(item)}
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
  const escalationDispatcherChannelText = escalationDispatcherChannels.join(', ')
  const workspaceTabs = [
    { key: 'approvals', label: '审批待办', count: approvalTasks.length },
    { key: 'escalations', label: '升级告警', count: approvalEscalations.length },
    { key: 'dictionary', label: '事件字典', count: dictionaryEventDefinitions.length + dictionaryMetricDefinitions.length },
    { key: 'spaces', label: '空间配置', count: filteredSpaces.length },
  ]

  return (
    <div className="space-y-6">
      <section className="glass-card p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="eyebrow mb-3">Governance</div>
            <h1 className="page-title">应用空间</h1>
            <p className="page-subtitle mt-2">管理应用归属、负责人、实验额度、配置/启动审批、SLA 和发布窗口。</p>
          </div>
          <button
            type="button"
            onClick={loadGovernance}
            className="btn-secondary flex items-center gap-2"
            disabled={loading || approvalLoading || escalationLoading}
          >
            <RefreshCw size={16} className={loading || approvalLoading || escalationLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="fact-tile">
          <p className="signal-label">Applications</p>
          <p className="signal-value">{formatCount(summary.applicationCount)}</p>
        </div>
        <div className="fact-tile">
          <p className="signal-label">Experiments</p>
          <p className="signal-value">{formatCount(summary.experimentCount)}</p>
        </div>
        <div className="fact-tile">
          <p className="signal-label">Running</p>
          <p className="signal-value">{formatCount(summary.runningExperimentCount)}</p>
        </div>
        <div className="fact-tile">
          <p className="signal-label">Approval</p>
          <p className="signal-value">{formatCount(summary.approvalRequiredCount)}</p>
        </div>
        <div className="fact-tile">
          <p className="signal-label">SLA</p>
          <p className="signal-value">{formatCount(summary.approvalSlaEnabledCount)}</p>
        </div>
        <div className="fact-tile">
          <p className="signal-label">Windows</p>
          <p className="signal-value">{formatCount(summary.releaseWindowEnabledCount)}</p>
        </div>
      </section>

      <nav className="glass-card p-2">
        <div className="flex flex-wrap gap-2">
          {workspaceTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeWorkspacePanel === tab.key
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setActiveWorkspacePanel(tab.key)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {formatCount(tab.count)}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {activeWorkspacePanel === 'approvals' ? (
      <section className="glass-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff8ef] text-[#9a6026]">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="signal-label">Approvals</p>
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
                        {task.approvalStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.appId || 'default'}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.owner || 'system'}</span>
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
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{task.experimentStatus || 'DRAFT'}</span>
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
                        风险 {task.approvalRiskLevel}
                      </span>
                    ) : null}
                    {task.latestReportSnapshotVersion ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                        报告 v{task.latestReportSnapshotVersion}
                      </span>
                    ) : null}
                    {(task.approvalRiskFlags || []).map(flag => (
                      <span key={flag} className="rounded-full border border-[#ecd8bf] bg-[#fff8ef] px-2 py-1 text-[#9a6026]">
                        {flag}
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
                      {task.approvalEscalationReason}
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
                      {task.approvalDisabledReason || '当前身份不可审批'}
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
              <p className="signal-label">Outbox</p>
              <h2 className="section-title mt-1">审批升级告警</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#f3e3a0] bg-[#fffbea] px-3 py-1 text-sm font-semibold text-[#8a6d1d]">
              {formatCount(approvalEscalations.length)} OPEN
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
                        {escalation.escalationStatus || 'OPEN'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {escalation.appId || 'default'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {getApprovalTaskTypeLabel(escalation.approvalType)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      SLA {Number(escalation.approvalElapsedHours || 0)}/{escalation.approvalSlaHours || '-'}h
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      通道 {escalation.notificationChannel || 'OUTBOX'}
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
                    {escalation.escalationReason || '审批已超过 SLA'}
                    {(escalation.escalationOwners || []).length > 0
                      ? `，接收人：${escalation.escalationOwners.join(', ')}`
                      : ''}
                  </p>
                  {escalation.notificationLastError ? (
                    <p className="mt-2 break-words rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-xs text-[#9a6026]">
                      最近错误：{escalation.notificationLastError}
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
                                {delivery.channelName || 'DEFAULT'}
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
                                {delivery.notificationLastError}
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
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand)]">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="signal-label">Dictionary</p>
                <h2 className="section-title mt-1">事件与指标字典</h2>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedDictionaryAppId}
              onChange={(event) => setSelectedDictionaryAppId(event.target.value)}
              className="input h-11 min-w-[220px]"
              disabled={applicationSpaces.length === 0}
            >
              {applicationSpaces.length === 0 ? (
                <option value="">暂无应用</option>
              ) : (
                applicationSpaces.map(space => (
                  <option key={space.appId} value={space.appId}>
                    {space.displayName || space.appId} · {space.appId}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => loadApplicationDictionary()}
              className="btn-secondary flex items-center gap-2"
              disabled={!selectedDictionaryAppId || dictionaryLoading}
            >
              <RefreshCw size={16} className={dictionaryLoading ? 'animate-spin' : ''} />
              刷新字典
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
                      {item.category}
                    </span>
                  ) : null}
                  {item.primary ? (
                    <span className="rounded-full bg-[#f6fbf8] px-2 py-1 text-xs text-[#1e7e57]">主事件</span>
                  ) : null}
                </>
              )
            )}
            {renderDictionaryList(
              '指标定义',
              dictionaryMetricDefinitions,
              '当前应用还没有沉淀指标定义',
              item => (
                <>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                    {item.aggregationType || 'RATE'}
                  </span>
                  {item.primaryMetric ? (
                    <span className="rounded-full bg-[#f6fbf8] px-2 py-1 text-xs text-[#1e7e57]">主指标</span>
                  ) : null}
                  {item.guardrailMetric ? (
                    <span className="rounded-full bg-[#fff8ef] px-2 py-1 text-xs text-[#9a6026]">护栏</span>
                  ) : null}
                </>
              )
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            先注册或配置一个应用空间
          </div>
        )}
      </section>
      ) : null}

      {activeWorkspacePanel === 'spaces' ? (
      <>
      <section className="glass-card p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(150px,200px)_1fr_1fr_minmax(110px,150px)_minmax(180px,1fr)_minmax(100px,130px)_auto_auto]">
          <input
            value={newAppId}
            onChange={(event) => setNewAppId(event.target.value)}
            className="input"
            placeholder="应用 ID"
          />
          <input
            value={newDraft.displayName}
            onChange={(event) => updateNewDraft('displayName', event.target.value)}
            className="input"
            placeholder="展示名称"
          />
          <input
            value={newDraft.defaultOwner}
            onChange={(event) => updateNewDraft('defaultOwner', event.target.value)}
            className="input"
            placeholder="默认负责人"
          />
          <input
            value={newDraft.experimentQuota}
            onChange={(event) => updateNewDraft('experimentQuota', event.target.value)}
            className="input"
            placeholder="实验配额"
            inputMode="numeric"
          />
          <input
            value={newDraft.approvalOwners}
            onChange={(event) => updateNewDraft('approvalOwners', event.target.value)}
            className="input"
            placeholder="审批人，逗号分隔"
          />
          <input
            value={newDraft.approvalRequiredCount}
            onChange={(event) => updateNewDraft('approvalRequiredCount', event.target.value)}
            className="input"
            placeholder="通过人数"
            inputMode="numeric"
          />
          <input
            value={newDraft.approvalSlaHours}
            onChange={(event) => updateNewDraft('approvalSlaHours', event.target.value)}
            className="input"
            placeholder="SLA 小时"
            inputMode="numeric"
          />
          <input
            value={newDraft.approvalEscalationOwners}
            onChange={(event) => updateNewDraft('approvalEscalationOwners', event.target.value)}
            className="input"
            placeholder="升级接收人"
          />
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4">
            {newDraft.approvalRequired ? (
              <ShieldCheck size={16} className="text-[var(--brand)]" />
            ) : (
              <ShieldOff size={16} className="text-slate-400" />
            )}
            {renderApprovalSwitch(newDraft.approvalRequired, value => updateNewDraft('approvalRequired', value))}
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4">
            <Clock3 size={16} className={newDraft.releaseWindowEnabled ? 'text-[var(--brand)]' : 'text-slate-400'} />
            {renderApprovalSwitch(
              newDraft.releaseWindowEnabled,
              value => updateNewDraft('releaseWindowEnabled', value)
            )}
          </div>
          <input
            value={newDraft.releaseWindowDays}
            onChange={(event) => updateNewDraft('releaseWindowDays', event.target.value)}
            className="input"
            placeholder="发布星期 1,2,3,4,5"
            disabled={!newDraft.releaseWindowEnabled}
          />
          <input
            value={newDraft.releaseWindowStartTime}
            onChange={(event) => updateNewDraft('releaseWindowStartTime', event.target.value)}
            className="input"
            type="time"
            disabled={!newDraft.releaseWindowEnabled}
          />
          <input
            value={newDraft.releaseWindowEndTime}
            onChange={(event) => updateNewDraft('releaseWindowEndTime', event.target.value)}
            className="input"
            type="time"
            disabled={!newDraft.releaseWindowEnabled}
          />
          <input
            value={newDraft.releaseWindowTimezone}
            onChange={(event) => updateNewDraft('releaseWindowTimezone', event.target.value)}
            className="input"
            placeholder="Asia/Shanghai"
            disabled={!newDraft.releaseWindowEnabled}
          />
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => saveApplicationSpace(newAppId, newDraft)}
            disabled={savingAppId === newAppId.trim()}
          >
            <Plus size={16} />
            注册
          </button>
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <div className="relative max-w-xl">
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
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(index => (
              <div key={index} className="h-20 rounded-xl bg-slate-200/60 animate-shimmer" />
            ))}
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Building2 size={44} className="mx-auto mb-4 text-slate-400" />
            没有匹配的应用空间
          </div>
        ) : (
          <div className="max-h-[58vh] overflow-auto">
            <table className="min-w-[1580px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">应用</th>
                  <th className="px-5 py-4">默认负责人</th>
                  <th className="px-5 py-4">审批人</th>
                  <th className="px-5 py-4">实验配额</th>
                  <th className="px-5 py-4">配置/启动审批</th>
                  <th className="px-5 py-4">发布窗口</th>
                  <th className="px-5 py-4">规模</th>
                  <th className="px-5 py-4">来源</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSpaces.map((space) => {
                  const draft = drafts[space.appId] || buildApplicationSpaceDraft(space)
                  const isSaving = savingAppId === space.appId

                  return (
                    <tr key={space.appId} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand)]">
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              value={draft.displayName}
                              onChange={(event) => updateDraft(space.appId, 'displayName', event.target.value)}
                              className="input h-10 px-3 py-2"
                              placeholder={space.appId}
                            />
                            <p className="mt-2 font-mono text-xs text-slate-500">{space.appId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          value={draft.defaultOwner}
                          onChange={(event) => updateDraft(space.appId, 'defaultOwner', event.target.value)}
                          className="input h-10 px-3 py-2"
                          placeholder="默认负责人"
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(space.owners || []).slice(0, 3).map(owner => (
                            <span key={owner} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                              {owner}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          value={draft.approvalOwners}
                          onChange={(event) => updateDraft(space.appId, 'approvalOwners', event.target.value)}
                          className="input h-10 px-3 py-2"
                          placeholder="为空时使用默认负责人"
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(space.approvalOwners || []).slice(0, 4).map(owner => (
                            <span key={owner} className="rounded-full border border-[#cde5d7] bg-[#f6fbf8] px-2 py-1 text-xs text-[#1e7e57]">
                              {owner}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <input
                          value={draft.experimentQuota}
                          onChange={(event) => updateDraft(space.appId, 'experimentQuota', event.target.value)}
                          className="input h-10 px-3 py-2"
                          placeholder="不限制"
                          inputMode="numeric"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          已用 {formatCount(space.quotaUsed)} / 剩余 {space.quotaRemaining ?? '不限'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {draft.approvalRequired ? (
                            <ShieldCheck size={18} className="text-[var(--brand)]" />
                          ) : (
                            <ShieldOff size={18} className="text-slate-400" />
                          )}
                          {renderApprovalSwitch(
                            draft.approvalRequired,
                            value => updateDraft(space.appId, 'approvalRequired', value)
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {draft.approvalRequired ? `至少 ${draft.approvalRequiredCount || 1} 人通过` : '不要求审批'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          策略 v{space.approvalPolicyVersion || 1}
                        </p>
                        <input
                          value={draft.approvalRequiredCount}
                          onChange={(event) => updateDraft(space.appId, 'approvalRequiredCount', event.target.value)}
                          className="input mt-3 h-10 px-3 py-2"
                          placeholder="通过人数"
                          inputMode="numeric"
                          disabled={!draft.approvalRequired}
                        />
                        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                          <BellRing size={14} />
                          {formatApprovalSla(space)}
                        </p>
                        <input
                          value={draft.approvalSlaHours}
                          onChange={(event) => updateDraft(space.appId, 'approvalSlaHours', event.target.value)}
                          className="input mt-2 h-10 px-3 py-2"
                          placeholder="SLA 小时"
                          inputMode="numeric"
                          disabled={!draft.approvalRequired}
                        />
                        <input
                          value={draft.approvalEscalationOwners}
                          onChange={(event) => updateDraft(space.appId, 'approvalEscalationOwners', event.target.value)}
                          className="input mt-2 h-10 px-3 py-2"
                          placeholder="升级接收人，逗号分隔"
                          disabled={!draft.approvalRequired}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Clock3 size={18} className={draft.releaseWindowEnabled ? 'text-[var(--brand)]' : 'text-slate-400'} />
                          {renderApprovalSwitch(
                            draft.releaseWindowEnabled,
                            value => updateDraft(space.appId, 'releaseWindowEnabled', value)
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{formatReleaseWindow(space)}</p>
                        <div className="mt-3 grid gap-2">
                          <input
                            value={draft.releaseWindowDays}
                            onChange={(event) => updateDraft(space.appId, 'releaseWindowDays', event.target.value)}
                            className="input h-10 px-3 py-2"
                            placeholder="1,2,3,4,5"
                            disabled={!draft.releaseWindowEnabled}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={draft.releaseWindowStartTime}
                              onChange={(event) => updateDraft(space.appId, 'releaseWindowStartTime', event.target.value)}
                              className="input h-10 px-3 py-2"
                              type="time"
                              disabled={!draft.releaseWindowEnabled}
                            />
                            <input
                              value={draft.releaseWindowEndTime}
                              onChange={(event) => updateDraft(space.appId, 'releaseWindowEndTime', event.target.value)}
                              className="input h-10 px-3 py-2"
                              type="time"
                              disabled={!draft.releaseWindowEnabled}
                            />
                          </div>
                          <input
                            value={draft.releaseWindowTimezone}
                            onChange={(event) => updateDraft(space.appId, 'releaseWindowTimezone', event.target.value)}
                            className="input h-10 px-3 py-2"
                            placeholder="Asia/Shanghai"
                            disabled={!draft.releaseWindowEnabled}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p>{formatCount(space.experimentCount)} 个实验</p>
                        <p className="mt-2 text-xs text-slate-500">{formatCount(space.runningExperimentCount)} 运行中</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {space.registered ? (
                            <span className="badge border border-blue-200 bg-blue-50 text-[var(--brand)]">注册表</span>
                          ) : null}
                          {space.configured ? (
                            <span className="badge border border-slate-200 bg-white text-slate-600">API Key</span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(space.scopes || []).map(scope => (
                            <span key={scope} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-2"
                          onClick={() => saveApplicationSpace(space.appId, draft)}
                          disabled={isSaving}
                        >
                          <Save size={16} />
                          {isSaving ? '保存中' : '保存'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>
      ) : null}
    </div>
  )
}
