import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  Radar,
  ShieldAlert,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { analysisAPI, experimentAPI } from '../services/api'
import { buildDashboardDecisionItems, buildDashboardMetrics } from '../utils/experimentMetrics'
import {
  getDecisionLabel,
  getExperimentStatusLabel,
  getGuardrailStatusLabel,
  localizeSystemText,
} from '../utils/uiLabels'

const getDecisionTone = (decision) => {
  if (decision === 'GRADUATE') {
    return 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]'
  }
  if (decision === 'ROLLBACK') {
    return 'border-[#e7c8c4] bg-[#fff7f5] text-[#b44f42]'
  }
  return 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]'
}

const getGuardrailTone = (status) => {
  if (status === 'PASS') {
    return 'bg-emerald-400/12 text-emerald-200 border-emerald-400/18'
  }
  if (status === 'BLOCKED') {
    return 'bg-rose-400/12 text-rose-200 border-rose-400/18'
  }
  return 'border-blue-200 bg-blue-50 text-[var(--brand)]'
}

const StatCard = ({ title, value, description, icon: Icon, toneClass }) => (
  <div className="signal-card">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="signal-label">{title}</p>
        <p className={`signal-value ${toneClass}`}>{value}</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
        <Icon size={22} />
      </div>
    </div>
  </div>
)

