import axios from 'axios'
import { buildExperimentListParams } from '../utils/experimentFilters'

const piscesApiKey = import.meta.env.VITE_PISCES_API_KEY
const DEFAULT_REQUEST_TIMEOUT_MS = 20000
const LONG_RUNNING_REQUEST_TIMEOUT_MS = 300000

export const isPiscesApiKeyConfigured = Boolean(piscesApiKey)

const localizeAuthorizationError = (error) => {
  const status = error?.response?.status
  if (status !== 401 && status !== 403) {
    return error
  }
  const message = !isPiscesApiKeyConfigured
    ? '本地前端尚未配置管理密钥，请设置 VITE_PISCES_API_KEY 后重新启动前端服务'
    : (status === 401
      ? '当前管理密钥无效或已失效，请检查本地 VITE_PISCES_API_KEY 配置'
      : '当前访问身份无权操作该应用，请切换到有权限的管理密钥')
  error.message = message
  if (error.response?.data && typeof error.response.data === 'object') {
    error.response.data.message = message
  }
  return error
}

const localizeRequestError = (error) => {
  const localizedError = localizeAuthorizationError(error)
  if (localizedError?.code === 'ECONNABORTED') {
    localizedError.message = '请求等待超时，请稍后重试'
    return localizedError
  }
  if (!localizedError?.response && localizedError?.code === 'ERR_NETWORK') {
    localizedError.message = '无法连接服务，请检查本地服务是否已经启动'
  }
  return localizedError
}

const api = axios.create({
  baseURL: '/api',
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    ...(piscesApiKey ? { 'X-Pisces-Api-Key': piscesApiKey } : {}),
  }
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('接口请求失败:', error)
    return Promise.reject(localizeRequestError(error))
  }
)

// 实验管理 API
export const experimentAPI = {
  // 获取实验列表（可按状态筛选）
  list: (statusOrFilters = null, statuses = null) => {
    const filters = statusOrFilters && typeof statusOrFilters === 'object' && !Array.isArray(statusOrFilters)
      ? statusOrFilters
      : { status: statusOrFilters, statuses }
    const params = buildExperimentListParams(filters)
    return api.get('/experiments', { params })
  },
  
  // 根据状态查询实验列表
  listByStatus: (status) => api.get(`/experiments/status/${status}`),

  // 在不写入数据的情况下检查实验草案
  preflight: (data) => api.post('/experiments/preflight', data),
  
  // 获取实验详情
  get: (id) => api.get(`/experiments/${id}`),

  // 查询实验审计日志
  listAuditLogs: (id) => api.get(`/experiments/${id}/audit-logs`),

  // 查询实验配置版本
  listConfigVersions: (id) => api.get(`/experiments/${id}/config-versions`),

  // 查询实验配置草稿
  getConfigDraft: (id) => api.get(`/experiments/${id}/config-draft`),

  // 查询实验配置草稿审批历史
  listConfigDraftApprovals: (id) => api.get(`/experiments/${id}/config-draft/approvals`),

  // 保存实验配置草稿
  saveConfigDraft: (id, data, comment = '', operator = 'web-ui') =>
    api.put(`/experiments/${id}/config-draft`, { ...data, comment, operator }),

  // 发布实验配置草稿
  publishConfigDraft: (id, comment = '', operator = 'web-ui') =>
    api.post(`/experiments/${id}/config-draft/publish`, { comment, operator }),

  // 发布当前实验配置
  publishConfigVersion: (id, comment = '', operator = 'web-ui') =>
    api.post(`/experiments/${id}/config-versions/publish`, { comment, operator }),

  // 回滚实验配置版本
  rollbackConfigVersion: (id, targetConfigVersion, comment = '', operator = 'web-ui') =>
    api.post(`/experiments/${id}/config-versions/rollback`, { targetConfigVersion, comment, operator }),

  // 查询实验审批任务
  listApprovalTasks: (filters = {}) => api.get('/experiments/approval-tasks', { params: filters }),

  // 扫描逾期审批并创建升级告警
  scanApprovalEscalations: (filters = {}) =>
    api.post('/experiments/approval-escalations/scan', null, { params: filters }),

  // 查询审批升级告警投递状态
  getApprovalEscalationStatus: (filters = {}) =>
    api.get('/experiments/approval-escalations/status', { params: filters }),

  // 批量重投审批升级告警死信
  retryDeadApprovalEscalations: (filters = {}, operator = 'web-ui') =>
    api.post('/experiments/approval-escalations/dead/retry', null, { params: { ...filters, operator } }),

  // 查询审批升级告警
  listApprovalEscalations: (filters = {}) =>
    api.get('/experiments/approval-escalations', { params: filters }),

  // 确认审批升级告警
  acknowledgeApprovalEscalation: (escalationId, comment = '', operator = 'web-ui') =>
    api.post(`/experiments/approval-escalations/${escalationId}/ack`, { comment, operator }),

  // 重投单条审批升级告警死信
  retryApprovalEscalationNotification: (escalationId, operator = 'web-ui') =>
    api.post(`/experiments/approval-escalations/${escalationId}/notification/retry`, null, { params: { operator } }),
  
  // 创建实验
  create: (data) => api.post('/experiments', data),
  
  // 更新实验
  update: (id, data) => api.put(`/experiments/${id}`, data),

  // 更新实验结论状态
  updateConclusionStatus: (id, payloadOrStatus, operator = 'web-ui') => {
    const payload = payloadOrStatus && typeof payloadOrStatus === 'object'
      ? payloadOrStatus
      : { conclusionStatus: payloadOrStatus, operator }
    return api.post(`/experiments/${id}/conclusion-status`, payload)
  },

  // 更新实验审批状态
  updateApprovalStatus: (id, approvalStatus, comment = '', operator = 'web-ui', options = {}) =>
    api.post(`/experiments/${id}/approval-status`, { approvalStatus, comment, operator, ...options }),
  
  // 删除实验
  delete: (id) => api.delete(`/experiments/${id}`),
  
  // 启动实验
  start: (id) => api.post(`/experiments/${id}/start`),
  
  // 停止实验
  stop: (id) => api.post(`/experiments/${id}/stop`),
  
  // 暂停实验
  pause: (id) => api.post(`/experiments/${id}/pause`),
  
  // 恢复实验
  resume: (id) => api.post(`/experiments/${id}/resume`),

  // 为已有实验生成真实事件数据
  simulateData: (id, data) => api.post(`/experiments/generator/${id}/simulate`, data, {
    timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
  }),

  // 快速生成演示实验
  generateDemoExperiment: () => api.post('/experiments/generator/demo'),
  
  // 批量暂停实验
  batchPause: (ids) => api.post('/experiments/batch/pause', ids),
  
  // 批量停止实验
  batchStop: (ids) => api.post('/experiments/batch/stop', ids),
  
  // 批量恢复实验
  batchResume: (ids) => api.post('/experiments/batch/resume', ids),
  
  // 批量删除实验
  batchDelete: async (ids) => {
    try {
      return await api.post('/experiments/batch/delete', ids)
    } catch (error) {
      // 兼容后端未提供批量删除接口的情况：降级为逐个删除
      if (error.response?.status === 404) {
        const results = await Promise.allSettled(ids.map(id => experimentAPI.delete(id)))
        const failedItems = results
          .map((res, idx) => ({ res, id: ids[idx] }))
          .filter(({ res }) => res.status === 'rejected')
          .map(({ res, id }) => ({
            id,
            error: res.reason?.response?.data?.message || res.reason?.message || '未知错误'
          }))
        
        return {
          message: failedItems.length > 0 
            ? `部分删除失败 (${failedItems.length}/${ids.length})`
            : '删除成功',
          failedCount: failedItems.length,
          failedItems
        }
      }
      throw error
    }
  },
}

