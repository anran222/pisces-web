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
import { buildDashboardMetrics } from '../utils/experimentMetrics'
import { normalizeConfidence } from '../utils/aiDecisionTransformers'

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

const buildDecisionItems = (experiments, decisionRecords) => experiments
  .map(experiment => {
    const decision = decisionRecords[experiment.id] || {}
    const diagnosis = decision.diagnosis || {}
    const graduation = decision.graduation || {}
    const statistics = decision.statistics || {}
    const summary = statistics.summary || {}
    const riskCount = (graduation.riskFlags || diagnosis.riskFlags || []).length
    const blockingIssues = statistics.dataQualityCheck?.blockingIssues || []

    return {
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      decision: graduation.decision || 'CONTINUE',
      decisionSummary: graduation.summary || diagnosis.summary || '等待分析结果',
      confidence: normalizeConfidence(graduation.confidence ?? diagnosis.confidence),
      guardrailStatus: graduation.guardrailStatus || diagnosis.guardrailStatus || 'UNKNOWN',
      totalVisitors: summary.totalVisitors || 0,
      bestGroup: summary.bestPerformingGroup || '-',
      riskCount,
      blockingIssues
    }
  })
  .sort((left, right) => {
    if (left.guardrailStatus === 'BLOCKED' && right.guardrailStatus !== 'BLOCKED') {
      return -1
    }
    if (left.guardrailStatus !== 'BLOCKED' && right.guardrailStatus === 'BLOCKED') {
      return 1
    }
    return right.confidence - left.confidence
  })

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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const experimentResponse = await experimentAPI.list()
      const experimentList = experimentResponse.data || experimentResponse || []
      setExperiments(experimentList)

      const decisionEntries = await Promise.all(
        experimentList.slice(0, 8).map(async experiment => {
          const [statisticsRes, diagnosisRes, graduationRes] = await Promise.allSettled([
            analysisAPI.getStatistics(experiment.id),
            analysisAPI.getAIDiagnosis(experiment.id),
            analysisAPI.getAIGraduationDecision(experiment.id)
          ])

          return [
            experiment.id,
            {
              statistics: statisticsRes.status === 'fulfilled' ? (statisticsRes.value.data || statisticsRes.value) : null,
              diagnosis: diagnosisRes.status === 'fulfilled' ? (diagnosisRes.value.data || diagnosisRes.value) : null,
              graduation: graduationRes.status === 'fulfilled' ? (graduationRes.value.data || graduationRes.value) : null
            }
          ]
        })
      )

      setDecisionRecords(Object.fromEntries(decisionEntries))
    } catch (error) {
      console.error('Failed to load workspace data:', error)
      setExperiments([])
      setDecisionRecords({})
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const statisticsByExperiment = Object.fromEntries(
      Object.entries(decisionRecords).map(([experimentId, record]) => [experimentId, record.statistics])
    )
    return buildDashboardMetrics(experiments, statisticsByExperiment)
  }, [decisionRecords, experiments])

  const decisionItems = useMemo(
    () => buildDecisionItems(experiments, decisionRecords),
    [decisionRecords, experiments]
  )

  const blockedCount = decisionItems.filter(item => item.guardrailStatus === 'BLOCKED').length
  const graduateReadyCount = decisionItems.filter(item => item.decision === 'GRADUATE').length
  const avgConfidence = decisionItems.length > 0
    ? Math.round(decisionItems.reduce((sum, item) => sum + item.confidence, 0) / decisionItems.length * 100)
    : 0

  const topBlocked = decisionItems.filter(item => item.guardrailStatus === 'BLOCKED').slice(0, 3)
  const topGraduate = decisionItems.filter(item => item.decision === 'GRADUATE').slice(0, 3)

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[1.4rem] border border-slate-200 bg-[rgba(255,255,255,0.82)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3">Workspace</div>
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
          title="可毕业实验"
          value={graduateReadyCount}
          description="当前倾向于毕业并继续推进的实验。"
          icon={CheckCircle2}
          toneClass="text-[#1e7e57]"
        />
        <StatCard
          title="平均信心"
          value={`${avgConfidence}%`}
          description="当前实验池总体结论的平均置信度。"
          icon={BrainCircuit}
          toneClass="text-[var(--brand)]"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="signal-label">Priority Queue</p>
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
            <div className="space-y-4">
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
                        <span className={`badge border ${getGuardrailTone(item.guardrailStatus)}`}>{item.guardrailStatus}</span>
                        <span className={`badge border ${getDecisionTone(item.decision)}`}>{item.decision}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{item.decisionSummary}</p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>访客 {item.totalVisitors.toLocaleString()}</span>
                        <span>最佳组 {item.bestGroup}</span>
                        <span>风险 {item.riskCount}</span>
                        <span>置信度 {(item.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="grid min-w-[220px] gap-2">
                      {(item.blockingIssues.length > 0 ? item.blockingIssues : ['暂无阻塞说明']).slice(0, 2).map(issue => (
                        <div key={issue} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <p className="signal-label">System Facts</p>
              <h2 className="section-title mt-2">实验总体情况</h2>
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
          </div>

          <div className="glass-card p-6">
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
                        <p className="mt-1 text-sm text-[#9a5a52]">{item.decisionSummary}</p>
                      </div>
                      <ShieldAlert size={18} className="text-[#b44f42]" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp className="text-[#1e7e57]" size={18} />
              <h3 className="section-title">可以继续推进</h3>
            </div>
            <div className="space-y-3">
              {topGraduate.length === 0 ? (
                <p className="text-sm leading-7 text-slate-500">当前没有特别适合继续推进审核的实验。</p>
              ) : (
                topGraduate.map(item => (
                  <Link key={item.id} to={`/experiments/${item.id}/decision`} className="block rounded-2xl border border-[#cde5d7] bg-[#f6fbf8] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-sm text-[#3f6f5a]">置信度 {(item.confidence * 100).toFixed(0)}%，可继续推进审核。</p>
                      </div>
                      <CheckCircle2 size={18} className="text-[#1e7e57]" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
