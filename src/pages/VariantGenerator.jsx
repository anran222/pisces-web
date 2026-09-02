import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppWindow,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Type,
  Upload,
  Wand2,
  X
} from 'lucide-react'
import clsx from 'clsx'
import { applicationAPI, variantAPI } from '../services/api'
import {
  buildDefaultExperimentCreatePayload,
  buildVariantCandidatePayload,
  buildVariantRefinementPayload,
  normalizeVariantGenerationModelEvidence,
  normalizeVariantPlans
} from '../utils/aiDecisionTransformers'
import { getApiModeLabel, localizeSystemText } from '../utils/uiLabels'
import { buildExperimentDraftFromVariantPlans } from '../utils/variantExperimentDraft'

const MODES = [
  { value: 'TEXT', title: '文本方案', description: '标题、卖点、按钮和话术', icon: Type },
  { value: 'IMAGE', title: '图片方案', description: '主图、信息层级和视觉方向', icon: ImageIcon }
]

const INPUT_SECTIONS = [
  { key: 'definition', label: '任务定义', icon: Target },
  { key: 'strategy', label: '内容策略', icon: Lightbulb },
  { key: 'experiment', label: '实验设计', icon: BarChart3 }
]

const DELIVERY_STANDARDS = [
  { title: '策略方向', description: '说清方案依据和差异化角度', icon: Lightbulb },
  { title: '可投放内容', description: '输出可直接进入实验组的最终内容', icon: FileText },
  { title: '实验假设', description: '连接用户心理、方案变化与指标', icon: Target },
  { title: '主指标与目标', description: '明确观测指标和预期改善幅度', icon: BarChart3 },
  { title: '实施建议', description: '说明投放位置和应保持不变的变量', icon: AppWindow },
  { title: '风险护栏', description: '提前约束品牌、合规与转化副作用', icon: ShieldCheck }
]

const TONE_OPTIONS = ['专业可信', '简洁直接', '温和有说服力', '理性数据化', '轻松友好']
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REVISION_HISTORY_COUNT = 5
const TEXT_REFINEMENT_SUGGESTIONS = ['语气更克制', '强化质检差异', '减少促销表达', '让三个方案差异更明显']
const IMAGE_REFINEMENT_SUGGESTIONS = ['减少装饰文字', '突出手机成色', '保留商品角度', '增强质检信息层级']

let conversationMessageSequence = 0

const createConversationMessage = (role, content) => {
  conversationMessageSequence += 1
  return { id: `revision-message-${conversationMessageSequence}`, role, content }
}

const buildInitialForm = () => {
  const defaultExperiment = buildDefaultExperimentCreatePayload()
  return {
    variantType: 'TEXT',
    appId: '',
    businessScenario: '二手手机售卖',
    placement: '商品详情页首屏',
    goal: '提升用户进入结算流程的转化率',
    audience: '关注价格，但担心二手手机质量和售后保障的用户',
    baseline: '当前首屏主要展示机型、价格和成色，质检与售后保障不够突出。',
    hypothesis: '在首屏明确呈现质检和售后保障，可降低用户的质量疑虑，从而提升加购转化率。',
    primaryMetricKey: '',
    primaryMetric: '',
    guardrailMetricKeys: [],
    expectedLift: '5% - 8%',
    startTime: defaultExperiment.startTime,
    endTime: defaultExperiment.endTime,
    sellingPointsText: '99 道官方质检\n一年质保\n7 天无理由退货',
    tone: '专业可信',
    constraintsText: '不夸大质检和质保范围\n不制造价格焦虑\n保持平台可信度',
    riskGuardrail: '不得以模糊承诺换取点击，实验期间持续关注用户负向反馈。',
    sourceContextText: '标题控制在 18 字以内，辅助说明控制在 28 字以内。',
    count: 3,
    referenceImageInput: ''
  }
}

const formatExperimentWindow = (startTime, endTime) => (
  startTime && endTime
    ? `${startTime.replace('T', ' ')} 至 ${endTime.replace('T', ' ')}`
    : '尚未设置实验周期'
)