export default function Dashboard() {
  const [experiments, setExperiments] = useState([])
  const [decisionRecords, setDecisionRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeInsightPanel, setActiveInsightPanel] = useState('facts')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const experimentResponse = await experimentAPI.list()
      const experimentList = experimentResponse.data || experimentResponse || []
      setExperiments(experimentList)
      setDecisionRecords({})
      setLoading(false)

      const statisticsResults = await Promise.allSettled(
        experimentList.slice(0, 8).map(async experiment => {
          const statisticsRes = await analysisAPI.getStatistics(experiment.id)

          return [
            experiment.id,
            statisticsRes.data || statisticsRes
          ]
        })
      )

      const statisticsEntries = statisticsResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
      setDecisionRecords(Object.fromEntries(statisticsEntries))
    } catch (error) {
      console.error('Failed to load workspace data:', error)
      setExperiments([])
      setDecisionRecords({})
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    return buildDashboardMetrics(experiments, decisionRecords)
  }, [decisionRecords, experiments])

  const decisionItems = useMemo(
    () => buildDashboardDecisionItems(experiments, decisionRecords),
    [decisionRecords, experiments]
  )

  const blockedCount = decisionItems.filter(item => item.guardrailStatus === 'BLOCKED').length
  const analysisReadyCount = decisionItems.filter(item => item.analysisReady).length

  const topBlocked = decisionItems.filter(item => item.guardrailStatus === 'BLOCKED').slice(0, 3)
  const topReady = decisionItems.filter(item => item.analysisReady).slice(0, 3)
  const insightTabs = [
    { key: 'facts', label: '总体', count: metrics.total },
    { key: 'blocked', label: '阻塞', count: topBlocked.length },
    { key: 'ready', label: '就绪', count: topReady.length }
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[1.4rem] border border-slate-200 bg-[rgba(255,255,255,0.82)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3">实验工作台</div>
          <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-slate-900">先处理值得关注的实验</h1>
          <p className="mt-2 page-subtitle">把需要继续观察、需要处理风险、可以推进审核的实验放在同一个视图里。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:w-[620px]">
          <Link to="/ai-design" className="btn-primary">
            <Radar size={18} />
            新建实验
          </Link>
          <button onClick={loadData} className="btn-secondary">
            <TrendingUp size={18} />
            刷新列表
          </button>
          <Link to="/variants-lab" className="btn-secondary">
            <Sparkles size={18} />
            生成候选方案
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <StatCard
          title="运行实验"
          value={metrics.running}
          description="当前仍在持续收集数据、等待更新结果的实验数。"
          icon={FlaskConical}
          toneClass="text-slate-900"
        />
        <StatCard
          title="阻塞实验"
          value={blockedCount}
          description="存在护栏阻塞、样本问题或数据质量问题的实验。"
          icon={ShieldAlert}
          toneClass="text-[#b44f42]"
        />
        <StatCard
          title="数据就绪"
          value={analysisReadyCount}
          description="数据质量检查已通过，可以进入决策分析的实验。"
          icon={CheckCircle2}
          toneClass="text-[#1e7e57]"
        />
        <StatCard
          title="待补充数据"
          value={Math.max(decisionItems.length - analysisReadyCount, 0)}
          description="尚需补充分流、曝光或样本数据的实验。"
          icon={BrainCircuit}
          toneClass="text-[var(--brand)]"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="signal-label">优先队列</p>
              <h2 className="section-title mt-2">优先处理实验</h2>
            </div>
            <Link to="/experiments" className="btn-secondary">
              查看全部实验
              <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(item => (
                <div key={item} className="h-24 rounded-[1.2rem] bg-slate-200/60 animate-shimmer" />
              ))}
            </div>
          ) : decisionItems.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">还没有实验数据</p>
              <p className="mt-2 text-sm text-slate-500">可以直接新建实验或生成示例实验，再进入实验列表执行和查看结果。</p>
            </div>
          ) : (
            <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {decisionItems.slice(0, 6).map(item => (
                <Link
                  key={item.id}
                  to={`/experiments/${item.id}/decision`}
                  className="block rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5 transition-all duration-200 hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-900">{item.name}</h3>
                        <span className={`badge border ${getGuardrailTone(item.guardrailStatus)}`}>
                          {getGuardrailStatusLabel(item.guardrailStatus)}
                        </span>
                        <span className={`badge border ${getDecisionTone(item.decision)}`}>
                          {getExperimentStatusLabel(item.status)} · {getDecisionLabel(item.decision)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{localizeSystemText(item.decisionSummary)}</p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>访客 {item.totalVisitors.toLocaleString()}</span>
                        <span>最佳组 {localizeSystemText(item.bestGroup)}</span>
                        <span>风险 {item.riskCount}</span>
                        <span>{item.analysisReady ? '数据已就绪' : '数据待补充'}</span>
                      </div>
                    </div>
                    <div className="grid min-w-[220px] gap-2">
                      {(item.blockingIssues.length > 0 ? item.blockingIssues : ['暂无阻塞说明']).slice(0, 2).map(issue => (
                        <div key={issue} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {localizeSystemText(issue)}
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="signal-label">总体事实</p>
              <h2 className="section-title mt-2">实验总体情况</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {insightTabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                    activeInsightPanel === tab.key
                      ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setActiveInsightPanel(tab.key)}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {activeInsightPanel === 'facts' ? (
            <div className="mt-5 fact-grid md:grid-cols-2">
              <div className="fact-tile">
                <p className="text-sm text-slate-500">总实验数</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{metrics.total}</p>
              </div>
              <div className="fact-tile">
                <p className="text-sm text-slate-500">累计访客</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--brand)]">{metrics.visitors.toLocaleString()}</p>
              </div>
              <div className="fact-tile">
                <p className="text-sm text-slate-500">累计转化</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#9a6026]">{metrics.conversions.toLocaleString()}</p>
              </div>
              <div className="fact-tile">
                <p className="text-sm text-slate-500">运行占比</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">
                  {metrics.total > 0 ? `${Math.round(metrics.running / metrics.total * 100)}%` : '0%'}
                </p>
              </div>
            </div>
          ) : null}

          {activeInsightPanel === 'blocked' ? (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3">
                <AlertTriangle className="text-[#b44f42]" size={18} />
                <h3 className="section-title">需要优先处理</h3>
              </div>
              <div className="space-y-3">
                {topBlocked.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-500">当前没有需要优先处理的实验。</p>
                ) : (
                  topBlocked.map(item => (
                    <Link key={item.id} to={`/experiments/${item.id}/decision`} className="block rounded-2xl border border-[#e7c8c4] bg-[#fff7f5] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-sm text-[#9a5a52]">{localizeSystemText(item.decisionSummary)}</p>
                        </div>
                        <ShieldAlert size={18} className="text-[#b44f42]" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeInsightPanel === 'ready' ? (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3">
                <TrendingUp className="text-[#1e7e57]" size={18} />
                <h3 className="section-title">可以进入决策分析</h3>
              </div>
              <div className="space-y-3">
                {topReady.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-500">当前还没有数据质量检查通过的实验。</p>
                ) : (
                  topReady.map(item => (
                    <Link key={item.id} to={`/experiments/${item.id}/decision`} className="block rounded-2xl border border-[#cde5d7] bg-[#f6fbf8] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-sm text-[#3f6f5a]">数据质量检查已通过，可查看统计结果并生成决策建议。</p>
                        </div>
                        <CheckCircle2 size={18} className="text-[#1e7e57]" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
