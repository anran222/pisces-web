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

const PARAMETER_TYPES = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'json', label: 'JSON' },
  { value: 'boolean', label: '布尔' },
  { value: 'enum', label: '枚举' },
  { value: 'color', label: '颜色' },
]

const PARAMETER_TEMPLATES = {
  button: [
    { key: 'buttonText', type: 'string', value: '立即购买' },
    { key: 'buttonColor', type: 'color', value: '#3b82f6' },
    { key: 'buttonSize', type: 'enum', optionsText: 'small,medium,large', value: 'medium' },
  ],
  title: [
    { key: 'titleText', type: 'string', value: '推荐好货' },
    { key: 'titleLength', type: 'number', value: '8' },
  ],
  color: [
    { key: 'primaryColor', type: 'color', value: '#10b981' },
    { key: 'secondaryColor', type: 'color', value: '#3b82f6' },
  ],
  copy: [
    { key: 'copyText', type: 'string', value: '立即查看详情' },
    { key: 'meta', type: 'json', value: '{"channel":"homepage","scene":"banner"}' },
  ],
}

const createParameter = (overrides = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  key: '',
  type: 'string',
  value: '',
  optionsText: '',
  ...overrides,
})

const createGroup = (group) => ({
  ...group,
  parameters: Array.isArray(group.parameters) ? group.parameters : [],
})