// 应用空间 API
export const applicationAPI = {
  // 查询当前 key 可见的应用空间
  list: () => api.get('/applications'),

  // 查询单个应用的接入链路状态
  getIntegrationHealth: (appId) => api.get(`/applications/${appId}/integration-health`),

  // 注册新的应用空间
  register: (appId, data) => api.post(`/applications/${appId}`, data),

  // 更新应用空间治理信息
  upsert: (appId, data) => api.put(`/applications/${appId}`, data),

  // 查询应用级事件和指标字典
  getDictionary: (appId) => api.get(`/applications/${appId}/dictionary`),

  // 新增或更新应用级事件和指标字典
  upsertDictionary: (appId, data) => api.put(`/applications/${appId}/dictionary`, data),
}

// 流量分配 API
export const trafficAPI = {
  // 分配访客到实验组
  assign: (experimentId, visitorId) => 
    api.post('/traffic/assign', { experimentId, visitorId }),
  
  // 获取MAB分配概率
  getMABProbabilities: (experimentId) => 
    api.get(`/traffic/experiment/${experimentId}/mab/probabilities`),
  
  // 获取MAB统计摘要
  getMABSummary: (experimentId) => 
    api.get(`/traffic/experiment/${experimentId}/mab/summary`, {
      timeout: 10000
    }),
  
  // 获取Beta参数
  getBetaParameters: (experimentId, groupId) => 
    api.get(`/traffic/experiment/${experimentId}/mab/beta`, { params: { groupId } }),
  
  // 获取组统计
  getGroupStats: (experimentId, groupId) => 
    api.get(`/traffic/experiment/${experimentId}/mab/stats`, { params: { groupId } }),
  
  // 重置MAB数据
  resetMAB: (experimentId) => 
    api.post(`/traffic/experiment/${experimentId}/mab/reset`),
}

