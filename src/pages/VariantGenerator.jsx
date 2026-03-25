import { useState } from 'react'
import {
  Copy,
  Check,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Type,
  Wand2
} from 'lucide-react'
import clsx from 'clsx'
import { variantAPI } from '../services/api'
import { buildVariantCandidatePayload } from '../utils/aiDecisionTransformers'

const MODES = [
  {
    value: 'TEXT',
    title: '文本候选',
    description: '广告标题、按钮文案、卖点表达、咨询话术',
    icon: Type
  },
  {
    value: 'IMAGE',
    title: '图片候选',
    description: '主图方向、信息层级、构图风格、陈列方式',
    icon: ImageIcon
  }
]

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024

export default function VariantGenerator() {
  const [form, setForm] = useState({
    variantType: 'TEXT',
    goal: '',
    audience: '',
    count: 4,
    constraintsText: '不要夸张\n保持平台可信度',
    sourceContextText: '',
    referenceImageInput: ''
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)

  const handleGenerate = async () => {
    if (!form.goal.trim()) {
      alert('请先填写生成目标')
      return
    }

    try {
      setLoading(true)
      const payload = buildVariantCandidatePayload(form)
      const response = await variantAPI.generateCandidates(payload)
      setResult(response.data || response)
    } catch (error) {
      alert('生成失败: ' + (error.response?.data?.message || error.message))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text, index) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1800)
  }

  const handleReferenceImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件')
      event.target.value = ''
      return
    }
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      alert('参考图片不能超过 10MB')
      event.target.value = ''
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setForm(current => ({ ...current, referenceImageInput: dataUrl }))
    } catch (error) {
      alert('读取图片失败: ' + error.message)
    } finally {
      event.target.value = ''
    }
  }

  const variants = result?.variants || []
  const referenceImagePreview = form.variantType === 'IMAGE'
    && form.referenceImageInput
    && (form.referenceImageInput.startsWith('http') || form.referenceImageInput.startsWith('data:image/'))

  return (
    <div className="space-y-8">
      <section className="decision-hero">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">Variant Lab</div>
          <h1 className="page-title">统一候选生成</h1>
          <p className="page-subtitle mt-4">
            这里只服务于实验候选生产。你给出明确目标、受众和约束，系统按 `TEXT` 或 `IMAGE` 统一生成候选。
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="glass-card p-6">
          <div className="mb-6">
            <p className="signal-label">Generation Spec</p>
            <h2 className="section-title mt-2">候选生成指令</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => setForm(current => ({ ...current, variantType: mode.value }))}
                className={clsx(
                  'rounded-[1.5rem] border p-4 text-left transition-all',
                  form.variantType === mode.value
                    ? 'border-orange-300/20 bg-orange-300/[0.08]'
                    : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/[0.06] p-3">
                    <mode.icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{mode.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{mode.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">生成目标</label>
              <textarea
                className="textarea"
                value={form.goal}
                onChange={(event) => setForm(current => ({ ...current, goal: event.target.value }))}
                placeholder={form.variantType === 'TEXT'
                  ? '例如：为以旧换新页生成更强转化的标题和按钮文案'
                  : '例如：生成适合二手手机详情页的主图方向与视觉风格'}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">目标受众</label>
              <input
                className="input"
                value={form.audience}
                onChange={(event) => setForm(current => ({ ...current, audience: event.target.value }))}
                placeholder="例如：价格敏感但重视品质保障的用户"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">约束条件</label>
              <textarea
                className="textarea"
                value={form.constraintsText}
                onChange={(event) => setForm(current => ({ ...current, constraintsText: event.target.value }))}
                placeholder="每行一个约束"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">已有上下文</label>
              <textarea
                className="textarea"
                value={form.sourceContextText}
                onChange={(event) => setForm(current => ({ ...current, sourceContextText: event.target.value }))}
                placeholder="例如：现有文案偏保守，不能突出回收价透明和质检能力"
              />
            </div>
            {form.variantType === 'IMAGE' ? (
              <div className="space-y-3">
                <label className="mb-2 block text-sm text-slate-300">参考图片</label>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-7 text-slate-500">
                    留空表示纯文本生成图片。需要按已有图片继续生成时，只支持从本地上传真实图片文件。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="btn-secondary cursor-pointer px-4 py-2">
                    <Upload size={16} />
                    上传本地图片
                    <input type="file" accept="image/*" className="hidden" onChange={handleReferenceImageUpload} />
                  </label>
                  {form.referenceImageInput ? (
                    <button
                      type="button"
                      onClick={() => setForm(current => ({ ...current, referenceImageInput: '' }))}
                      className="btn-secondary px-4 py-2"
                    >
                      <X size={16} />
                      清空参考图
                    </button>
                  ) : null}
                </div>
                {referenceImagePreview ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-3 text-sm font-medium text-slate-600">当前参考图</p>
                    <div className="flex min-h-[12rem] items-center justify-center rounded-xl bg-white p-3">
                      <img
                        src={form.referenceImageInput}
                        alt="reference-preview"
                        className="max-h-[18rem] w-full rounded-lg object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm text-slate-300">生成数量</label>
              <div className="flex flex-wrap gap-3">
                {[3, 4, 6, 8].map(value => (
                  <button
                    key={value}
                    onClick={() => setForm(current => ({ ...current, count: value }))}
                    className={clsx(
                      'rounded-2xl border px-4 py-2 text-sm font-semibold transition-all',
                      form.count === value
                        ? 'border-orange-300/20 bg-orange-300/[0.08] text-orange-50'
                        : 'border-white/8 bg-white/[0.03] text-slate-300'
                    )}
                  >
                    {value} 个
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              开始生成候选
            </button>
          </div>
        </section>

        <section className="glass-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="signal-label">Candidate Wall</p>
              <h2 className="section-title mt-2">候选输出</h2>
            </div>
            {result?.count ? (
              <span className="badge border border-blue-200 bg-blue-50 text-[var(--brand)]">{result.count} 个候选</span>
            ) : null}
          </div>

          {!result ? (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <Sparkles size={32} className="mx-auto text-[var(--brand)]/70" />
              <p className="mt-4 text-lg font-semibold text-slate-900">还没有生成结果</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">左侧填写指令并生成后，这里会展示可以直接进入实验配置的候选方案。</p>
            </div>
          ) : form.variantType === 'TEXT' ? (
            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div key={variant + index} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="signal-label">Candidate {index + 1}</p>
                      <p className="mt-3 text-base leading-8 text-slate-700">{variant}</p>
                    </div>
                    <button onClick={() => copyToClipboard(variant, index)} className="btn-secondary px-3 py-2">
                      {copiedIndex === index ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {variants.map((variant, index) => (
                <div key={variant + index} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">候选 {index + 1}</p>
                    <span className="text-xs text-slate-500">IMAGE</span>
                  </div>
                  {String(variant).startsWith('http') ? (
                    <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <img
                        src={variant}
                        alt={`candidate-${index + 1}`}
                        loading="lazy"
                        className="max-h-[32rem] w-full rounded-xl object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm leading-7 text-slate-500">
                      {variant}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('文件解析失败'))
    reader.readAsDataURL(file)
  })
}
