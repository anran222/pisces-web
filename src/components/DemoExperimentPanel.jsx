import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Sparkles
} from 'lucide-react'
import { experimentAPI } from '../services/api'
import { buildDemoExperimentCards } from '../utils/aiDecisionTransformers'
import {
  getDecisionLabel,
  getGuardrailStatusLabel,
  getMetricKeyLabel,
  localizeSystemText,
} from '../utils/uiLabels'

const toneConfig = {
  success: {
    panelClassName: 'border-[#cde5d7] bg-[#f6fbf8]',
    iconClassName: 'bg-[#e8f6ef] text-[#1e7e57]',
    badgeClassName: 'border-[#cde5d7] bg-white text-[#1e7e57]'
  },
  warning: {
    panelClassName: 'border-[#ecd8bf] bg-[#fff8ef]',
    iconClassName: 'bg-[#fff1df] text-[#9a6026]',
    badgeClassName: 'border-[#ecd8bf] bg-white text-[#9a6026]'
  }
}

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`

export default function DemoExperimentPanel({
  title = '快速生成示例实验',
  description = '一键生成两组示例实验，方便直接查看详情和分析结果。',
  buttonLabel = '生成示例实验',
  compact = false,
  embedded = false,
  onGenerated
}) {
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState([])
  const PanelShell = embedded ? 'div' : 'section'

  const handleGenerate = async () => {
    try {
      setLoading(true)
      const result = await experimentAPI.generateDemoExperiment()
      const response = result.data || result
      setCards(buildDemoExperimentCards(response))
      if (typeof onGenerated === 'function') {
        onGenerated(response)
      }
    } catch (error) {
      alert('生成示例实验失败：' + localizeSystemText(error.response?.data?.message || error.message))
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PanelShell className={embedded ? '' : 'glass-card p-5'}>
      <div className={`flex gap-4 ${compact ? 'flex-col lg:flex-row lg:items-center lg:justify-between' : 'flex-col xl:flex-row xl:items-start xl:justify-between'}`}>
        <div className="max-w-2xl">
          <div className="eyebrow mb-3">示例实验</div>
          <h2 className="section-title text-[1.45rem]">{title}</h2>
          <p className="mt-2 page-subtitle">{description}</p>
        </div>
        <button onClick={handleGenerate} disabled={loading} className="btn-primary shrink-0">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {buttonLabel}
        </button>
      </div>

      {cards.length > 0 && (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {cards.map(card => {
            const tone = toneConfig[card.tone] || toneConfig.warning
            return (
              <div key={card.key} className={`rounded-[1.3rem] border p-5 ${tone.panelClassName}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.iconClassName}`}>
                      {card.tone === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                      <h3 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-900">{card.experimentName}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{localizeSystemText(card.summary)}</p>
                    </div>
                  </div>
                  <span className={`badge border ${tone.badgeClassName}`}>
                    <FlaskConical size={14} />
                    {card.experimentId}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                    <p className="text-sm text-slate-500">基准组转化率</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatPercent(card.baselineConversionRate)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                    <p className="text-sm text-slate-500">目标组转化率</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatPercent(card.winningConversionRate)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    是否可推进 {card.canGraduate ? '是' : '否'}
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    是否可停止 {card.canStop ? '是' : '否'}
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    智能决策 {getDecisionLabel(card.aiDecision)}
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    护栏状态 {getGuardrailStatusLabel(card.aiGuardrailStatus)}
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    主要指标 {getMetricKeyLabel(card.primaryMetricKey)}
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    {card.groupCount} 个实验组
                  </span>
                  <span className="badge border border-slate-200 bg-white text-slate-700">
                    {card.schemaFieldCount} 个配置字段
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to={`/experiments/${card.experimentId}`} className="btn-secondary">
                    查看详情
                  </Link>
                  <Link to={`/experiments/${card.experimentId}/decision`} className="btn-secondary">
                    查看分析
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PanelShell>
  )
}
