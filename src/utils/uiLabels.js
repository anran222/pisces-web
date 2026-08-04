const createLabelResolver = (labels, fallback) => (value) => {
  const normalizedValue = String(value || '').trim().toUpperCase()
  return labels[normalizedValue] || fallback
}

export const EXPERIMENT_STATUS_LABELS = {
  DRAFT: '草稿',
  RUNNING: '运行中',
  PAUSED: '已暂停',
  STOPPED: '已停止'
}

export const APPROVAL_STATUS_LABELS = {
  NOT_REQUIRED: '无需审批',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝'
}

export const CONCLUSION_STATUS_LABELS = {
  NOT_READY: '未就绪',
  RUNNING: '运行中',
  READY_FOR_REVIEW: '待确认',
  GRADUATED: '已毕业',
  REJECTED: '已拒绝'
}

export const GUARDRAIL_STATUS_LABELS = {
  PASS: '已通过',
  BLOCKED: '已阻断',
  UNKNOWN: '待评估'
}

export const DECISION_LABELS = {
  GRADUATE: '建议毕业',
  CONTINUE: '继续观察',
  ROLLBACK: '建议回滚',
  HOLD: '暂缓处理',
  WAIT_FOR_DATA: '等待数据',
  RECOMMENDATION: '建议'
}

export const EXECUTION_MODE_LABELS = {
  MANUAL_ONLY: '仅人工执行',
  AUTOMATIC: '自动执行',
  AUTO: '自动执行'
}

export const TRAFFIC_STRATEGY_OPTIONS = [
  { value: 'HASH', label: '哈希分流' },
  { value: 'RANDOM', label: '随机分流' },
  { value: 'RULE', label: '规则分流' },
  { value: 'THOMPSON_SAMPLING', label: '汤普森采样' },
  { value: 'UCB', label: '置信上界分流' }
]

export const EVENT_CATEGORY_LABELS = {
  FUNNEL: '漏斗事件',
  ENGAGEMENT: '互动事件',
  BUSINESS: '业务事件',
  GUARDRAIL: '护栏事件',
  CUSTOM: '自定义事件'
}

export const METRIC_AGGREGATION_LABELS = {
  RATE: '比率指标',
  COUNT: '数量指标'
}

export const METRIC_DENOMINATOR_LABELS = {
  EVENT_COUNT: '按事件次数计算',
  VISITOR_COUNT: '按访客人数计算',
  ASSIGNMENT_COUNT: '按分流人数计算',
  EXPOSURE_COUNT: '按曝光人数计算'
}

export const VALUE_TYPE_LABELS = {
  STRING: '文本',
  INTEGER: '整数',
  BOOLEAN: '布尔值',
  OBJECT: '对象',
  JSON: '结构化数据'
}

export const TRAFFIC_STRATEGY_LABELS = Object.fromEntries(
  TRAFFIC_STRATEGY_OPTIONS.map(option => [option.value, option.label])
)

export const getExperimentStatusLabel = createLabelResolver(EXPERIMENT_STATUS_LABELS, '未知状态')
export const getApprovalStatusLabel = createLabelResolver(APPROVAL_STATUS_LABELS, '未知审批状态')
export const getConclusionStatusLabel = createLabelResolver(CONCLUSION_STATUS_LABELS, '未知结论状态')
export const getGuardrailStatusLabel = createLabelResolver(GUARDRAIL_STATUS_LABELS, '待评估')
export const getDecisionLabel = createLabelResolver(DECISION_LABELS, '等待建议')
export const getExecutionModeLabel = createLabelResolver(EXECUTION_MODE_LABELS, '仅人工执行')
export const getTrafficStrategyLabel = createLabelResolver(TRAFFIC_STRATEGY_LABELS, '未知分流策略')
export const getEventCategoryLabel = createLabelResolver(EVENT_CATEGORY_LABELS, '其他事件')
export const getMetricAggregationLabel = createLabelResolver(METRIC_AGGREGATION_LABELS, '其他指标')
export const getMetricDenominatorLabel = createLabelResolver(METRIC_DENOMINATOR_LABELS, '其他分母口径')
export const getValueTypeLabel = createLabelResolver(VALUE_TYPE_LABELS, '未知类型')

const RISK_FLAG_LABELS = {
  ZERO_EXPOSURES: '暂无曝光数据',
  INSUFFICIENT_SAMPLE_SIZE: '样本量不足',
  DATA_QUALITY_WARNINGS: '数据质量存在警告',
  SAMPLE_SIZE_NOT_REACHED: '样本量尚未达标',
  ANALYSIS_NOT_READY: '分析尚未就绪',
  AI_UNAVAILABLE: '智能分析暂不可用',
  DESIGN_DRAFT_INCOMPLETE: '实验方案不完整',
  SRM: '样本比例异常'
}