const parseParameterValue = (parameter) => {
  const key = (parameter.key || '').trim()
  if (!key) {
    throw new Error('参数名不能为空')
  }

  switch (parameter.type) {
    case 'string':
      return String(parameter.value ?? '')
    case 'number': {
      const numericValue = Number(parameter.value)
      if (Number.isNaN(numericValue)) {
        throw new Error(`参数 ${key} 需要填写数字`)
      }
      return numericValue
    }
    case 'json':
      try {
        return JSON.parse(String(parameter.value || '{}'))
      } catch (error) {
        throw new Error(`参数 ${key} 的 JSON 格式不正确`)
      }
    case 'boolean':
      return parameter.value === true || parameter.value === 'true'
    case 'enum': {
      const options = (parameter.optionsText || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      if (options.length === 0) {
        throw new Error(`参数 ${key} 需要至少 1 个枚举选项`)
      }
      const selectedValue = String(parameter.value || '').trim()
      if (!options.includes(selectedValue)) {
        throw new Error(`参数 ${key} 的取值必须在枚举选项内`)
      }
      return selectedValue
    }
    case 'color':
      return String(parameter.value || '').trim()
    default:
      return parameter.value
  }
}

const buildConfigFromParameters = (parameters) => {
  const config = {}
  parameters.forEach(parameter => {
    const key = (parameter.key || '').trim()
    if (!key) {
      throw new Error('参数名不能为空')
    }
    config[key] = parseParameterValue(parameter)
  })
  return config
}

export default function CreateExperiment() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const getDefaultStartTime = () => {
    const now = new Date(Date.now() + 5 * 60 * 1000)
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
      createGroup({
        id: 'control',
        name: '对照组',
        trafficRatio: 0.5,
        parameters: [createParameter({ key: 'buttonText', value: '立即购买' })],
      }),
      createGroup({
        id: 'variant_a',
        name: '变体A',
        trafficRatio: 0.5,
        parameters: [createParameter({ key: 'buttonText', value: '立即抢购' })],
      }),
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

  const updateGroupParameters = (groupIndex, updater) => {
    const newGroups = [...form.groups]
    const currentGroup = newGroups[groupIndex]
    newGroups[groupIndex] = {
      ...currentGroup,
      parameters: updater(Array.isArray(currentGroup.parameters) ? [...currentGroup.parameters] : []),
    }
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
      parameters: [],
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

  const addParameter = (groupIndex) => {
    updateGroupParameters(groupIndex, parameters => [...parameters, createParameter()])
  }

  const removeParameter = (groupIndex, parameterIndex) => {
    updateGroupParameters(groupIndex, parameters => parameters.filter((_, index) => index !== parameterIndex))
  }

  const updateParameter = (groupIndex, parameterIndex, field, value) => {
    updateGroupParameters(groupIndex, parameters => {
      const next = [...parameters]
      next[parameterIndex] = { ...next[parameterIndex], [field]: value }
      if (field === 'type' && value !== 'enum') {
        next[parameterIndex] = { ...next[parameterIndex], optionsText: value === 'boolean' ? '' : next[parameterIndex].optionsText }
      }
      return next
    })
  }

  const applyTemplate = (groupIndex, templateKey) => {
    const template = PARAMETER_TEMPLATES[templateKey]
    if (!template) {
      return
    }
    updateGroupParameters(groupIndex, () => template.map(item => createParameter(item)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

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
        groups: form.groups.map(group => ({
          id: group.id,
          name: group.name,
          trafficRatio: group.trafficRatio,
          config: buildConfigFromParameters(group.parameters || [])
        })),
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
      const created = response.data || response
      alert('实验创建成功！')
      navigate(`/experiments/${created.id}`)
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/experiments')}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="eyebrow mb-3">Create</div>
          <h1 className="page-title">创建实验</h1>
          <p className="page-subtitle mt-2">围绕业务场景配置实验分组、流量和时间窗口</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                      onChange={(e) => updateGroup(index, 'trafficRatio', parseInt(e.target.value, 10) / 100)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/5 bg-slate-950/30 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-white">变体参数</p>
                      <p className="text-xs text-slate-400 mt-1">
                        允许配置字符串、数字、JSON、布尔、枚举和颜色，最终会保存到 config。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => applyTemplate(index, 'button')} className="btn-secondary text-xs">
                        按钮模板
                      </button>
                      <button type="button" onClick={() => applyTemplate(index, 'title')} className="btn-secondary text-xs">
                        文案模板
                      </button>
                      <button type="button" onClick={() => applyTemplate(index, 'color')} className="btn-secondary text-xs">
                        颜色模板
                      </button>
                      <button type="button" onClick={() => applyTemplate(index, 'copy')} className="btn-secondary text-xs">
                        组合模板
                      </button>
                      <button type="button" onClick={() => addParameter(index)} className="btn-primary text-xs">
                        <Plus size={14} /> 添加参数
                      </button>
                    </div>
                  </div>

                  {(group.parameters || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                      暂无参数，点击“添加参数”或直接套用模板。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {group.parameters.map((parameter, parameterIndex) => {
                        const parameterType = PARAMETER_TYPES.find(item => item.value === parameter.type) || PARAMETER_TYPES[0]
                        return (
                          <div key={parameter.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">参数名</label>
                                  <input
                                    type="text"
                                    value={parameter.key}
                                    onChange={(e) => updateParameter(index, parameterIndex, 'key', e.target.value)}
                                    className="input text-sm"
                                    placeholder="例如 buttonColor"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">参数类型</label>
                                  <select
                                    value={parameter.type}
                                    onChange={(e) => updateParameter(index, parameterIndex, 'type', e.target.value)}
                                    className="input text-sm"
                                  >
                                    {PARAMETER_TYPES.map(type => (
                                      <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-end">
                                  <button
                                    type="button"
                                    onClick={() => removeParameter(index, parameterIndex)}
                                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {parameter.type === 'enum' && (
                              <div className="mb-3">
                                <label className="block text-xs text-slate-500 mb-1">枚举选项（逗号分隔）</label>
                                <input
                                  type="text"
                                  value={parameter.optionsText || ''}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'optionsText', e.target.value)}
                                  className="input text-sm"
                                  placeholder="例如 small,medium,large"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">参数值</label>
                              {parameter.type === 'json' ? (
                                <textarea
                                  value={typeof parameter.value === 'string' ? parameter.value : JSON.stringify(parameter.value || {}, null, 2)}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                  className="input min-h-[110px] resize-y font-mono text-sm"
                                  placeholder='{"buttonColor":"#3b82f6"}'
                                />
                              ) : parameter.type === 'number' ? (
                                <input
                                  type="number"
                                  value={parameter.value}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                  className="input text-sm"
                                  placeholder="例如 12"
                                />
                              ) : parameter.type === 'boolean' ? (
                                <select
                                  value={String(parameter.value || 'false')}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value === 'true')}
                                  className="input text-sm"
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : parameter.type === 'color' ? (
                                <div className="flex gap-3">
                                  <input
                                    type="color"
                                    value={parameter.value || '#3b82f6'}
                                    onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                    className="h-12 w-16 rounded-lg bg-transparent border border-white/10"
                                  />
                                  <input
                                    type="text"
                                    value={parameter.value || ''}
                                    onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                    className="input text-sm flex-1"
                                    placeholder="#3b82f6"
                                  />
                                </div>
                              ) : parameter.type === 'enum' ? (
                                <select
                                  value={parameter.value}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                  className="input text-sm"
                                >
                                  <option value="">请选择 {parameterType.label}</option>
                                  {(parameter.optionsText || '')
                                    .split(',')
                                    .map(option => option.trim())
                                    .filter(Boolean)
                                    .map(option => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={parameter.value}
                                  onChange={(e) => updateParameter(index, parameterIndex, 'value', e.target.value)}
                                  className="input text-sm"
                                  placeholder="例如 蓝色 / 字符串1 / button-primary"
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {Math.abs(form.groups.reduce((sum, g) => sum + g.trafficRatio, 0) - 1) > 0.01 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              ⚠️ 流量比例总和为 {(form.groups.reduce((sum, g) => sum + g.trafficRatio, 0) * 100).toFixed(0)}%，
              应等于100%
            </div>
          )}
        </div>

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