const addDaysToDateTime = (dateTime, days) => {
  const startDate = dateTime ? new Date(dateTime) : new Date()
  startDate.setDate(startDate.getDate() + days)
  const pad = value => String(value).padStart(2, '0')
  return `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`
}

export default function VariantGenerator() {
  const navigate = useNavigate()
  const [form, setForm] = useState(buildInitialForm)
  const [activeInputSection, setActiveInputSection] = useState('definition')
  const [applicationSpaces, setApplicationSpaces] = useState([])
  const [loadingApplications, setLoadingApplications] = useState(true)
  const [applicationDictionary, setApplicationDictionary] = useState(null)
  const [loadingDictionary, setLoadingDictionary] = useState(false)
  const [dictionaryError, setDictionaryError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [copiedPlanId, setCopiedPlanId] = useState('')
  const [preparingExperiment, setPreparingExperiment] = useState(false)
  const [refinementOpen, setRefinementOpen] = useState(false)
  const [refinementInstruction, setRefinementInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [conversation, setConversation] = useState([])
  const [revisionHistory, setRevisionHistory] = useState([])
  const [revisionNumber, setRevisionNumber] = useState(1)

  useEffect(() => {
    loadApplicationSpaces()
  }, [])

  useEffect(() => {
    let active = true
    if (!form.appId) {
      setApplicationDictionary(null)
      setDictionaryError('')
      return undefined
    }

    setLoadingDictionary(true)
    setDictionaryError('')
    applicationAPI.getDictionary(form.appId)
      .then((response) => {
        if (!active) return
        const dictionary = response.data || response || {}
        const metricDefinitions = dictionary.metricDefinitions || []
        setApplicationDictionary(dictionary)
        setForm((current) => {
          if (current.appId !== form.appId) return current
          const existingPrimaryMetric = metricDefinitions.find(metric => metric.key === current.primaryMetricKey)
          const nextPrimaryMetric = existingPrimaryMetric
            || metricDefinitions.find(metric => metric.primaryMetric)
            || metricDefinitions[0]
            || null
          const metricKeys = new Set(metricDefinitions.map(metric => metric.key))
          const selectedGuardrailMetricKeys = (current.guardrailMetricKeys || [])
            .filter(key => key !== nextPrimaryMetric?.key && metricKeys.has(key))
          const defaultGuardrailMetricKeys = metricDefinitions
            .filter(metric => metric.guardrailMetric && metric.key !== nextPrimaryMetric?.key)
            .map(metric => metric.key)
          return {
            ...current,
            primaryMetricKey: nextPrimaryMetric?.key || '',
            primaryMetric: nextPrimaryMetric?.name || '',
            guardrailMetricKeys: selectedGuardrailMetricKeys.length > 0
              ? selectedGuardrailMetricKeys
              : defaultGuardrailMetricKeys,
          }
        })
      })
      .catch((error) => {
        if (!active) return
        setApplicationDictionary(null)
        setDictionaryError(localizeSystemText(error.response?.data?.message || error.message || '指标字典加载失败'))
      })
      .finally(() => {
        if (active) setLoadingDictionary(false)
      })

    return () => {
      active = false
    }
  }, [form.appId])

  const selectedApplication = useMemo(
    () => applicationSpaces.find(space => space.appId === form.appId) || null,
    [applicationSpaces, form.appId]
  )
  const plans = normalizeVariantPlans(result, form.variantType, form)
  const metricDefinitions = applicationDictionary?.metricDefinitions || []
  const guardrailMetricDefinitions = metricDefinitions
    .filter(metric => metric.key !== form.primaryMetricKey)
  const selectedGuardrailMetrics = guardrailMetricDefinitions
    .filter(metric => (form.guardrailMetricKeys || []).includes(metric.key))
  const modelEvidence = normalizeVariantGenerationModelEvidence(result)
  const candidateCount = result ? (result.count || plans.length) : 0
  const referenceImagePreview = form.variantType === 'IMAGE'
    && form.referenceImageInput
    && (form.referenceImageInput.startsWith('http') || form.referenceImageInput.startsWith('data:image/'))
  const experimentWindowValid = Boolean(form.startTime && form.endTime
    && new Date(form.endTime).getTime() > new Date(form.startTime).getTime())
  const requiredFields = [
    form.appId,
    form.businessScenario,
    form.placement,
    form.goal,
    form.audience,
    form.hypothesis,
    form.primaryMetricKey,
    form.startTime,
    form.endTime,
  ]
  const completedRequiredCount = requiredFields.filter(value => String(value || '').trim()).length
  const formReady = completedRequiredCount === requiredFields.length
    && experimentWindowValid
    && !loadingDictionary
    && metricDefinitions.length > 0

  const sectionComplete = {
    definition: [form.appId, form.businessScenario, form.placement, form.goal, form.audience]
      .every(value => String(value || '').trim()),
    strategy: [form.baseline, form.sellingPointsText, form.constraintsText]
      .every(value => String(value || '').trim()),
    experiment: [form.hypothesis, form.primaryMetricKey, form.startTime, form.endTime, form.riskGuardrail]
      .every(value => String(value || '').trim()) && experimentWindowValid
  }

  const loadApplicationSpaces = async () => {
    try {
      setLoadingApplications(true)
      const response = await applicationAPI.list()
      const spaces = response.data || response || []
      setApplicationSpaces(spaces)
      setForm(current => ({ ...current, appId: current.appId || spaces[0]?.appId || '' }))
    } catch (error) {
      alert('加载应用失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setLoadingApplications(false)
    }
  }

  const updateForm = (field, value) => {
    setForm(current => ({ ...current, [field]: value }))
  }

  const updatePrimaryMetric = (metricKey) => {
    const metric = metricDefinitions.find(definition => definition.key === metricKey)
    setForm(current => ({
      ...current,
      primaryMetricKey: metricKey,
      primaryMetric: metric?.name || '',
      guardrailMetricKeys: current.guardrailMetricKeys.filter(key => key !== metricKey),
    }))
  }

  const toggleGuardrailMetric = (metricKey) => {
    setForm(current => ({
      ...current,
      guardrailMetricKeys: current.guardrailMetricKeys.includes(metricKey)
        ? current.guardrailMetricKeys.filter(key => key !== metricKey)
        : [...current.guardrailMetricKeys, metricKey],
    }))
  }

  const setExperimentDuration = (days) => {
    setForm(current => ({
      ...current,
      endTime: addDaysToDateTime(current.startTime, days),
    }))
  }

  const handleModeChange = (variantType) => {
    setForm(current => ({
      ...current,
      variantType,
      count: variantType === 'IMAGE' ? Math.min(current.count, 4) : current.count
    }))
    setResult(null)
    setConversation([])
    setRevisionHistory([])
    setRevisionNumber(1)
    setRefinementInstruction('')
    setRefinementOpen(false)
  }

  const buildCurrentCandidatePayload = () => buildVariantCandidatePayload({
    ...form,
    applicationName: selectedApplication?.displayName || form.appId,
    guardrailMetrics: selectedGuardrailMetrics.map(metric => `${metric.name}（${metric.key}）`).join('、'),
  })

  const handleGenerate = async () => {
    if (!formReady) {
      alert('请先完成任务定义和实验假设')
      return
    }

    try {
      setLoading(true)
      const payload = buildCurrentCandidatePayload()
      const response = await variantAPI.generateCandidates(payload)
      const nextResult = response.data || response
      setResult(nextResult)
      setConversation([])
      setRevisionHistory([])
      setRevisionNumber(1)
      setRefinementInstruction('')
    } catch (error) {
      alert('生成失败：' + localizeSystemText(error.response?.data?.message || error.message))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRefine = async () => {
    const instruction = refinementInstruction.trim()
    if (!result || plans.length === 0 || !instruction) {
      return
    }

    try {
      setRefining(true)
      const payload = buildVariantRefinementPayload({
        basePayload: buildCurrentCandidatePayload(),
        currentVariants: result.variants || plans,
        instruction,
        conversation,
      })
      const response = await variantAPI.refineCandidates(payload)
      const nextResult = response.data || response
      const nextVersion = revisionNumber + 1
      setRevisionHistory(current => [
        ...current.slice(-(MAX_REVISION_HISTORY_COUNT - 1)),
        { result, conversation, version: revisionNumber },
      ])
      setResult(nextResult)
      setRevisionNumber(nextVersion)
      setConversation(current => [
        ...current,
        createConversationMessage('USER', instruction),
        createConversationMessage(
          'ASSISTANT',
          `已按本轮要求更新为第 ${nextVersion} 版，${nextResult.count || plans.length} 个完整方案已同步替换。`
        ),
      ])
      setRefinementInstruction('')
    } catch (error) {
      alert('修改方案失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setRefining(false)
    }
  }

  const restorePreviousRevision = () => {
    const previousRevision = revisionHistory[revisionHistory.length - 1]
    if (!previousRevision || refining) {
      return
    }
    setResult(previousRevision.result)
    setRevisionNumber(previousRevision.version)
    setRevisionHistory(current => current.slice(0, -1))
    setConversation([
      ...previousRevision.conversation,
      createConversationMessage('ASSISTANT', `已恢复第 ${previousRevision.version} 版方案，可以继续提出修改。`),
    ])
  }

  const copyPlan = async (plan) => {
    await navigator.clipboard.writeText(formatPlanText(plan, form))
    setCopiedPlanId(plan.id)
    setTimeout(() => setCopiedPlanId(''), 1800)
  }

  const usePlansInExperiment = async () => {
    try {
      setPreparingExperiment(true)
      let dictionary = applicationDictionary
      if (!dictionary) {
        const response = await applicationAPI.getDictionary(form.appId)
        dictionary = response.data || response || {}
      }
      const generated = buildExperimentDraftFromVariantPlans({ form, plans, dictionary })
      navigate('/ai-design', {
        state: {
          experimentDraft: generated.draft,
          applicationDictionary: dictionary,
          importedVariantPlan: {
            name: `全部 ${plans.length} 个候选方案`,
            summary: generated.summary,
          },
        },
      })
    } catch (error) {
      alert('准备实验草稿失败：' + localizeSystemText(error.response?.data?.message || error.message))
    } finally {
      setPreparingExperiment(false)
    }
  }

  const handleReferenceImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件')
      event.target.value = ''
      return
    }
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      alert('参考图片不能超过 10 兆字节')
      event.target.value = ''
      return
    }
    try {
      updateForm('referenceImageInput', await readFileAsDataUrl(file))
    } catch (error) {
      alert('读取图片失败：' + localizeSystemText(error.message))
    } finally {
      event.target.value = ''
    }
  }

  return (
    <>
      <div className="space-y-4">
      <section className="glass-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="eyebrow mb-2">实验方案工作台</div>
          <h1 className="page-title">生成完整实验方案</h1>
          <p className="page-subtitle mt-2">从业务目标、实验假设到候选内容和风险护栏，一次形成可执行方案。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">必填信息</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{completedRequiredCount} / {requiredFields.length}</p>
          </div>
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading || !formReady}>
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Wand2 size={17} />}
            {loading ? '正在生成完整方案' : '生成完整方案'}
          </button>
        </div>
      </section>

      <div className="grid min-h-[500px] gap-4 xl:h-[calc(100vh-13.5rem)] xl:grid-cols-[minmax(420px,0.82fr)_minmax(0,1.18fr)]">
        <section className="glass-card flex min-h-0 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => handleModeChange(mode.value)}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    form.variantType === mode.value
                      ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <mode.icon size={18} />
                  <span className="min-w-0"><strong className="block text-sm">{mode.title}</strong><small className="mt-0.5 block truncate text-xs opacity-70">{mode.description}</small></span>
                </button>
              ))}
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="方案输入步骤">
              {INPUT_SECTIONS.map(section => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveInputSection(section.key)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
                    activeInputSection === section.key
                      ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {sectionComplete[section.key] ? <CheckCircle2 size={15} className="text-[#1e7e57]" /> : <section.icon size={15} />}
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {activeInputSection === 'definition' ? (
              <div className="space-y-4">
                <SectionHeading title="定义生成任务" description="明确方案服务于哪个应用、场景和用户决策环节。" />
                <label className="block text-sm text-slate-600">所属应用
                  <select className="input mt-2" value={form.appId} onChange={event => updateForm('appId', event.target.value)} disabled={loadingApplications}>
                    <option value="">{loadingApplications ? '正在加载应用' : '选择应用'}</option>
                    {applicationSpaces.map(space => <option key={space.appId} value={space.appId}>{space.displayName || space.appId}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="业务场景" value={form.businessScenario} onChange={value => updateForm('businessScenario', value)} placeholder="例如：二手手机售卖" />
                  <Field label="投放位置" value={form.placement} onChange={value => updateForm('placement', value)} placeholder="例如：商品详情页首屏" />
                </div>
                <TextAreaField label="业务目标" value={form.goal} onChange={value => updateForm('goal', value)} placeholder="说明希望改善的用户行为或业务结果" />
                <TextAreaField label="目标用户" value={form.audience} onChange={value => updateForm('audience', value)} placeholder="描述用户特征、需求和当前顾虑" rows={2} />
              </div>
            ) : null}

            {activeInputSection === 'strategy' ? (
              <div className="space-y-4">
                <SectionHeading title="补齐内容策略" description="给出当前基线、必须表达的卖点和不可突破的边界。" />
                <TextAreaField label="当前基线" value={form.baseline} onChange={value => updateForm('baseline', value)} placeholder="当前页面或内容是什么，存在什么问题" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextAreaField label="核心卖点" value={form.sellingPointsText} onChange={value => updateForm('sellingPointsText', value)} placeholder="每行一个卖点" />
                  <TextAreaField label="约束条件" value={form.constraintsText} onChange={value => updateForm('constraintsText', value)} placeholder="每行一个约束" />
                </div>
                <label className="block text-sm text-slate-600">表达风格
                  <select className="input mt-2" value={form.tone} onChange={event => updateForm('tone', event.target.value)}>
                    {TONE_OPTIONS.map(tone => <option key={tone} value={tone}>{tone}</option>)}
                  </select>
                </label>
                <TextAreaField label="补充资料" value={form.sourceContextText} onChange={value => updateForm('sourceContextText', value)} placeholder="字数、版位、品牌或其他执行要求" rows={2} />
                {form.variantType === 'IMAGE' ? (
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="btn-secondary cursor-pointer"><Upload size={16} />上传参考图<input type="file" accept="image/*" className="hidden" onChange={handleReferenceImageUpload} /></label>
                      {form.referenceImageInput ? <button type="button" className="btn-secondary" onClick={() => updateForm('referenceImageInput', '')}><X size={16} />移除</button> : <span className="text-xs text-slate-500">可选，最大 10 兆字节</span>}
                    </div>
                    {referenceImagePreview ? <img src={form.referenceImageInput} alt="参考图预览" className="mt-3 max-h-48 w-full rounded-lg border border-slate-200 object-contain" /> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeInputSection === 'experiment' ? (
              <div className="space-y-4">
                <SectionHeading title="定义实验标准" description="先选择实际观测的指标和周期，再让模型围绕明确目标生成方案。" />
                <TextAreaField label="实验假设" value={form.hypothesis} onChange={value => updateForm('hypothesis', value)} placeholder="如果改变什么，将影响哪类用户心理，进而改善什么指标" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-600">主指标
                    <select
                      className="input mt-2"
                      value={form.primaryMetricKey}
                      onChange={event => updatePrimaryMetric(event.target.value)}
                      disabled={loadingDictionary || metricDefinitions.length === 0}
                    >
                      <option value="">{loadingDictionary ? '正在加载指标' : '请选择主指标'}</option>
                      {metricDefinitions.map(metric => (
                        <option key={metric.key} value={metric.key}>{metric.name || metric.key}</option>
                      ))}
                    </select>
                  </label>
                  <Field label="预期提升" value={form.expectedLift} onChange={value => updateForm('expectedLift', value)} placeholder="例如：5% - 8%" />
                </div>
                {dictionaryError ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                    <span>{dictionaryError}</span>
                    <button type="button" className="font-semibold" onClick={() => navigate('/applications')}>前往应用管理</button>
                  </div>
                ) : null}
                {!loadingDictionary && !dictionaryError && form.appId && metricDefinitions.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                    <span>当前应用还没有指标，请先在应用管理中新增指标。</span>
                    <button type="button" className="font-semibold" onClick={() => navigate('/applications')}>新增指标</button>
                  </div>
                ) : null}
                {guardrailMetricDefinitions.length > 0 ? (
                  <fieldset>
                    <legend className="text-sm text-slate-600">护栏指标 <span className="text-xs text-slate-400">（可多选）</span></legend>
                    <div className="mt-2 grid max-h-32 gap-2 overflow-y-auto sm:grid-cols-2">
                      {guardrailMetricDefinitions.map(metric => {
                        const selected = (form.guardrailMetricKeys || []).includes(metric.key)
                        return (
                          <label
                            key={metric.key}
                            className={clsx(
                              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                              selected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
                            )}
                          >
                            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={selected} onChange={() => toggleGuardrailMetric(metric.key)} />
                            <span className="min-w-0"><strong className="block text-slate-800">{metric.name || metric.key}</strong>{metric.description ? <small className="mt-0.5 block truncate text-slate-500">{metric.description}</small> : null}</span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                ) : null}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm text-slate-600">实验周期</label>
                    <div className="flex gap-1">
                      {[7, 14, 28].map(days => (
                        <button key={days} type="button" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setExperimentDuration(days)}>{days} 天</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-slate-500">开始时间<input type="datetime-local" className="input mt-1" value={form.startTime} onChange={event => updateForm('startTime', event.target.value)} /></label>
                    <label className="text-xs text-slate-500">结束时间<input type="datetime-local" className="input mt-1" value={form.endTime} onChange={event => updateForm('endTime', event.target.value)} /></label>
                  </div>
                  {!experimentWindowValid ? <p className="mt-2 text-xs font-medium text-red-600">结束时间必须晚于开始时间。</p> : null}
                </div>
                <TextAreaField label="风险护栏" value={form.riskGuardrail} onChange={value => updateForm('riskGuardrail', value)} placeholder="说明不能恶化的指标和不可突破的边界" />
                <div>
                  <label className="mb-2 block text-sm text-slate-600">方案数量</label>
                  <div className="flex flex-wrap gap-2">
                    {(form.variantType === 'IMAGE' ? [2, 3, 4] : [3, 4, 6]).map(value => (
                      <button key={value} type="button" onClick={() => updateForm('count', value)} className={clsx('rounded-lg border px-4 py-2 text-sm font-semibold', form.count === value ? 'border-blue-200 bg-blue-50 text-[var(--brand)]' : 'border-slate-200 bg-white text-slate-600')}>{value} 个</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <span className="min-w-0 truncate text-xs text-slate-500">{selectedApplication?.displayName || '尚未选择应用'} · {form.primaryMetric || '尚未设置主指标'} · {formatExperimentWindow(form.startTime, form.endTime)}</span>
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading || !formReady}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}{loading ? '生成中' : '生成方案'}</button>
          </div>
        </section>

        <section className="glass-card flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div><p className="signal-label">方案交付</p><h2 className="section-title mt-1">{result ? '候选方案比较' : '完整方案标准'}</h2></div>
            <div className="flex flex-wrap items-center gap-2">
              {modelEvidence ? <ModelEvidenceBar evidence={modelEvidence} /> : null}
              {candidateCount ? <span className="badge border border-blue-200 bg-blue-50 text-[var(--brand)]">{candidateCount} 个方案</span> : null}
              {result && plans.length > 0 ? (
                <button type="button" className="btn-secondary py-2" onClick={() => setRefinementOpen(true)}>
                  <MessageSquare size={16} />
                  对话修改
                  <span className="text-xs text-slate-400">第 {revisionNumber} 版</span>
                </button>
              ) : null}
              {result && plans.length > 0 ? (
                <button type="button" className="btn-primary py-2" onClick={usePlansInExperiment} disabled={preparingExperiment}>
                  {preparingExperiment ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {preparingExperiment ? '正在填充实验' : `全部 ${plans.length} 个方案用于新实验`}
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {!result ? (
              <div className="flex h-full min-h-[420px] flex-col justify-center">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="text-center"><Sparkles size={30} className="mx-auto text-[var(--brand)]" /><h3 className="mt-3 text-lg font-bold text-slate-900">不再只生成一句文案</h3><p className="mt-2 text-sm text-slate-500">每个候选都将按以下标准形成完整实验方案。</p></div>
                  <div className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    {DELIVERY_STANDARDS.map(item => <div key={item.title} className="flex gap-3 border-t border-slate-200 pt-4"><item.icon size={18} className="mt-0.5 shrink-0 text-[var(--brand)]" /><div><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p></div></div>)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 grid gap-3 border-b border-slate-200 pb-4 text-sm sm:grid-cols-4">
                  <SummaryItem label="生成目标" value={form.goal} />
                  <SummaryItem label="目标用户" value={form.audience} />
                  <SummaryItem label="主指标" value={`${form.primaryMetric} · ${form.expectedLift || '待确定'}`} />
                  <SummaryItem label="实验周期" value={formatExperimentWindow(form.startTime, form.endTime)} />
                </div>
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <CalendarDays size={16} className="shrink-0" />
                  <span>导入后将创建 1 个对照组和 {plans.length} 个实验组，并自动带入所选指标与实验周期。</span>
                </div>
                <div className="grid gap-4 2xl:grid-cols-2">
                  {plans.map((plan, index) => (
                    <article key={plan.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="signal-label">方案 {index + 1}</p><h3 className="mt-1 truncate text-base font-bold text-slate-900">{plan.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{plan.strategy}</p></div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-bold text-[var(--brand)]">{index + 1}</span>
                      </div>

                      {form.variantType === 'IMAGE' && plan.imageUrl ? <img src={plan.imageUrl} alt={plan.name} className="mt-4 aspect-square w-full rounded-lg border border-slate-200 object-contain" /> : null}
                      <div className="mt-4 border-l-4 border-blue-300 bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-500">可投放内容</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-7 text-slate-900">{plan.content}</p></div>
                      <dl className="mt-4 space-y-3 text-sm">
                        <PlanDetail label="实验假设" value={plan.hypothesis} />
                        <div className="grid gap-3 sm:grid-cols-2"><PlanDetail label="主指标" value={plan.primaryMetric} /><PlanDetail label="预期提升" value={plan.expectedLift} /></div>
                        <PlanDetail label="实施建议" value={plan.implementation} />
                        <PlanDetail label="风险提醒" value={plan.risk} warning />
                      </dl>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                        <button type="button" className="btn-secondary px-3 py-2" onClick={() => copyPlan(plan)} title="复制完整方案">{copiedPlanId === plan.id ? <Check size={16} /> : <Copy size={16} />}</button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      </div>

      <RefinementDrawer
        open={refinementOpen}
        onClose={() => setRefinementOpen(false)}
        conversation={conversation}
        instruction={refinementInstruction}
        onInstructionChange={setRefinementInstruction}
        onSubmit={handleRefine}
        refining={refining}
        candidateCount={plans.length}
        version={revisionNumber}
        canRestore={revisionHistory.length > 0}
        onRestore={restorePreviousRevision}
        suggestions={form.variantType === 'IMAGE' ? IMAGE_REFINEMENT_SUGGESTIONS : TEXT_REFINEMENT_SUGGESTIONS}
      />
    </>
  )
}

function RefinementDrawer({
  open,
  onClose,
  conversation,
  instruction,
  onInstructionChange,
  onSubmit,
  refining,
  candidateCount,
  version,
  canRestore,
  onRestore,
  suggestions,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20" role="presentation" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="refinement-dialog-title"
        className="ml-auto flex h-full w-full max-w-[500px] flex-col border-l border-slate-200 bg-white shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-[var(--brand)]" />
              <h2 id="refinement-dialog-title" className="text-lg font-bold text-slate-900">对话修改方案</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">当前第 {version} 版 · {candidateCount} 个候选方案</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭对话修改">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
          {conversation.length === 0 ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
              当前完整方案已加入对话上下文。后续修改会保留未明确要求调整的内容。
            </div>
          ) : null}
          <div className="space-y-3">
            {conversation.map(message => (
              <div
                key={message.id}
                className={clsx('flex', message.role === 'USER' ? 'justify-end' : 'justify-start')}
              >
                <div className={clsx(
                  'max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6',
                  message.role === 'USER'
                    ? 'bg-[var(--brand)] text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                )}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form className="border-t border-slate-200 bg-white p-5" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[var(--brand)]"
                onClick={() => onInstructionChange(suggestion)}
                disabled={refining}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <textarea
            className="textarea min-h-24 resize-none"
            value={instruction}
            onChange={event => onInstructionChange(event.target.value)}
            placeholder="例如：保留第二个方案方向，其他方案减少促销感，并把质检保障放在标题前半段"
            maxLength={1000}
            disabled={refining}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" className="btn-secondary" onClick={onRestore} disabled={!canRestore || refining}>
              <RotateCcw size={16} />
              恢复上一版
            </button>
            <button type="submit" className="btn-primary" disabled={!instruction.trim() || refining}>
              {refining ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {refining ? '正在修改方案' : '发送修改要求'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function SectionHeading({ title, description }) {
  return <div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>
}

function Field({ label, value, onChange, placeholder }) {
  return <label className="block text-sm text-slate-600">{label}<input className="input mt-2" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return <label className="block text-sm text-slate-600">{label}<textarea className="textarea mt-2 resize-none" rows={rows} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function SummaryItem({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 line-clamp-2 font-semibold leading-6 text-slate-900">{value}</dd></div>
}

function PlanDetail({ label, value, warning = false }) {
  return <div><dt className={clsx('text-xs font-semibold', warning ? 'text-[#9a6026]' : 'text-slate-500')}>{label}</dt><dd className="mt-1 leading-6 text-slate-700">{value}</dd></div>
}

function ModelEvidenceBar({ evidence }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500" title={[evidence.primaryModel ? `主要模型：${evidence.primaryModel}` : '', evidence.fallbackModel ? `备用模型：${evidence.fallbackModel}` : ''].filter(Boolean).join('\n')}>
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-900"><Cpu size={14} /><span className="max-w-[11rem] truncate">{evidence.selectedModel || '模型未返回'}</span></span>
      {evidence.selectedApiMode ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{getApiModeLabel(evidence.selectedApiMode)}</span> : null}
      <span className={clsx('rounded-full border px-2 py-0.5 font-semibold', evidence.fallbackUsed ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>{localizeSystemText(evidence.statusLabel)}</span>
    </div>
  )
}

function formatPlanText(plan, form) {
  return [
    `方案名称：${plan.name}`,
    `策略方向：${plan.strategy}`,
    `候选内容：${plan.content}`,
    `目标用户：${plan.audience}`,
    `实验假设：${plan.hypothesis}`,
    `主指标：${plan.primaryMetric}`,
    `预期提升：${plan.expectedLift}`,
    `实施建议：${plan.implementation}`,
    `风险提醒：${plan.risk}`,
    `所属应用：${form.appId}`
  ].join('\n')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('文件解析失败'))
    reader.readAsDataURL(file)
  })
}
