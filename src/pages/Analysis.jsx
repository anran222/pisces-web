import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Target,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Brain,
  Rocket,
  Clock,
  Sparkles,
  Zap
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts'
import { experimentAPI, analysisAPI } from '../services/api'

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f97316']

export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [bayesian, setBayesian] = useState(null)
  const [significance, setSignificance] = useState(null)
  const [report, setReport] = useState(null)
  const [aiInsights, setAiInsights] = useState(null)
  const [graduation, setGraduation] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const goToAIInsights = () => {
    setActiveTab('ai-insights')
    if (!aiInsights) {
      loadAIInsights()
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 使用 Promise.allSettled 避免单个请求失败导致全部失败
      const [expRes, statsRes, bayesRes, timelineRes] = await Promise.allSettled([
        experimentAPI.get(id),
        analysisAPI.getStatistics(id),
        analysisAPI.getBayesianAnalysis(id),
        analysisAPI.getTimeline(id, 'CONVERSION_RATE', 'DAY')
      ])
      
      // 处理实验基础信息
      if (expRes.status === 'fulfilled') {
        const expData = expRes.value.data || expRes.value
        setExperiment(expData)
        
        // 如果有足够的组，获取显著性检验
        if (expData?.groups && Object.keys(expData.groups).length >= 2) {
          const groups = Object.keys(expData.groups)
          try {
            const sigRes = await analysisAPI.significanceTest(id, groups[1], groups[0])
            setSignificance(sigRes.data || sigRes)
          } catch (e) {
            console.log('Significance test not available')
          }
        }
      } else {
        console.error('Failed to load experiment:', expRes.reason)
        // 设置默认实验数据
        setExperiment({ id, name: id, groups: {} })
      }
      
      // 处理统计数据
      if (statsRes.status === 'fulfilled') {
        setStatistics(statsRes.value?.data || statsRes.value)
      } else {
        console.log('Statistics not available:', statsRes.reason?.message)
        setStatistics(null)
      }
      
      // 处理贝叶斯分析
      if (bayesRes.status === 'fulfilled') {
        setBayesian(bayesRes.value?.data || bayesRes.value)
      } else {
        console.log('Bayesian analysis not available:', bayesRes.reason?.message)
        setBayesian(null)
      }
      
      // 处理时间线数据
      if (timelineRes.status === 'fulfilled') {
        setTimeline(timelineRes.value?.data || timelineRes.value)
      } else {
        console.log('Timeline not available:', timelineRes.reason?.message)
        setTimeline(null)
      }
      
    } catch (error) {
      console.error('Failed to load analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAIInsights = async () => {
    try {
      setAiLoading(true)
      
      // 使用 Promise.allSettled 避免单个请求失败导致全部失败
      const [insightsRes, gradRes, predRes] = await Promise.allSettled([
        analysisAPI.getAIInsights(id),
        analysisAPI.autoGraduateDecision(id),
        analysisAPI.predictCompletion(id)
      ])
      
      // 处理每个请求的结果
      if (insightsRes.status === 'fulfilled') {
        setAiInsights(insightsRes.value.data || insightsRes.value)
      } else {
        console.error('AI insights failed:', insightsRes.reason)
        // 设置默认数据避免页面空白
        setAiInsights({
          success: false,
          aiAnalysis: '## 暂无分析数据\n\n实验数据尚未收集或服务暂时不可用，请稍后重试。\n\n### 可能的原因\n- 实验刚创建，还没有收集到数据\n- 后端服务未启动\n- 网络连接问题',
          keyInsights: { readyForDecision: false },
          dataSummary: { healthScore: 0, healthStatus: '无数据' },
          recommendations: []
        })
      }
      
      if (gradRes.status === 'fulfilled') {
        setGraduation(gradRes.value.data || gradRes.value)
      } else {
        console.error('Graduation decision failed:', gradRes.reason)
        setGraduation({ canGraduate: false, reasons: ['无法获取决策数据'] })
      }
      
      if (predRes.status === 'fulfilled') {
        setPrediction(predRes.value.data || predRes.value)
      } else {
        console.error('Prediction failed:', predRes.reason)
        setPrediction({ status: 'UNKNOWN', message: '无法获取预测数据' })
      }
      
    } catch (error) {
      console.error('Failed to load AI insights:', error)
      // 设置默认数据避免页面空白
      setAiInsights({
        success: false,
        aiAnalysis: '## 加载失败\n\n无法加载AI分析数据，请检查后端服务是否正常运行。',
        keyInsights: {},
        dataSummary: {},
        recommendations: []
      })
    } finally {
      setAiLoading(false)
    }
  }

  const exportReport = async () => {
    try {
      const res = await analysisAPI.exportReport(id)
      setReport(res.data)
      // 下载JSON报告
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `experiment-report-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('导出失败: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-slate-700/30 rounded-lg animate-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-700/30 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    )
  }

  // 准备图表数据
  const conversionData = statistics?.groupStatistics ? 
    Object.entries(statistics.groupStatistics).map(([groupId, stats]) => ({
      name: stats.groupName || groupId,
      转化率: ((stats.conversionRate || 0) * 100).toFixed(2),
      访客数: stats.userCount || 0,
      转化数: stats.conversionCount || 0
    })) : []

  const pieData = statistics?.groupStatistics ?
    Object.entries(statistics.groupStatistics).map(([groupId, stats]) => ({
      name: stats.groupName || groupId,
      value: stats.userCount || 0
    })) : []

  // 准备胜率图表数据
  const winRateData = bayesian?.winRates ?
    Object.entries(bayesian.winRates).map(([groupId, rate]) => ({
      name: groupId,
      胜率: (rate * 100).toFixed(1)
    })) : []

  // 准备时间线图表数据
  const timelineData = timeline?.dataPoints ?
    timeline.dataPoints.map((point, idx) => ({
      time: `Day ${idx + 1}`,
      ...Object.fromEntries(
        Object.entries(point.values || {}).map(([k, v]) => [k, (v * 100).toFixed(2)])
      )
    })) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/experiments/${id}`)}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold gradient-text">数据分析</h1>
            <p className="text-slate-400 text-sm mt-1">{experiment?.name || id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> 刷新
          </button>
          <button onClick={exportReport} className="btn-primary flex items-center gap-2">
            <Download size={16} /> 导出报告
          </button>
          <button onClick={goToAIInsights} className="btn-secondary flex items-center gap-2">
            <Brain size={16} /> AI智能解读
          </button>
          <button onClick={goToAIInsights} className="btn-secondary flex items-center gap-2">
            <Rocket size={16} /> 自动毕业决策
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700/50 pb-2 overflow-x-auto">
        {[
          { key: 'overview', label: '总览', icon: BarChart3 },
          { key: 'ai-insights', label: 'AI智能分析', icon: Brain },
          { key: 'bayesian', label: '贝叶斯分析', icon: TrendingUp },
          { key: 'significance', label: '显著性检验', icon: Target },
          { key: 'timeline', label: '时间趋势', icon: Clock }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'ai-insights' && !aiInsights) {
                loadAIInsights()
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-pisces-600/30 text-pisces-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {statistics?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-4">
                <p className="text-slate-400 text-sm">总访客数</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.summary.totalVisitors?.toLocaleString() || 0}
                </p>
              </div>
              <div className="glass-card p-4">
                <p className="text-slate-400 text-sm">总事件数</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.summary.totalEvents?.toLocaleString() || 0}
                </p>
              </div>
              <div className="glass-card p-4">
                <p className="text-slate-400 text-sm">总体转化率</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {((statistics.summary.overallConversionRate || 0) * 100).toFixed(2)}%
                </p>
              </div>
              <div className="glass-card p-4">
                <p className="text-slate-400 text-sm">最佳表现组</p>
                <p className="text-2xl font-bold text-accent-purple">
                  {statistics.summary.bestPerformingGroup || '-'}
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Rate Chart */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-pisces-400" />
                各组转化率对比
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="转化率" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Traffic Distribution */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target size={20} className="text-accent-purple" />
                流量分布
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Group Details Table */}
          {statistics?.groupStatistics && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">详细数据</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left p-3 text-slate-400 font-medium">实验组</th>
                      <th className="text-right p-3 text-slate-400 font-medium">访客数</th>
                      <th className="text-right p-3 text-slate-400 font-medium">浏览数</th>
                      <th className="text-right p-3 text-slate-400 font-medium">点击数</th>
                      <th className="text-right p-3 text-slate-400 font-medium">转化数</th>
                      <th className="text-right p-3 text-slate-400 font-medium">点击率</th>
                      <th className="text-right p-3 text-slate-400 font-medium">转化率</th>
                      <th className="text-right p-3 text-slate-400 font-medium">提升率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(statistics.groupStatistics).map(([groupId, stats]) => (
                      <tr key={groupId} className="border-b border-slate-700/30">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{stats.groupName || groupId}</span>
                            {stats.isBaseline && (
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-600/50 text-slate-300">基准</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right p-3 text-white">{stats.userCount?.toLocaleString() || 0}</td>
                        <td className="text-right p-3 text-white">{stats.viewCount?.toLocaleString() || 0}</td>
                        <td className="text-right p-3 text-white">{stats.clickCount?.toLocaleString() || 0}</td>
                        <td className="text-right p-3 text-white">{stats.conversionCount?.toLocaleString() || 0}</td>
                        <td className="text-right p-3 text-white">
                          {((stats.clickRate || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="text-right p-3 text-emerald-400 font-medium">
                          {((stats.conversionRate || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="text-right p-3">
                          {stats.liftRate !== undefined && stats.liftRate !== null ? (
                            <span className={stats.liftRate >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {stats.liftRate >= 0 ? '+' : ''}{(stats.liftRate * 100).toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai-insights' && (
        <div className="space-y-6">
          {aiLoading ? (
            <div className="glass-card p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-pisces-400 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-400">AI正在分析实验数据...</p>
            </div>
          ) : (
            <>
              {/* Data Summary Cards */}
              {aiInsights?.dataSummary && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="glass-card p-4">
                    <p className="text-slate-400 text-sm">总访客</p>
                    <p className="text-2xl font-bold text-white">
                      {aiInsights.dataSummary.totalVisitors?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-slate-400 text-sm">最高胜率</p>
                    <p className={`text-2xl font-bold ${(aiInsights.dataSummary.maxWinRate || 0) >= 0.95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {((aiInsights.dataSummary.maxWinRate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-slate-400 text-sm">领先变体</p>
                    <p className="text-2xl font-bold text-accent-purple">
                      {aiInsights.dataSummary.winningVariant || '-'}
                    </p>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-slate-400 text-sm">统计显著</p>
                    <p className={`text-2xl font-bold ${aiInsights.dataSummary.isStatisticallySignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {aiInsights.dataSummary.isStatisticallySignificant ? '是' : '否'}
                    </p>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-slate-400 text-sm">数据健康度</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-2xl font-bold ${
                        aiInsights.dataSummary.healthScore >= 80 ? 'text-emerald-400' :
                        aiInsights.dataSummary.healthScore >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {aiInsights.dataSummary.healthScore || 0}分
                      </p>
                      <span className="text-sm text-slate-400">
                        ({aiInsights.dataSummary.healthStatus})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Insights Cards */}
              {aiInsights?.keyInsights && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-card p-4 border-l-4 border-accent-purple">
                    <p className="text-slate-400 text-sm">最佳变体</p>
                    <p className="text-xl font-bold text-accent-purple">
                      {aiInsights.keyInsights.winningVariant || '-'}
                    </p>
                  </div>
                  <div className="glass-card p-4 border-l-4 border-pisces-400">
                    <p className="text-slate-400 text-sm">置信度</p>
                    <p className="text-xl font-bold text-pisces-400">
                      {((aiInsights.keyInsights.confidenceLevel || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className={`glass-card p-4 border-l-4 ${aiInsights.keyInsights.readyForDecision ? 'border-emerald-400' : 'border-amber-400'}`}>
                    <p className="text-slate-400 text-sm">决策状态</p>
                    <p className={`text-xl font-bold ${aiInsights.keyInsights.readyForDecision ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {aiInsights.keyInsights.readyForDecision ? '✓ 可以决策' : '⏳ 继续观察'}
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {aiInsights?.recommendations && aiInsights.recommendations.length > 0 && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap size={20} className="text-amber-400" />
                    可操作建议
                  </h3>
                  <div className="space-y-3">
                    {aiInsights.recommendations.map((rec, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border ${
                          rec.priority === 'HIGH' ? 'bg-red-500/10 border-red-500/30' :
                          rec.priority === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-slate-800/50 border-slate-700/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                rec.priority === 'HIGH' ? 'bg-red-500/30 text-red-400' :
                                rec.priority === 'MEDIUM' ? 'bg-amber-500/30 text-amber-400' :
                                'bg-slate-600/50 text-slate-400'
                              }`}>
                                {rec.priority === 'HIGH' ? '紧急' : rec.priority === 'MEDIUM' ? '建议' : '可选'}
                              </span>
                              <span className="text-xs text-slate-500">{rec.type}</span>
                            </div>
                            <p className="text-white font-medium">{rec.title}</p>
                            <p className="text-slate-400 text-sm mt-1">{rec.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-500">预期效果</p>
                            <p className="text-sm text-pisces-400">{rec.expectedImpact}</p>
                          </div>
                        </div>
                        {rec.action && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <p className="text-sm text-slate-300">
                              <span className="text-slate-500">操作：</span>{rec.action}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis Report */}
              {aiInsights && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Brain size={20} className="text-pisces-400" />
                    AI智能分析报告
                  </h3>
                  <div className="prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-300 leading-relaxed bg-slate-800/50 rounded-xl p-6">
                      {aiInsights.aiAnalysis || aiInsights.fallbackAnalysis?.recommendation || '暂无分析结果'}
                    </div>
                  </div>
                </div>
              )}

              {/* Graduation Decision */}
              {graduation && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Rocket size={20} className="text-emerald-400" />
                    自动毕业决策
                  </h3>
                  <div className={`p-4 rounded-xl mb-4 ${
                    graduation.canGraduate 
                      ? 'bg-emerald-500/10 border border-emerald-500/30' 
                      : 'bg-amber-500/10 border border-amber-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {graduation.canGraduate ? (
                        <CheckCircle size={24} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={24} className="text-amber-400" />
                      )}
                      <div>
                        <p className={`font-semibold ${graduation.canGraduate ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {graduation.canGraduate ? '可以全量发布' : '建议继续实验'}
                        </p>
                        <p className="text-slate-400 text-sm">
                          推荐变体: {graduation.recommendedVariant || '-'} | 
                          置信度: {((graduation.confidence || 0) * 100).toFixed(1)}% | 
                          风险等级: {graduation.riskLevel || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {graduation.reasons && graduation.reasons.length > 0 && (
                    <div className="mb-4">
                      <p className="text-slate-400 text-sm mb-2">决策依据:</p>
                      <ul className="space-y-1">
                        {graduation.reasons.map((reason, idx) => (
                          <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                            <Sparkles size={14} className="text-pisces-400 mt-0.5" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {graduation.graduationPlan && (
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <p className="text-white font-medium mb-3">发布计划</p>
                      <div className="space-y-2">
                        {graduation.graduationPlan.steps?.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-pisces-500/30 text-pisces-400 text-xs flex items-center justify-center">
                              {step.step}
                            </span>
                            <div>
                              <p className="text-white text-sm">{step.action}</p>
                              <p className="text-slate-400 text-xs">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prediction */}
              {prediction && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-amber-400" />
                    实验完成预测
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <p className="text-slate-400 text-sm">当前进度</p>
                      <p className="text-xl font-bold text-white">
                        {((prediction.currentProgress || 0) * 100).toFixed(0)}%
                      </p>
                      <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                        <div 
                          className="bg-pisces-500 h-2 rounded-full" 
                          style={{ width: `${(prediction.currentProgress || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <p className="text-slate-400 text-sm">已运行天数</p>
                      <p className="text-xl font-bold text-white">{prediction.daysRunning || 0} 天</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <p className="text-slate-400 text-sm">预计剩余</p>
                      <p className="text-xl font-bold text-amber-400">
                        {prediction.estimatedDaysRemaining > 0 ? `${prediction.estimatedDaysRemaining} 天` : prediction.status === 'COMPLETED' ? '已完成' : '评估中'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50">
                    <p className="text-slate-300">{prediction.message}</p>
                  </div>
                  {prediction.accelerationTips && prediction.accelerationTips.length > 0 && (
                    <div className="mt-4">
                      <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                        <Zap size={14} /> 加速建议
                      </p>
                      <ul className="space-y-1">
                        {prediction.accelerationTips.map((tip, idx) => (
                          <li key={idx} className="text-slate-300 text-sm">• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!aiInsights && !aiLoading && (
                <div className="glass-card p-8 text-center">
                  <Brain size={48} className="text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">点击加载AI智能分析</p>
                  <button onClick={loadAIInsights} className="btn-primary flex items-center gap-2 mx-auto">
                    <Sparkles size={16} /> 开始AI分析
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bayesian Tab */}
      {activeTab === 'bayesian' && bayesian && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-pisces-400" />
              贝叶斯胜率分析
            </h3>
            <p className="text-slate-400 mb-4">基准组: {bayesian.baselineGroup}</p>
            
            {/* Win Rate Bar Chart */}
            {winRateData.length > 0 && (
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={winRateData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => [`${value}%`, '胜率']}
                    />
                    <Bar dataKey="胜率" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {bayesian.winRates && (
              <div className="space-y-4">
                {Object.entries(bayesian.winRates).map(([groupId, winRate]) => (
                  <div key={groupId} className="p-4 rounded-xl bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{groupId}</span>
                      <span className={`text-lg font-bold ${winRate >= 0.95 ? 'text-emerald-400' : winRate <= 0.05 ? 'text-red-400' : 'text-amber-400'}`}>
                        {(winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${winRate >= 0.95 ? 'bg-emerald-500' : winRate <= 0.05 ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${winRate * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      {winRate >= 0.95 ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle size={14} /> 可以提前终止实验，全量上线此变体
                        </span>
                      ) : winRate <= 0.05 ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle size={14} /> 可以提前终止实验，放弃此变体
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertCircle size={14} /> 需要继续收集数据
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Significance Tab */}
      {activeTab === 'significance' && significance && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target size={20} className="text-accent-purple" />
              统计显著性检验
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-slate-800/50">
                <p className="text-slate-400 text-sm mb-1">Z统计量</p>
                <p className="text-2xl font-bold text-white">{significance.zStatistic?.toFixed(4)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50">
                <p className="text-slate-400 text-sm mb-1">P值</p>
                <p className={`text-2xl font-bold ${significance.pValue < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {significance.pValue?.toFixed(4)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50">
                <p className="text-slate-400 text-sm mb-1">相对提升</p>
                <p className={`text-2xl font-bold ${significance.relativeLift >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {significance.relativeLift >= 0 ? '+' : ''}{(significance.relativeLiftPercent || 0).toFixed(2)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50">
                <p className="text-slate-400 text-sm mb-1">置信区间 (95%)</p>
                <p className="text-xl font-bold text-white">
                  [{((significance.confidenceInterval?.lower || 0) * 100).toFixed(2)}%, 
                   {((significance.confidenceInterval?.upper || 0) * 100).toFixed(2)}%]
                </p>
              </div>
            </div>

            <div className={`mt-6 p-4 rounded-xl ${significance.isStatisticallySignificant ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
              <p className={significance.isStatisticallySignificant ? 'text-emerald-400' : 'text-amber-400'}>
                {significance.conclusion}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock size={20} className="text-amber-400" />
              转化率趋势
            </h3>
            {timelineData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    {experiment?.groups && Object.keys(experiment.groups).map((groupId, idx) => (
                      <Area 
                        key={groupId}
                        type="monotone" 
                        dataKey={groupId} 
                        stroke={COLORS[idx % COLORS.length]}
                        fill={COLORS[idx % COLORS.length]}
                        fillOpacity={0.3}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">暂无时间线数据</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
