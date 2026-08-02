import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  FlaskConical, 
  Plus, 
  Search,
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2,
  MoreVertical,
  BarChart3,
  Eye,
  PanelRightOpen,
  CheckSquare,
  Square as SquareIcon,
  Filter,
  X
} from 'lucide-react'
import { applicationAPI, experimentAPI } from '../services/api'
import { filterExperimentsBySearch } from '../utils/experimentFilters'
import { getActionMenuPlacement } from '../utils/experimentListUtils'
import clsx from 'clsx'

const statusConfig = {
  RUNNING: { badge: 'badge-running', text: '运行中', color: 'text-emerald-400' },
  DRAFT: { badge: 'badge-draft', text: '草稿', color: 'text-slate-400' },
  PAUSED: { badge: 'badge-paused', text: '已暂停', color: 'text-amber-400' },
  STOPPED: { badge: 'badge-stopped', text: '已停止', color: 'text-red-400' },
}

const conclusionLabelMap = {
  NOT_READY: '未就绪',
  RUNNING: '运行中',
  READY_FOR_REVIEW: '待审核',
  GRADUATED: '已毕业',
  REJECTED: '已拒绝'
}

const getConclusionLabel = (status) => conclusionLabelMap[status] || status || '-'

const summarizeGroupConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return '暂无参数'
  }
  const entries = Object.entries(config)
  if (entries.length === 0) {
    return '暂无参数'
  }
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' · ')
}

