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
  CheckSquare,
  Square as SquareIcon,
  X
} from 'lucide-react'
import { experimentAPI } from '../services/api'
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
  const [openMenu, setOpenMenu] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadExperiments()
  }, [filter])

  const loadExperiments = async () => {
    try {
      setLoading(true)
      // 使用后端API进行状态筛选
      const status = filter === 'all' ? null : filter
      const response = await experimentAPI.list(status)
      setExperiments(response.data || [])
      setSelectedIds([]) // 清空选择
    } catch (error) {
      console.error('Failed to load experiments:', error)
    } finally {
      setLoading(false)
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

  const filteredExperiments = experiments.filter(exp => {
    const matchesSearch = exp.name?.toLowerCase().includes(search.toLowerCase()) ||
                          exp.id?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || exp.status === filter
    return matchesSearch && matchesFilter
  })

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

      {/* Filters */}
      <div className="glass-card flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="搜索实验..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input h-11 pr-4"
            style={{ paddingLeft: '3rem' }}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'RUNNING', 'DRAFT', 'PAUSED', 'STOPPED'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filter === status
                  ? 'border border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {status === 'all' ? '全部' : statusConfig[status]?.text}
            </button>
          ))}
        </div>
      </div>

      {/* Experiment List */}
      <div className="glass-card relative overflow-visible">
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
              {search || filter !== 'all' ? '没有找到匹配的实验' : '还没有任何实验'}
            </p>
            {!search && filter === 'all' && (
              <Link to="/ai-design" className="btn-primary inline-flex items-center gap-2">
                <Plus size={18} />
                新建实验
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.55rem]">
          <table className="w-full">
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
                <th className="text-left p-4 text-slate-400 font-medium hidden lg:table-cell">创建时间</th>
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
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                              结论状态: {getConclusionLabel(experiment.conclusionStatus)}
                            </span>
                            {experiment.suggestedConclusionStatus && (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[var(--brand)]">
                                建议: {getConclusionLabel(experiment.suggestedConclusionStatus)}
                              </span>
                            )}
                          </div>
                          {experiment.groups && Object.keys(experiment.groups).length > 0 && (
                            <div className="mt-2 text-xs text-slate-500">
                              参数摘要：{Object.entries(experiment.groups)
                                .map(([groupId, group]) => `${group.name || groupId}(${summarizeGroupConfig(group.config)})`)
                                .join('； ')}
                            </div>
                          )}
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
                    <td className="p-4 hidden lg:table-cell text-slate-400 text-sm">
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
    </div>
  )
}
