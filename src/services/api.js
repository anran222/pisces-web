import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 提升至5分钟，适配耗时接口
  headers: {
    'Content-Type': 'application/json',
  }
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 实验管理 API
export const experimentAPI = {
  // 获取实验列表（可按状态筛选）
  list: (status = null, statuses = null) => {
    const params = {}
    if (status) params.status = status
    if (statuses) params.statuses = statuses
    return api.get('/experiments', { params })
  },
  
  // 根据状态查询实验列表
  listByStatus: (status) => api.get(`/experiments/status/${status}`),
  
  // 获取实验详情
  get: (id) => api.get(`/experiments/${id}`),
  
  // 创建实验
  create: (data) => api.post('/experiments', data),
  
  // 更新实验
  update: (id, data) => api.put(`/experiments/${id}`, data),

  // 更新实验结论状态
  updateConclusionStatus: (id, conclusionStatus, operator = 'web-ui') =>
    api.post(`/experiments/${id}/conclusion-status`, { conclusionStatus, operator }),
  
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
  simulateData: (id, data) => api.post(`/experiments/generator/${id}/simulate`, data),
  
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
    api.get(`/traffic/experiment/${experimentId}/mab/summary`),
  
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
  
  // 因果推断
  causalInference: (experimentId, method, treatmentGroupId, controlGroupId, params) =>
    api.post(`/analysis/experiment/${experimentId}/causal-inference`, params, {
      params: { method, treatmentGroupId, controlGroupId }
    }),
  
  // HTE分析
  analyzeHTE: (experimentId, treatmentGroupId, controlGroupId, userFeatures) =>
    api.post(`/analysis/experiment/${experimentId}/hte`, userFeatures, {
      params: { treatmentGroupId, controlGroupId }
    }),
  
  // 敏感群体识别
  identifySensitiveGroups: (experimentId, treatmentGroupId, controlGroupId, userFeatures) =>
    api.post(`/analysis/experiment/${experimentId}/sensitive-groups`, userFeatures, {
      params: { treatmentGroupId, controlGroupId }
    }),
  
  // AI智能实验解读
  getAIInsights: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/ai-insights`, {
      // AI分析可能耗时较长，单次请求超时提升到5分钟
      timeout: 300000
    }),
  
  // AI实验设计建议
  getAIExperimentDesign: (businessScenario, targetMetric, constraints = []) =>
    api.post('/analysis/experiment/ai-design', { businessScenario, targetMetric, constraints }),
  
  // AI自动毕业决策
  autoGraduateDecision: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/auto-graduate`, {
      timeout: 300000
    }),
  
  // AI预测实验完成时间
  predictCompletion: (experimentId) =>
    api.get(`/analysis/experiment/${experimentId}/predict-completion`, {
      timeout: 300000
    }),
}

// 变体生成 API
export const variantAPI = {
  // 生成文本变体
  generateText: (prompt, count = 10) =>
    api.post('/variants/text/generate', null, { params: { prompt, count } }),
  
  // 生成图像变体
  generateImage: (prompt, count = 5) =>
    api.post('/variants/image/generate', null, { params: { prompt, count } }),
  
  // 基于上传图片生成变体（图生图）
  generateImageFromImage: (imageBase64, prompt, count = 4) =>
    api.post('/variants/image/generate-from-image', { imageBase64, prompt, count }),
  
  // 图片局部编辑
  editImage: (imageBase64, maskBase64, prompt) =>
    api.post('/variants/image/edit', { imageBase64, maskBase64, prompt }),
  
  // 图片风格转换
  styleTransfer: (imageBase64, style) =>
    api.post('/variants/image/style-transfer', { imageBase64, style }),
  
  // 获取支持的风格列表
  getImageStyles: () => api.get('/variants/image/styles'),
  
  // 筛选变体
  filter: (variants, variantType) =>
    api.post('/variants/filter', variants, { params: { variantType } }),
  
  // 评估变体
  evaluate: (variant, variantType) =>
    api.post('/variants/evaluate', null, { params: { variant, variantType } }),
  
  // 完整文本实验体生成
  generateCompleteText: (prompt, generateCount = 20, finalCount = 5) =>
    api.post('/variants/text/demo', null, { 
      params: { prompt, generateCount, finalCount } 
    }),
  
  // 完整实验流程演示
  generateCompleteFlow: (prompt, generateCount = 15, finalCount = 4, visitorCount = 150, daysAgo = 7) =>
    api.post('/variants/experiment/flow', null, {
      params: { prompt, generateCount, finalCount, visitorCount, daysAgo }
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
