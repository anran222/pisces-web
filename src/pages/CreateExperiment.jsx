import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft,
  Plus,
  Trash2,
  FlaskConical,
  Save
} from 'lucide-react'
import { experimentAPI } from '../services/api'

const STRATEGIES = [
  { value: 'HASH', label: '哈希分配', desc: '基于访客ID的一致性哈希' },
  { value: 'RANDOM', label: '随机分配', desc: '完全随机分配' },
  { value: 'THOMPSON_SAMPLING', label: 'Thompson Sampling', desc: 'MAB算法：汤普森采样' },
  { value: 'UCB', label: 'UCB', desc: 'MAB算法：置信区间上界' },
]

export default function CreateExperiment() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const getDefaultStartTime = () => {
    const now = new Date(Date.now() + 5 * 60 * 1000) // 默认5分钟后开始
    return now.toISOString().slice(0, 16)
  }

  const getDefaultEndTime = () => {
    const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    return oneWeekLater.toISOString().slice(0, 16)
  }

  const [form, setForm] = useState({
    name: '',
    description: '',
    startTime: getDefaultStartTime(),
    endTime: getDefaultEndTime(),
    groups: [
      { id: 'control', name: '对照组', trafficRatio: 0.5, config: {} },
      { id: 'variant_a', name: '变体A', trafficRatio: 0.5, config: {} },
    ],
    traffic: {
      totalTraffic: 1.0,
      strategy: 'HASH',
    }
  })

  const updateGroup = (index, field, value) => {
    const newGroups = [...form.groups]
    newGroups[index] = { ...newGroups[index], [field]: value }
    setForm({ ...form, groups: newGroups })
  }

  const addGroup = () => {
    const newGroups = [...form.groups]
    const ratio = 1 / (newGroups.length + 1)
    newGroups.forEach((g, i) => {
      newGroups[i] = { ...g, trafficRatio: ratio }
    })
    newGroups.push({
      id: `variant_${String.fromCharCode(97 + newGroups.length - 1)}`,
      name: `变体${String.fromCharCode(65 + newGroups.length - 1)}`,
      trafficRatio: ratio,
      config: {}
    })
    setForm({ ...form, groups: newGroups })
  }

  const removeGroup = (index) => {
    if (form.groups.length <= 2) {
      alert('至少需要2个实验组')
      return
    }
    const newGroups = form.groups.filter((_, i) => i !== index)
    const ratio = 1 / newGroups.length
    newGroups.forEach((g, i) => {
      newGroups[i] = { ...g, trafficRatio: ratio }
    })
    setForm({ ...form, groups: newGroups })
  }

  const equalizeRatios = () => {
    const ratio = 1 / form.groups.length
    const newGroups = form.groups.map(g => ({ ...g, trafficRatio: ratio }))
    setForm({ ...form, groups: newGroups })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 验证
    if (!form.name.trim()) {
      alert('请输入实验名称')
      return
    }

    if (!form.startTime || !form.endTime) {
      alert('请输入开始和结束时间')
      return
    }

    if (new Date(form.endTime) <= new Date(form.startTime)) {
      alert('结束时间必须晚于开始时间')
      return
    }
    
    const totalRatio = form.groups.reduce((sum, g) => sum + g.trafficRatio, 0)
    if (Math.abs(totalRatio - 1) > 0.01) {
      alert('流量比例总和必须等于100%')
      return
    }

    try {
      setLoading(true)
      const requestData = {
        name: form.name,
        description: form.description,
        startTime: form.startTime,
        endTime: form.endTime,
        groups: form.groups,
        traffic: {
          totalTraffic: form.traffic.totalTraffic,
          strategy: form.traffic.strategy,
          allocation: form.groups.map(g => ({
            group: g.id,
            ratio: g.trafficRatio
          }))
        }
      }
      
      const response = await experimentAPI.create(requestData)
      alert('实验创建成功！')
      navigate(`/experiments/${response.data.id}`)
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/experiments')}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold gradient-text">创建实验</h1>
          <p className="text-slate-400 text-sm mt-1">配置新的A/B测试实验</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FlaskConical size={20} className="text-pisces-400" />
            基本信息
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">实验名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：首页按钮颜色测试"
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">实验描述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="描述实验目的和假设..."
                className="input min-h-[100px] resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">开始时间 *</label>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">结束时间 *</label>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="input"
                  required
                  min={form.startTime}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">实验组配置</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={equalizeRatios}
                className="btn-secondary text-sm"
              >
                平均分配
              </button>
              <button
                type="button"
                onClick={addGroup}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus size={16} /> 添加组
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {form.groups.map((group, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-400">
                    {index === 0 ? '对照组' : `变体 ${index}`}
                  </span>
                  {form.groups.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(index)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">组ID</label>
                    <input
                      type="text"
                      value={group.id}
                      onChange={(e) => updateGroup(index, 'id', e.target.value)}
                      className="input text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">组名称</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => updateGroup(index, 'name', e.target.value)}
                      className="input text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      流量比例 ({(group.trafficRatio * 100).toFixed(0)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={group.trafficRatio * 100}
                      onChange={(e) => updateGroup(index, 'trafficRatio', parseInt(e.target.value) / 100)}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Total ratio warning */}
          {Math.abs(form.groups.reduce((sum, g) => sum + g.trafficRatio, 0) - 1) > 0.01 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              ⚠️ 流量比例总和为 {(form.groups.reduce((sum, g) => sum + g.trafficRatio, 0) * 100).toFixed(0)}%，
              应等于100%
            </div>
          )}
        </div>

        {/* Traffic Strategy */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">流量分配策略</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STRATEGIES.map(strategy => (
              <label
                key={strategy.value}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  form.traffic.strategy === strategy.value
                    ? 'bg-pisces-500/20 border-pisces-500/50'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={strategy.value}
                  checked={form.traffic.strategy === strategy.value}
                  onChange={(e) => setForm({
                    ...form,
                    traffic: { ...form.traffic, strategy: e.target.value }
                  })}
                  className="sr-only"
                />
                <div className="font-medium text-white">{strategy.label}</div>
                <div className="text-sm text-slate-400 mt-1">{strategy.desc}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/experiments')}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={18} />
            {loading ? '创建中...' : '创建实验'}
          </button>
        </div>
      </form>
    </div>
  )
}