// 数据分析 API
export const analysisAPI = {
  // 获取统计数据
  getStatistics: (experimentId) => 
    api.get(`/analysis/experiment/${experimentId}/statistics`),

  // 获取事件管道状态
  getEventPipelineStatus: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/event-pipeline`),

  // 重试事件管道死信记录
  retryDeadEvents: (experimentId, operator = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/event-pipeline/dead/retry`, null, {
      params: { operator }
    }),

  // 重放事实表并重建事件管道派生数据
  replayEventPipeline: (experimentId, operator = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/events/replay`, null, {
      params: { operator }
    }),

  // 生成只读事件重放计划
  planEventReplay: (experimentId, request = {}) =>
    api.post(`/analysis/experiment/${experimentId}/events/replay/plan`, request),

  // 按安全边界修复缺失派生物化账本
  repairEventMaterialization: (experimentId, request = {}, operator = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/events/replay/materialization/repair`, request, {
      params: { operator }
    }),

  // 按重放计划分段修复缺失派生物化账本
  repairEventMaterializationSegment: (experimentId, segmentIndex, request = {}, operator = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/events/replay/materialization/repair/segments/${segmentIndex}`, request, {
      params: { operator }
    }),

  // 查询事件管道重放任务
  listEventReplayJobs: (experimentId, limit = 3) =>
    api.get(`/analysis/experiment/${experimentId}/events/replay/jobs`, {
      params: { limit }
    }),

  // 查询单个事件管道重放任务
  getEventReplayJob: (experimentId, replayJobId) =>
    api.get(`/analysis/experiment/${experimentId}/events/replay/jobs/${replayJobId}`),

  // 取消运行中的事件管道重放任务
  cancelEventReplayJob: (experimentId, replayJobId, operator = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/events/replay/jobs/${replayJobId}/cancel`, null, {
      params: { operator }
    }),
  
  // 组间对比
  compareGroups: (experimentId) => 
    api.get(`/analysis/experiment/${experimentId}/compare`),
  
  // 统计显著性检验
  significanceTest: (experimentId, variantGroupId, baselineGroupId, confidenceLevel = 0.95) =>
    api.get(`/analysis/experiment/${experimentId}/significance`, {
      params: { variantGroupId, baselineGroupId, confidenceLevel }
    }),
  
  // 计算所需样本量
  calculateSampleSize: (baselineRate, mde = 0.1, power = 0.8, significance = 0.05) =>
    api.get('/analysis/sample-size', {
      params: { baselineRate, minimumDetectableEffect: mde, power, significance }
    }),
  
  // 贝叶斯分析
  getBayesianAnalysis: (experimentId) => 
    api.get(`/analysis/experiment/${experimentId}/bayesian`),
  
  // 判断是否可以提前终止
  shouldEarlyStop: (experimentId, variantGroupId, baselineGroupId, threshold = 0.95) =>
    api.get(`/analysis/experiment/${experimentId}/early-stop`, {
      params: { variantGroupId, baselineGroupId, winRateThreshold: threshold }
    }),
  
  // 导出实验报告
  exportReport: (experimentId) => 
    api.get(`/analysis/experiment/${experimentId}/report`),

  // 生成实验报告快照
  createReportSnapshot: (experimentId, generatedBy = 'web-ui') =>
    api.post(`/analysis/experiment/${experimentId}/report/snapshots`, null, {
      params: { generatedBy }
    }),

  // 查询实验报告快照列表
  listReportSnapshots: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/report/snapshots`),
  
  // 获取时间线
  getTimeline: (experimentId, metricType = 'CONVERSION_RATE', granularity = 'DAY') =>
    api.get(`/analysis/experiment/${experimentId}/timeline`, {
      params: { metricType, granularity }
    }),
  
  // 因果推断（仅支持 DID / PSM）
  causalInference: (experimentId, method, treatmentGroupId, controlGroupId, params) =>
    api.post(`/analysis/experiment/${experimentId}/causal-inference`, params, {
      params: { method, treatmentGroupId, controlGroupId }
    }),
  
  
  // AI实验设计建议 v2
  designExperiment: (payload) =>
    api.post('/analysis/experiment/ai-design/v2', payload, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS
    }),

  // AI实验诊断
  getAIDiagnosis: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/ai-diagnosis`, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS
    }),

  // AI毕业决策
  getAIGraduationDecision: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/ai-graduation-decision`, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS
    }),
}

// 变体生成 API
export const variantAPI = {
  // 生成文本变体
  generateText: (prompt, count = 10) =>
    api.post('/variants/text/generate', null, {
      params: { prompt, count },
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
    }),
  
  // 生成图像变体
  generateImage: (prompt, count = 5) =>
    api.post('/variants/image/generate', null, {
      params: { prompt, count },
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
    }),

  // 统一生成候选变体
  generateCandidates: (payload) =>
    api.post('/variants/generate', payload, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS
    }),

  // 基于当前候选和最近对话修订完整方案
  refineCandidates: (payload) =>
    api.post('/variants/refine', payload, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS
    }),
}

// 数据上报 API
export const dataAPI = {
  // 上报事件
  reportEvent: (experimentId, visitorId, eventType, eventName, properties = {}) =>
    api.post('/data/event', {
      experimentId,
      visitorId,
      eventType,
      eventName,
      properties
    }),
}

export default api