export default function ExperimentList() {
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [appIdInput, setAppIdInput] = useState('')
  const [ownerInput, setOwnerInput] = useState('')
  const [appIdFilter, setAppIdFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [openMenu, setOpenMenu] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewExperiment, setPreviewExperiment] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadExperiments()
  }, [filter, appIdFilter, ownerFilter])

  useEffect(() => {
    loadApplicationSpaces()
  }, [])

  const loadExperiments = async () => {
    try {
      setLoading(true)
      // 使用后端API进行状态筛选
      const status = filter === 'all' ? null : filter
      const response = await experimentAPI.list({
        status,
        appId: appIdFilter,
        owner: ownerFilter
      })
      setExperiments(response.data || [])
      setSelectedIds([]) // 清空选择
    } catch (error) {
      console.error('Failed to load experiments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadApplicationSpaces = async () => {
    try {
      const response = await applicationAPI.list()
      setApplicationSpaces(response.data || [])
    } catch (error) {
      console.warn('Failed to load application spaces:', error)
    }
  }

  const handleAction = async (action, experiment) => {
    try {
      switch (action) {
        case 'start':
          await experimentAPI.start(experiment.id)
          break
        case 'pause':
          await experimentAPI.pause(experiment.id)
          break
        case 'resume':
          await experimentAPI.resume(experiment.id)
          break
        case 'stop':
          await experimentAPI.stop(experiment.id)
          break
        case 'delete':
          if (confirm('确定要删除这个实验吗？')) {
            await experimentAPI.delete(experiment.id)
          }
          break
      }
      loadExperiments()
    } catch (error) {
      console.error('Action failed:', error)
      alert('操作失败: ' + (error.response?.data?.message || error.message))
    }
    setOpenMenu(null)
  }

  // 批量操作
  const handleBatchAction = async (action) => {
    if (selectedIds.length === 0) {
      alert('请先选择要操作的实验')
      return
    }

    const actionLabels = {
      pause: '暂停',
      stop: '停止',
      resume: '恢复',
      delete: '删除'
    }

    if (!confirm(`确定要批量${actionLabels[action]}选中的 ${selectedIds.length} 个实验吗？`)) {
      return
    }

    try {
      setBatchLoading(true)
      let response
      switch (action) {
        case 'pause':
          response = await experimentAPI.batchPause(selectedIds)
          break
        case 'stop':
          response = await experimentAPI.batchStop(selectedIds)
          break
        case 'resume':
          response = await experimentAPI.batchResume(selectedIds)
          break
        case 'delete':
          response = await experimentAPI.batchDelete(selectedIds)
          break
      }
      
      // 响应拦截器已返回data，兼容降级结果对象
      const result = response?.data ?? response
      if (result?.failedCount > 0) {
        const failedMessages = result.failedItems.map(item => `${item.id}: ${item.error}`).join('\n')
        alert(`${result.message}\n\n失败详情:\n${failedMessages}`)
      } else {
        alert(result?.message || '操作完成')
      }
      
      loadExperiments()
    } catch (error) {
      console.error('Batch action failed:', error)
      alert('批量操作失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setBatchLoading(false)
    }
  }

  // 选择/取消选择单个实验
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExperiments.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredExperiments.map(exp => exp.id))
    }
  }

  const filteredExperiments = filterExperimentsBySearch(experiments, search).filter(exp => {
    const matchesFilter = filter === 'all' || exp.status === filter
    return matchesFilter
  })

  const hasActiveFilters = Boolean(search || filter !== 'all' || appIdFilter || ownerFilter)
  const hasPendingScopeFilters = appIdInput.trim() !== appIdFilter || ownerInput.trim() !== ownerFilter

  const applyScopeFilters = () => {
    setAppIdFilter(appIdInput.trim())
    setOwnerFilter(ownerInput.trim())
    setFiltersOpen(false)
  }

  const handleScopeFilterKeyDown = (event) => {
    if (event.key === 'Enter') {
      applyScopeFilters()
    }
  }

  const clearFilters = () => {
    setSearch('')
    setFilter('all')
    setAppIdInput('')
    setOwnerInput('')
    setAppIdFilter('')
    setOwnerFilter('')
    setFiltersOpen(false)
  }

  const getAvailableActions = (status) => {
    switch (status) {
      case 'DRAFT':
        return [
          { action: 'start', icon: Play, label: '启动', color: 'text-emerald-400' },
          { action: 'delete', icon: Trash2, label: '删除', color: 'text-red-400' },
        ]
      case 'RUNNING':
        return [
          { action: 'pause', icon: Pause, label: '暂停', color: 'text-amber-400' },
          { action: 'stop', icon: Square, label: '停止', color: 'text-red-400' },
          { action: 'delete', icon: Trash2, label: '删除', color: 'text-red-400' },
        ]
      case 'PAUSED':
        return [
          { action: 'resume', icon: RotateCcw, label: '恢复', color: 'text-emerald-400' },
          { action: 'stop', icon: Square, label: '停止', color: 'text-red-400' },
          { action: 'delete', icon: Trash2, label: '删除', color: 'text-red-400' },
        ]
      case 'STOPPED':
        return [
          { action: 'delete', icon: Trash2, label: '删除', color: 'text-red-400' },
        ]
      default:
        return []
    }
  }

  // 获取选中实验的状态统计
  const getSelectedStatusStats = () => {
    const stats = { RUNNING: 0, PAUSED: 0, STOPPED: 0, DRAFT: 0 }
    selectedIds.forEach(id => {
      const exp = experiments.find(e => e.id === id)
      if (exp && stats[exp.status] !== undefined) {
        stats[exp.status]++
      }
    })
    return stats
  }

  const selectedStats = getSelectedStatusStats()
  const activeFilterCount = [
    search,
    filter !== 'all' ? filter : '',
    appIdFilter,
    ownerFilter
  ].filter(Boolean).length
  const previewGroups = previewExperiment?.groups
    ? Object.entries(previewExperiment.groups)
    : []

  return (
    <div className="space-y-6">
      <section className="glass-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="eyebrow mb-3">Execution</div>
            <h1 className="page-title">实验工作台</h1>
            <p className="page-subtitle mt-2">这里负责实验执行和状态流转，需要查看建议时可进入每个实验的分析页。</p>
          </div>
          <Link to="/ai-design" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            新建实验
          </Link>
        </div>
      </section>

      {/* Batch Action Bar - 当有选中项时显示 */}
      {selectedIds.length > 0 && (
        <div className="glass-card animate-fade-in p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedIds([])}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
            <span className="text-slate-900 font-medium">
              已选择 <span className="text-[var(--brand)]">{selectedIds.length}</span> 个实验
            </span>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
              {selectedStats.RUNNING > 0 && <span className="text-[#1e7e57]">运行中: {selectedStats.RUNNING}</span>}
              {selectedStats.PAUSED > 0 && <span className="text-[#9a6026]">已暂停: {selectedStats.PAUSED}</span>}
              {selectedStats.STOPPED > 0 && <span className="text-[#b44f42]">已停止: {selectedStats.STOPPED}</span>}
              {selectedStats.DRAFT > 0 && <span className="text-slate-400">草稿: {selectedStats.DRAFT}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedStats.RUNNING > 0 && (
              <button
                onClick={() => handleBatchAction('pause')}
                disabled={batchLoading}
                className="btn-secondary flex items-center gap-2 text-[#9a6026] hover:bg-[#fff3e6]"
              >
                <Pause size={16} />
                <span className="hidden sm:inline">批量暂停</span>
              </button>
            )}
            {selectedStats.PAUSED > 0 && (
              <button
                onClick={() => handleBatchAction('resume')}
                disabled={batchLoading}
                className="btn-secondary flex items-center gap-2 text-[#1e7e57] hover:bg-[#edf8f2]"
              >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">批量恢复</span>
              </button>
            )}
            {(selectedStats.RUNNING > 0 || selectedStats.PAUSED > 0) && (
              <button
                onClick={() => handleBatchAction('stop')}
                disabled={batchLoading}
                className="btn-secondary flex items-center gap-2 text-[#b44f42] hover:bg-[#fff1ef]"
              >
                <Square size={16} />
                <span className="hidden sm:inline">批量停止</span>
              </button>
            )}
            <button
              onClick={() => handleBatchAction('delete')}
              disabled={batchLoading}
              className="btn-secondary flex items-center gap-2 text-[#b44f42] hover:bg-[#fff1ef]"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">批量删除</span>
            </button>
          </div>
        </div>
        </div>
      )}

      <div className="glass-card p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="搜索实验、应用或负责人"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input h-11 pr-4"
              style={{ paddingLeft: '3rem' }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'RUNNING', 'DRAFT', 'PAUSED', 'STOPPED'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={clsx(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  filter === status
                    ? 'border border-blue-200 bg-blue-50 text-[var(--brand)]'
                    : 'border border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {status === 'all' ? '全部' : statusConfig[status]?.text}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="btn-secondary h-11 px-3"
              title="打开应用和负责人筛选"
            >
              <Filter size={16} />
              高级筛选
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[var(--brand)]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={clearFilters}
              disabled={!hasActiveFilters && !appIdInput && !ownerInput}
              className="btn-secondary h-11 px-3 disabled:cursor-not-allowed disabled:opacity-50"
              title="清空筛选"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <datalist id="application-space-options">
          {applicationSpaces.map(space => (
            <option
              key={space.appId}
              value={space.appId}
              label={`${space.displayName || space.appId} · ${space.experimentCount || 0} 实验`}
            />
          ))}
        </datalist>
        {(appIdFilter || ownerFilter) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {appIdFilter && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[var(--brand)]">
                appId: {appIdFilter}
              </span>
            )}
            {ownerFilter && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                owner: {ownerFilter}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Experiment List */}
      <div className="glass-card relative overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-slate-200/60 animate-shimmer" />
            ))}
          </div>
        ) : filteredExperiments.length === 0 ? (
          <div className="text-center py-16">
            <FlaskConical size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="mb-4 text-slate-500">
              {hasActiveFilters ? '没有找到匹配的实验' : '还没有任何实验'}
            </p>
            {!hasActiveFilters && (
              <Link to="/ai-design" className="btn-primary inline-flex items-center gap-2">
                <Plus size={18} />
                新建实验
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="w-12 p-4">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    {selectedIds.length === filteredExperiments.length && filteredExperiments.length > 0 ? (
                      <CheckSquare size={20} className="text-[var(--brand)]" />
                    ) : (
                      <SquareIcon size={20} className="text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="text-left p-4 text-slate-400 font-medium">实验名称</th>
                <th className="text-left p-4 text-slate-400 font-medium hidden md:table-cell">状态</th>
                <th className="text-left p-4 text-slate-400 font-medium hidden lg:table-cell">应用 / 负责人</th>
                <th className="text-left p-4 text-slate-400 font-medium hidden xl:table-cell">结论</th>
                <th className="text-left p-4 text-slate-400 font-medium hidden 2xl:table-cell">创建时间</th>
                <th className="text-right p-4 text-slate-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredExperiments.map((experiment, index) => {
                const status = statusConfig[experiment.status] || statusConfig.DRAFT
                const actions = getAvailableActions(experiment.status)
                const isSelected = selectedIds.includes(experiment.id)
                const menuPlacementClassName = getActionMenuPlacement(index, filteredExperiments.length)
                
                return (
                  <tr 
                    key={experiment.id} 
                    className={clsx(
                      "border-b border-slate-200 transition-colors animate-fade-in hover:bg-slate-50/80",
                      isSelected && "bg-blue-50/70"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="p-4">
                      <button
                        onClick={() => toggleSelect(experiment.id)}
                        className="p-1 rounded transition-colors hover:bg-slate-100"
                      >
                        {isSelected ? (
                          <CheckSquare size={20} className="text-[var(--brand)]" />
                        ) : (
                          <SquareIcon size={20} className="text-slate-500" />
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                          <FlaskConical size={18} className="text-[var(--brand)]" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{experiment.name}</p>
                          <p className="text-sm text-slate-500 font-mono">{experiment.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {experiment.status !== 'DRAFT' ? (
                        <span className={`badge ${status.badge}`}>{status.text}</span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm">
                      <p className="font-medium text-slate-900">{experiment.appId || '-'}</p>
                      <p className="mt-1 text-slate-500">{experiment.owner || '-'}</p>
                    </td>
                    <td className="p-4 hidden xl:table-cell text-sm">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                        {getConclusionLabel(experiment.conclusionStatus)}
                      </span>
                      {experiment.suggestedConclusionStatus && (
                        <p className="mt-2 text-xs text-[var(--brand)]">
                          建议 {getConclusionLabel(experiment.suggestedConclusionStatus)}
                        </p>
                      )}
                    </td>
                    <td className="p-4 hidden 2xl:table-cell text-slate-400 text-sm">
                      {experiment.createTime ? new Date(experiment.createTime).toLocaleString() : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/experiments/${experiment.id}`)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="查看详情"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => setPreviewExperiment(experiment)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="查看配置摘要"
                        >
                          <PanelRightOpen size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/experiments/${experiment.id}/decision`)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="查看分析"
                        >
                          <BarChart3 size={18} />
                        </button>
                        {experiment.status === 'PAUSED' && (
                          <button
                            onClick={() => handleAction('resume', experiment)}
                            className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
                            title="恢复实验"
                          >
                            <RotateCcw size={14} />
                            恢复
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === experiment.id ? null : experiment.id)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenu === experiment.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setOpenMenu(null)}
                              />
                              <div className={`absolute right-0 z-20 min-w-[140px] glass-card p-2 ${menuPlacementClassName}`}>
                                {actions.map(({ action, icon: Icon, label, color }) => (
                                  <button
                                    key={action}
                                    onClick={() => handleAction(action, experiment)}
                                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 ${color}`}
                                  >
                                    <Icon size={16} />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-8">
          <div className="absolute inset-0" onClick={() => setFiltersOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="signal-label">Filters</p>
                <h2 className="section-title mt-2">高级筛选</h2>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                onClick={() => setFiltersOpen(false)}
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">应用 ID</label>
                <input
                  type="text"
                  list="application-space-options"
                  placeholder="例如 growth-shop"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  onKeyDown={handleScopeFilterKeyDown}
                  className="input h-11 px-4"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">负责人</label>
                <input
                  type="text"
                  placeholder="例如 growth-ops"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  onKeyDown={handleScopeFilterKeyDown}
                  className="input h-11 px-4"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters && !appIdInput && !ownerInput}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} />
                清空
              </button>
              <button
                onClick={applyScopeFilters}
                disabled={!hasPendingScopeFilters}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Filter size={16} />
                应用筛选
              </button>
            </div>
          </div>
        </div>
      )}

      {previewExperiment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-8">
          <div className="absolute inset-0" onClick={() => setPreviewExperiment(null)} />
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="signal-label">Experiment Summary</p>
                <h2 className="mt-2 truncate text-lg font-bold text-slate-900">{previewExperiment.name}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{previewExperiment.id}</p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                onClick={() => setPreviewExperiment(null)}
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">状态</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {statusConfig[previewExperiment.status]?.text || previewExperiment.status || '-'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">应用</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{previewExperiment.appId || '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">负责人</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{previewExperiment.owner || '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">配置版本</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">v{previewExperiment.configVersion || '-'}</p>
                </div>
              </div>
              <div className="mt-4 max-h-[48vh] overflow-y-auto rounded-2xl border border-slate-200">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">实验组</th>
                      <th className="px-4 py-3">流量</th>
                      <th className="px-4 py-3">配置摘要</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewGroups.length === 0 ? (
                      <tr>
                        <td className="px-4 py-5 text-slate-500" colSpan={3}>当前实验没有分组配置。</td>
                      </tr>
                    ) : (
                      previewGroups.map(([groupId, group]) => (
                        <tr key={groupId}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{group.name || groupId}</p>
                            <p className="mt-1 font-mono text-xs text-slate-500">{group.id || groupId}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {Math.round(Number(group.trafficRatio || 0) * 100)}%
                          </td>
                          <td className="px-4 py-3 text-slate-600">{summarizeGroupConfig(group.config)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPreviewExperiment(null)}
                >
                  关闭
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate(`/experiments/${previewExperiment.id}`)}
                >
                  <Eye size={16} />
                  打开详情
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