const VARIANT_LABELS = {
  a: '实验组一',
  b: '实验组二',
  c: '实验组三',
  d: '实验组四'
}

const SYSTEM_TEXT_REPLACEMENTS = [
  [/\bREADY_FOR_REVIEW\b/gi, '待确认'],
  [/\bNOT_REQUIRED\b/gi, '无需审批'],
  [/\bTHOMPSON_SAMPLING\b/gi, '汤普森采样'],
  [/\bSAMPLE_SIZE_NOT_REACHED\b/gi, '样本量尚未达标'],
  [/\bANALYSIS_NOT_READY\b/gi, '分析尚未就绪'],
  [/\bZERO_EXPOSURES\b/gi, '暂无曝光数据'],
  [/\bINSUFFICIENT_SAMPLE_SIZE\b/gi, '样本量不足'],
  [/\bDATA_QUALITY_WARNINGS\b/gi, '数据质量存在警告'],
  [/\bWAIT_FOR_DATA\b/gi, '等待数据'],
  [/\bMANUAL_ONLY\b/gi, '仅人工执行'],
  [/\bNO_DATA\b/gi, '暂无数据'],
  [/\bGRADUATE\b/gi, '建议毕业'],
  [/\bCONTINUE\b/gi, '继续观察'],
  [/\bROLLBACK\b/gi, '建议回滚'],
  [/\bUNKNOWN\b/gi, '待评估'],
  [/\bsampleSizeReached\b/gi, '样本量达标状态'],
  [/\bassignments?\b/gi, '分流记录'],
  [/\bexposures?\b/gi, '曝光'],
  [/\bcontrol\b/gi, '对照组'],
  [/\bDRAFT\b/g, '草稿'],
  [/\bRUNNING\b/g, '运行中'],
  [/\bPAUSED\b/g, '已暂停'],
  [/\bSTOPPED\b/g, '已停止'],
  [/\bBLOCKED\b/g, '已阻断'],
  [/\bPASS\b/g, '已通过'],
  [/\bPENDING\b/g, '待处理'],
  [/\bAPPROVED\b/g, '已通过'],
  [/\bREJECTED\b/g, '已拒绝'],
  [/\bOPEN\b/g, '待确认'],
  [/\btrue\b/gi, '是'],
  [/\bfalse\b/gi, '否'],
  [/\bSRM\b/g, '样本比例异常'],
  [/\bMAB\b/g, '智能动态分流'],
  [/\bSLA\b/g, '审批时效'],
  [/\bSDK\b/g, '客户端组件'],
  [/\bCTA\b/g, '行动按钮'],
  [/\bAI\b/g, '智能分析'],
  [/\bAPI Key\b/gi, '接口密钥']
]

export const localizeSystemText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  let localizedText = String(value)
  localizedText = localizedText.replace(/\bvariant_([a-d])\b/gi, (_, suffix) => (
    VARIANT_LABELS[String(suffix).toLowerCase()] || '实验组'
  ))
  localizedText = localizedText.replace(/实验组\s*([a-d])\b/gi, (_, suffix) => (
    VARIANT_LABELS[String(suffix).toLowerCase()] || '实验组'
  ))
  SYSTEM_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    localizedText = localizedText.replace(pattern, replacement)
  })
  return localizedText
}

export const getRiskFlagLabel = (value) => {
  const normalizedValue = String(value || '').trim().toUpperCase()
  return RISK_FLAG_LABELS[normalizedValue] || localizeSystemText(value) || '其他风险项'
}

export const getEscalationStatusLabel = createLabelResolver({
  OPEN: '待确认',
  ACKNOWLEDGED: '已确认',
  RESOLVED: '已解决'
}, '未知告警状态')

export const getNotificationChannelLabel = createLabelResolver({
  OUTBOX: '默认投递通道',
  DEFAULT: '默认投递通道',
  FEISHU: '飞书通知',
  WEBHOOK: '回调通知',
  LOG: '日志通知'
}, '其他投递通道')

export const getApiModeLabel = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'dashscope') {
    return '百炼原生调用'
  }
  if (normalizedValue === 'openai-compatible') {
    return '兼容调用'
  }
  return normalizedValue ? '其他调用方式' : ''
}

export const getMetricKeyLabel = (value) => ({
  ORDER_CONVERSION_RATE: '下单转化率',
  REFUND_REQUEST_RATE: '退款申请率',
  PAYMENT_RATE: '支付转化率',
  CONVERSION_RATE: '转化率'
}[String(value || '').trim().toUpperCase()] || '主要指标')
