const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..');
const baseUrl = process.env.PISCES_WEB_BASE_URL || 'http://127.0.0.1:3040';
const outDir = path.resolve(
  repoRoot,
  process.env.PISCES_WEB_SCREENSHOT_DIR || 'target/screenshots/core-functions-current',
);
const layoutAuditFile = path.resolve(
  repoRoot,
  process.env.PISCES_WEB_LAYOUT_AUDIT_FILE || path.join(outDir, 'layout-audit.json'),
);
const layoutAuditStrict = process.env.PISCES_WEB_LAYOUT_AUDIT_STRICT !== 'false';
const chromePath = process.env.PISCES_PLAYWRIGHT_CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const layoutAuditRecords = [];
const runtimeErrors = [];
const HORIZONTAL_WORKSPACE = { requireViewportFit: true, maxScrollRatio: 1.08 };
const HORIZONTAL_MODAL = { requireViewportFit: true, requireDialogWithinViewport: true, maxScrollRatio: 1.08 };

fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(outDir)) {
  if (entry.toLowerCase().endsWith('.png')) {
    fs.unlinkSync(path.join(outDir, entry));
  }
}

const groupConfigSchema = [
  { key: 'headline', label: '主标题', valueType: 'STRING', required: true, defaultValue: '安全快捷完成支付' },
  { key: 'trustBadge', label: '保障标签', valueType: 'STRING', required: true, defaultValue: '平台保障' },
  { key: 'cta', label: '按钮文案', valueType: 'STRING', required: true, defaultValue: '确认支付' },
];

const eventDefinitions = [
  { key: 'CHECKOUT_VIEW', label: '进入结账页', category: 'FUNNEL', primary: true },
  { key: 'PAY_SUCCESS', label: '支付成功', category: 'BUSINESS' },
  { key: 'REFUND_REQUEST', label: '退款申请', category: 'GUARDRAIL' },
];

const metricDefinitions = [
  {
    key: 'PAY_CONVERSION_RATE',
    name: '支付转化率',
    aggregationType: 'RATE',
    numeratorEventType: 'PAY_SUCCESS',
    denominatorType: 'EVENT_COUNT',
    denominatorEventType: 'CHECKOUT_VIEW',
    primaryMetric: true,
  },
  {
    key: 'REFUND_REQUEST_RATE',
    name: '退款申请率',
    aggregationType: 'RATE',
    numeratorEventType: 'REFUND_REQUEST',
    denominatorType: 'EVENT_COUNT',
    denominatorEventType: 'PAY_SUCCESS',
    guardrailMetric: true,
  },
];

const groups = {
  control: {
    id: 'control',
    name: '原始结账页',
    trafficRatio: 0.34,
    config: { headline: '安全快捷完成支付', trustBadge: '平台保障', cta: '确认支付' },
  },
  variant_a: {
    id: 'variant_a',
    name: '保障前置组',
    trafficRatio: 0.33,
    config: { headline: '先保障，再支付', trustBadge: '7 天无忧', cta: '放心支付' },
  },
  variant_b: {
    id: 'variant_b',
    name: '权益强化组',
    trafficRatio: 0.33,
    config: { headline: '售后无忧，立即支付', trustBadge: '24h 客服', cta: '立即锁定权益' },
  },
};

const mainExperiment = {
  id: 'exp_checkout_001',
  name: '结账页信任提示实验',
  description: '验证保障说明和支付 CTA 对结账页支付转化率的影响，同时监控退款申请率护栏。',
  status: 'RUNNING',
  type: 'A_B',
  appId: 'growth-shop',
  owner: 'growth-ops',
  layerId: 'checkout-runtime-plane',
  startTime: '2026-07-22T09:00:00',
  endTime: '2026-08-05T23:59:59',
  configVersion: 6,
  conclusionStatus: 'READY_FOR_REVIEW',
  suggestedConclusionStatus: 'GRADUATED',
  conclusionConfigVersion: 6,
  conclusionReportSnapshotVersion: 12,
  conclusionOperator: 'growth-lead',
  conclusionComment: 'AI 建议毕业，等待业务 owner 复核护栏。',
  conclusionUpdatedAt: '2026-07-30T10:15:00',
  approvalStatus: 'APPROVED',
  approvalOperator: 'risk-owner',
  approvalComment: '护栏指标在预算内，同意继续推进。',
  approvalUpdatedAt: '2026-07-29T18:30:00',
  traffic: {
    strategy: 'HASH',
    totalTraffic: 0.25,
    allocation: [
      { group: 'control', ratio: 0.34 },
      { group: 'variant_a', ratio: 0.33 },
      { group: 'variant_b', ratio: 0.33 },
    ],
  },
  groups,
  groupConfigSchema,
  eventDefinitions,
  metricDefinitions,
};

const experiments = [
  mainExperiment,
  {
    ...mainExperiment,
    id: 'exp_recommend_002',
    name: '推荐理由卡片排序实验',
    status: 'RUNNING',
    owner: 'recommendation',
    conclusionStatus: 'RUNNING',
    suggestedConclusionStatus: 'CONTINUE',
    approvalStatus: 'PENDING',
    configVersion: 3,
  },
  {
    ...mainExperiment,
    id: 'exp_search_003',
    name: '搜索无结果页补救策略',
    status: 'PAUSED',
    appId: 'search-app',
    owner: 'search-team',
    conclusionStatus: 'READY_FOR_REVIEW',
    suggestedConclusionStatus: 'REJECTED',
    approvalStatus: 'REJECTED',
    configVersion: 2,
  },
  {
    ...mainExperiment,
    id: 'exp_member_004',
    name: '会员权益露出节奏实验',
    status: 'DRAFT',
    appId: 'member-center',
    owner: 'member-growth',
    conclusionStatus: 'NOT_READY',
    approvalStatus: 'NOT_REQUIRED',
    configVersion: 1,
  },
];

const statistics = {
  experimentId: 'exp_checkout_001',
  summary: {
    totalAssignments: 128420,
    totalExposures: 121806,
    totalEvents: 43862,
    totalVisitors: 118932,
    bestPerformingGroup: '保障前置组',
    bestConversionRate: 0.1624,
    bestPrimaryMetricValue: 0.1624,
    primaryMetricKey: 'PAY_CONVERSION_RATE',
  },
  dataQualityCheck: {
    analysisReady: true,
    srmDetected: false,
    blockingIssues: [],
    warnings: ['variant_b 曝光略低于计划配比，继续观察 6 小时'],
  },
  groupStatistics: {
    control: {
      groupId: 'control',
      groupName: '原始结账页',
      assignmentCount: 43651,
      exposureCount: 41458,
      userCount: 41022,
      conversionCount: 5906,
      conversionRate: 0.1425,
      liftRate: 0,
      eventCounts: { PAY_SUCCESS: 5906, CHECKOUT_VIEW: 41458, REFUND_REQUEST: 218 },
      metricValues: { PAY_CONVERSION_RATE: 0.1425, REFUND_REQUEST_RATE: 0.0369 },
    },
    variant_a: {
      groupId: 'variant_a',
      groupName: '保障前置组',
      assignmentCount: 42406,
      exposureCount: 40501,
      userCount: 39762,
      conversionCount: 6578,
      conversionRate: 0.1624,
      liftRate: 0.1396,
      eventCounts: { PAY_SUCCESS: 6578, CHECKOUT_VIEW: 40501, REFUND_REQUEST: 231 },
      metricValues: { PAY_CONVERSION_RATE: 0.1624, REFUND_REQUEST_RATE: 0.0351 },
    },
    variant_b: {
      groupId: 'variant_b',
      groupName: '权益强化组',
      assignmentCount: 42363,
      exposureCount: 39847,
      userCount: 38148,
      conversionCount: 6127,
      conversionRate: 0.1538,
      liftRate: 0.0793,
      eventCounts: { PAY_SUCCESS: 6127, CHECKOUT_VIEW: 39847, REFUND_REQUEST: 286 },
      metricValues: { PAY_CONVERSION_RATE: 0.1538, REFUND_REQUEST_RATE: 0.0467 },
    },
  },
};

const eventPipelineStatus = {
  experimentId: 'exp_checkout_001',
  totalCount: 43862,
  pendingCount: 0,
  processingCount: 0,
  retryCount: 2,
  doneCount: 43860,
  deadCount: 1,
  rejectedCount: 0,
  unfinishedCount: 3,
  maxPendingSeconds: 42,
  healthy: true,
  status: 'RETRY',
};

const eventReplayJobs = [
  {
    replayJobId: 'replay_20260730_001',
    jobStatus: 'RUNNING',
    replayMode: 'FILTERED_DERIVED_COPY_REPLAY',
    fullDerivedReplay: false,
    plannedAffectedCount: 5000,
    plannedEventCount: 5000,
    plannedExposureCount: 0,
    plannedGroupCount: 2,
    progressPercent: 37,
    affectedCount: 1842,
    eventCount: 1842,
    exposureCount: 0,
    mabRewardCount: 612,
    scopeStartTime: '2026-07-30T00:00:00',
    scopeEndTime: '2026-07-30T01:00:00',
    eventTypes: ['PAY_SUCCESS'],
    includeEvents: true,
    includeExposures: false,
    startedAt: '2026-07-30T10:20:10',
  },
  {
    replayJobId: 'replay_20260729_004',
    jobStatus: 'SUCCEEDED',
    replayMode: 'FULL_DERIVED_REBUILD',
    fullDerivedReplay: true,
    plannedAffectedCount: 42118,
    plannedEventCount: 18391,
    plannedExposureCount: 23727,
    plannedGroupCount: 3,
    progressPercent: 100,
    affectedCount: 42118,
    eventCount: 18391,
    exposureCount: 23727,
    mabRewardCount: 6128,
    startedAt: '2026-07-29T23:10:00',
    finishedAt: '2026-07-29T23:16:42',
  },
];

const replayPlan = {
  experimentId: 'exp_checkout_001',
  replayMode: 'FILTERED_DERIVED_COPY_REPLAY',
  fullDerivedReplay: false,
  eventTypes: ['PAY_SUCCESS', 'REFUND_REQUEST'],
  includeEvents: true,
  includeExposures: false,
  requestedSegmentCount: 4,
  segmentCount: 4,
  segmentRecoverySupported: true,
  segmentRecoveryMessage: '可使用 /events/replay/materialization/repair/segments/{segmentIndex} 按分段修复缺账本',
  maxSegmentAffectedCount: 521,
  maxSegmentUnmaterializedCount: 14,
  eventCount: 1842,
  materializedEventCount: 1811,
  unmaterializedEventCount: 31,
  exposureCount: 0,
  materializedExposureCount: 0,
  unmaterializedExposureCount: 0,
  affectedCount: 1842,
  materializedCount: 1811,
  unmaterializedCount: 31,
  groupCount: 3,
  message: '筛选范围将执行复制型 replay，不清空现有 Redis/MAB 派生数据。',
  generatedAt: '2026-07-30T10:21:30',
  groups: [
    { groupId: 'control', groupName: '原始结账页', eventCount: 603, exposureCount: 0, affectedCount: 603, materializedCount: 594, unmaterializedCount: 9 },
    { groupId: 'variant_a', groupName: '保障前置组', eventCount: 674, exposureCount: 0, affectedCount: 674, materializedCount: 662, unmaterializedCount: 12 },
    { groupId: 'variant_b', groupName: '权益强化组', eventCount: 565, exposureCount: 0, affectedCount: 565, materializedCount: 555, unmaterializedCount: 10 },
  ],
  segments: [
    { segmentIndex: 0, segmentKey: 'segment-000', startTime: '2026-07-30T00:00:00', endTime: '2026-07-30T00:15:00', eventCount: 430, exposureCount: 0, affectedCount: 430, materializedCount: 430, unmaterializedCount: 0, recommendedAction: 'NONE', message: '该分段账本覆盖完整，无需修复' },
    { segmentIndex: 1, segmentKey: 'segment-001', startTime: '2026-07-30T00:15:00.000000001', endTime: '2026-07-30T00:30:00', eventCount: 521, exposureCount: 0, affectedCount: 521, materializedCount: 507, unmaterializedCount: 14, recommendedAction: 'REPAIR_MATERIALIZATION_SEGMENT', message: '该分段存在缺账本事实，可单独执行分段修复' },
    { segmentIndex: 2, segmentKey: 'segment-002', startTime: '2026-07-30T00:30:00.000000001', endTime: '2026-07-30T00:45:00', eventCount: 486, exposureCount: 0, affectedCount: 486, materializedCount: 478, unmaterializedCount: 8, recommendedAction: 'REPAIR_MATERIALIZATION_SEGMENT', message: '该分段存在缺账本事实，可单独执行分段修复' },
    { segmentIndex: 3, segmentKey: 'segment-003', startTime: '2026-07-30T00:45:00.000000001', endTime: '2026-07-30T01:00:00', eventCount: 405, exposureCount: 0, affectedCount: 405, materializedCount: 396, unmaterializedCount: 9, recommendedAction: 'REPAIR_MATERIALIZATION_SEGMENT', message: '该分段存在缺账本事实，可单独执行分段修复' },
  ],
};

const diagnosis = {
  experimentId: 'exp_checkout_001',
  summary: '保障前置组在支付转化率上稳定领先，对照组差异明显；退款申请率未超过护栏预算。',
  guardrailStatus: 'PASS',
  confidence: 0.86,
  riskFlags: ['样本比例正常', '退款护栏通过'],
  recommendedActions: [
    { title: '准备毕业审批', action: '保留 6 小时观察窗口后，将保障前置组推进到毕业审核。', executionMode: 'MANUAL' },
    { title: '同步客服口径', action: '确保 7 天无忧文案与客服知识库一致，避免承诺漂移。', executionMode: 'MANUAL' },
  ],
  evidence: { reportSnapshotVersion: 12, analysisReady: true, primaryMetricKey: 'PAY_CONVERSION_RATE' },
};

const graduation = {
  experimentId: 'exp_checkout_001',
  decision: 'GRADUATE',
  summary: '建议毕业保障前置组。主指标支付转化率提升 13.96%，置信度高，关键护栏没有明显回退。',
  confidence: 0.89,
  guardrailStatus: 'PASS',
  riskFlags: ['继续监控 variant_b 退款率', '毕业前绑定报告快照 v12'],
  evidence: { reportSnapshotVersion: 12, configVersion: 6, analysisReady: true },
};

const applications = [
  {
    appId: 'growth-shop',
    displayName: '交易增长应用',
    defaultOwner: 'growth-ops',
    owners: ['growth-ops', 'pay-owner', 'risk-owner'],
    experimentQuota: 24,
    quotaUsed: 9,
    quotaRemaining: 15,
    experimentCount: 9,
    runningExperimentCount: 4,
    approvalRequired: true,
    approvalOwners: ['risk-owner', 'growth-lead'],
    approvalRequiredCount: 2,
    approvalSlaHours: 24,
    approvalEscalationOwners: ['growth-director'],
    releaseWindowEnabled: true,
    releaseWindowDays: [1, 2, 3, 4, 5],
    releaseWindowStartTime: '10:00',
    releaseWindowEndTime: '18:00',
    releaseWindowTimezone: 'Asia/Shanghai',
    createdBy: 'platform',
    updatedBy: 'platform-ops',
  },
  {
    appId: 'search-app',
    displayName: '搜索体验应用',
    defaultOwner: 'search-team',
    owners: ['search-team', 'ranking-owner'],
    experimentQuota: 12,
    quotaUsed: 5,
    quotaRemaining: 7,
    experimentCount: 5,
    runningExperimentCount: 1,
    approvalRequired: false,
    approvalOwners: [],
    approvalRequiredCount: 1,
    releaseWindowEnabled: false,
    createdBy: 'platform',
    updatedBy: 'search-team',
  },
];

const approvalTasks = [
  {
    experimentId: 'exp_checkout_001',
    experimentName: '结账页信任提示实验',
    approvalType: 'CONFIG_DRAFT',
    approvalStatus: 'PENDING',
    appId: 'growth-shop',
    owner: 'growth-ops',
    approvalRequestedBy: 'frontend',
    approvalOwners: ['risk-owner', 'growth-lead'],
    approvalApprovedCount: 1,
    approvalRequiredCount: 2,
    approvalProgressText: '审批进度 1/2',
    approvalSlaHours: 24,
    approvalElapsedHours: 18,
    approvalSlaStatus: 'DUE_SOON',
    experimentStatus: 'RUNNING',
    draftVersion: 7,
    approvable: true,
  },
];

const approvalEscalations = [
  {
    escalationId: 'esc_20260730_001',
    experimentId: 'exp_checkout_001',
    experimentName: '结账页信任提示实验',
    escalationStatus: 'OPEN',
    notificationStatus: 'RETRY',
    appId: 'growth-shop',
    approvalType: 'CONFIG_DRAFT',
    draftVersion: 7,
    notificationAttemptCount: 2,
    notificationNextAttemptAt: '2026-07-30T11:00:00',
    escalationOwner: 'growth-director',
    notificationDeliveries: [
      { channelName: 'lark-growth', status: 'SENT', deliveredAt: '2026-07-30T10:10:00' },
      { channelName: 'risk-duty', status: 'RETRY', errorMessage: '429 throttled' },
    ],
  },
];

const reportSnapshots = [
  { snapshotVersion: 12, generatedAt: '2026-07-30T09:50:00', generatedBy: 'analysis-bot', summary: '支付转化率提升，护栏通过。' },
  { snapshotVersion: 11, generatedAt: '2026-07-29T22:10:00', generatedBy: 'analysis-bot', summary: '继续观察。' },
];

const configVersions = [
  { configVersion: 6, sourceType: 'DRAFT_PUBLISH', groupCount: 3, eventDefinitionCount: 3, metricDefinitionCount: 2, publishedBy: 'frontend', publishedAt: '2026-07-29T18:00:00', comment: '发布保障前置组文案' },
  { configVersion: 5, sourceType: 'ROLLBACK', groupCount: 2, eventDefinitionCount: 2, metricDefinitionCount: 1, publishedBy: 'ops', publishedAt: '2026-07-28T20:00:00', comment: '回滚异常按钮文案' },
];

const configDraft = {
  experimentId: 'exp_checkout_001',
  draftVersion: 7,
  baseConfigVersion: 6,
  currentConfigVersion: 6,
  draftExperiment: {
    ...mainExperiment,
    configVersion: 7,
    groups: {
      ...groups,
      variant_a: { ...groups.variant_a, config: { ...groups.variant_a.config, trustBadge: '7 天无忧保障' } },
    },
  },
  draftComment: '强化保障标签，保持按钮语义不变。',
  approvalStatus: 'PENDING',
  approvalOperator: 'risk-owner',
  approvalUpdatedAt: '2026-07-30T08:30:00',
  approvalComment: '等待第二位审批人确认。',
  updatedBy: 'frontend',
  updatedAt: '2026-07-30T08:20:00',
  stale: false,
};

const configDraftApprovals = [
  { approvalStatus: 'APPROVED', operator: 'risk-owner', comment: '风险可控', operatedAt: '2026-07-30T08:30:00' },
  { approvalStatus: 'PENDING', operator: 'growth-lead', comment: '', operatedAt: null },
];

const auditLogs = [
  { action: 'EXPERIMENT_CONFIG_DRAFT_SAVE', operator: 'frontend', comment: '保存配置草稿 v7', beforeStatus: 'RUNNING', afterStatus: 'RUNNING', createdAt: '2026-07-30T08:20:00' },
  { action: 'CONCLUSION_STATUS_UPDATE', operator: 'growth-lead', comment: '进入待审核', beforeStatus: 'RUNNING', afterStatus: 'READY_FOR_REVIEW', createdAt: '2026-07-30T10:15:00', reportSnapshotVersion: 12 },
];

const mabSummary = {
  experimentId: 'exp_checkout_001',
  totalTrials: 18611,
  totalRewards: 2956,
  leadingGroup: 'variant_a',
  converged: true,
  groups: [
    { groupId: 'control', trials: 5906, rewards: 842, conversionRate: 0.1425, probability: 0.21, alpha: 843, beta: 5065 },
    { groupId: 'variant_a', trials: 6578, rewards: 1068, conversionRate: 0.1624, probability: 0.55, alpha: 1069, beta: 5511 },
    { groupId: 'variant_b', trials: 6127, rewards: 942, conversionRate: 0.1538, probability: 0.24, alpha: 943, beta: 5186 },
  ],
};

const compare = {
  experimentId: 'exp_checkout_001',
  baselineGroupId: 'control',
  comparisons: {
    variant_a: { conversionRateChangePercent: 13.96, pValue: 0.012, significant: true },
    variant_b: { conversionRateChangePercent: 7.93, pValue: 0.084, significant: false },
  },
};

const timeline = {
  experimentId: 'exp_checkout_001',
  metricType: 'PAY_CONVERSION_RATE',
  granularity: 'DAY',
  dataPoints: [
    { bucketStart: '2026-07-24T00:00:00', values: { control: 0.139, variant_a: 0.151, variant_b: 0.146 } },
    { bucketStart: '2026-07-25T00:00:00', values: { control: 0.141, variant_a: 0.158, variant_b: 0.149 } },
    { bucketStart: '2026-07-26T00:00:00', values: { control: 0.144, variant_a: 0.162, variant_b: 0.154 } },
    { bucketStart: '2026-07-27T00:00:00', values: { control: 0.143, variant_a: 0.164, variant_b: 0.153 } },
    { bucketStart: '2026-07-28T00:00:00', values: { control: 0.142, variant_a: 0.161, variant_b: 0.155 } },
    { bucketStart: '2026-07-29T00:00:00', values: { control: 0.145, variant_a: 0.166, variant_b: 0.157 } },
  ],
};

const aiDesignResponse = {
  summary: '建议围绕结账页保障承诺进行三组实验，对主转化指标做显著性判断，并把退款申请率作为强护栏。',
  confidence: 0.82,
  guardrailStatus: 'PASS',
  riskFlags: ['避免过度承诺', '需绑定退款护栏'],
  experimentDraft: {
    ...mainExperiment,
    id: undefined,
    name: '结账页保障承诺实验',
    description: '比较不同保障承诺位置和 CTA 对支付转化率的影响。',
    appId: 'growth-shop',
    layerId: 'checkout-trust-copy',
    startTime: '2026-07-31T10:00:00',
    endTime: '2026-08-07T10:00:00',
    groups: Object.values(groups),
  },
};

const variantCandidatesResponse = {
  variantType: 'TEXT',
  variants: [
    '先保障，再放心支付',
    '支付前看清权益，售后无忧',
    '平台质检保障，确认支付更安心',
    '权益透明展示，减少下单犹豫',
  ],
  count: 4,
  aiProvider: 'tongyi',
  aiPrimaryModel: 'qwen3.7-max',
  aiModel: 'qwen3.7-max',
  aiApiMode: 'dashscope',
  aiFallbackUsed: false,
  aiFallbackModel: 'qwen3.7-max',
  aiAttemptedModels: ['qwen3.7-max'],
  aiModelStrategy: 'production-dashscope-qwen3.7-max-with-token-plan-preview-opt-in',
};

const refinedVariantCandidatesResponse = {
  ...variantCandidatesResponse,
  variants: [
    '方案名称：权益透明型｜策略方向：先解释保障再引导支付｜候选内容：质检与售后看得见，确认权益后再支付｜实验假设：透明说明可降低支付前疑虑｜实施建议：替换结账页标题和辅助说明｜风险提醒：不扩大实际保障范围',
    '方案名称：质检可信型｜策略方向：突出平台质检依据｜候选内容：平台质检完成，安心确认支付｜实验假设：明确质检状态可增强商品信任｜实施建议：保持价格和按钮位置不变｜风险提醒：避免使用绝对化质量承诺',
    '方案名称：售后克制型｜策略方向：用克制表达说明售后｜候选内容：售后范围已说明，确认后继续支付｜实验假设：减少促销感可提升信息可信度｜实施建议：仅调整保障文案与按钮文字｜风险提醒：持续监控退款申请率',
    '方案名称：决策清晰型｜策略方向：降低结账信息理解成本｜候选内容：权益确认无误，继续完成支付｜实验假设：减少干扰信息可缩短决策路径｜实施建议：收拢结账页辅助信息层级｜风险提醒：避免弱化必要风险提示',
  ],
};

function base(data, message = 'ok') {
  return { code: 200, message, data };
}

function matchExperiment(pathname) {
  const match = pathname.match(/^\/api\/experiments\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function responseFor(method, url) {
  const pathname = url.pathname;
  if (method === 'GET' && pathname === '/api/experiments') return base(experiments);
  if (method === 'GET' && pathname === '/api/applications') return base(applications);
  if (method === 'GET' && pathname === '/api/applications/growth-shop/dictionary') {
    return base({ appId: 'growth-shop', eventDefinitions, metricDefinitions, updatedBy: 'dictionary-sync' });
  }
  if (method === 'GET' && pathname === '/api/experiments/approval-tasks') return base(approvalTasks);
  if (method === 'GET' && pathname === '/api/experiments/approval-escalations/status') {
    return base({
      healthy: true,
      undeliveredCount: 2,
      retryCount: 1,
      deadCount: 1,
      deliveryUndeliveredCount: 1,
      dispatcherEnabled: true,
      dispatcherTargetCount: 2,
      dispatcherChannels: ['lark-growth', 'risk-duty'],
    });
  }
  if (method === 'GET' && pathname === '/api/experiments/approval-escalations') return base(approvalEscalations);

  const experimentId = matchExperiment(pathname);
  if (method === 'GET' && experimentId) return base(experiments.find(item => item.id === experimentId) || mainExperiment);
  if (method === 'GET' && pathname.endsWith('/audit-logs')) return base(auditLogs);
  if (method === 'GET' && pathname.endsWith('/config-versions')) return base(configVersions);
  if (method === 'GET' && pathname.endsWith('/config-draft/approvals')) return base(configDraftApprovals);
  if (method === 'GET' && pathname.endsWith('/config-draft')) return base(configDraft);

  if (method === 'GET' && pathname.endsWith('/statistics')) return base(statistics);
  if (method === 'GET' && pathname.endsWith('/report/snapshots')) return base(reportSnapshots);
  if (method === 'GET' && pathname.endsWith('/event-pipeline')) return base(eventPipelineStatus);
  if (method === 'GET' && pathname.endsWith('/events/replay/jobs')) return base(eventReplayJobs);
  if (method === 'GET' && pathname.endsWith('/ai-diagnosis')) return base(diagnosis);
  if (method === 'GET' && pathname.endsWith('/ai-graduation-decision')) return base(graduation);
  if (method === 'GET' && pathname.endsWith('/compare')) return base(compare);
  if (method === 'GET' && pathname.endsWith('/timeline')) return base(timeline);
  if (method === 'GET' && pathname.includes('/traffic/experiment/') && pathname.endsWith('/mab/summary')) return base(mabSummary);

  if (method === 'POST' && pathname.endsWith('/events/replay/plan')) return base(replayPlan);
  if (method === 'POST' && pathname.endsWith('/event-pipeline/dead/retry')) {
    return base({ operation: 'RETRY_DEAD', status: 'SUCCESS' }, '死信事件已重新投递');
  }
  if (method === 'POST' && pathname.endsWith('/events/replay')) {
    return base({ operation: 'REPLAY_DERIVED', status: 'RUNNING', replayJobId: 'replay_20260730_002' }, '事件管道派生数据重放任务已提交');
  }
  if (method === 'POST' && pathname === '/api/analysis/experiment/ai-design/v2') return base(aiDesignResponse);
  if (method === 'POST' && pathname === '/api/variants/generate') return base(variantCandidatesResponse, '候选生成成功');
  if (method === 'POST' && pathname === '/api/variants/refine') return base(refinedVariantCandidatesResponse, '方案修改成功');
  if (method === 'POST' && pathname === '/api/experiments/generator/demo') {
    return base({ qualifiedExperiment: mainExperiment, unqualifiedExperiment: experiments[2] }, '示例实验已生成');
  }
  return base({});
}

async function installMocks(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = JSON.stringify(responseFor(request.method(), url));
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body });
  });
}

async function stabilize(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; } html { scroll-behavior: auto !important; }`,
  });
}

async function assertPageHealthy(page, checkpoint) {
  const state = await page.evaluate(() => {
    const root = document.getElementById('root');
    const rootText = root?.innerText?.trim() || '';
    return {
      hasRoot: Boolean(root),
      rootChildCount: root?.childElementCount || 0,
      rootTextLength: rootText.length,
      errorBoundaryVisible: rootText.includes('当前页面未能正常显示'),
    };
  });
  const problems = [];
  if (!state.hasRoot) problems.push('missing #root element');
  if (state.rootChildCount === 0) problems.push('empty #root element');
  if (state.rootTextLength < 10) problems.push(`insufficient rendered text: ${state.rootTextLength}`);
  if (state.errorBoundaryVisible) problems.push('global error recovery page is visible');
  if (runtimeErrors.length > 0) problems.push(`${runtimeErrors.length} browser runtime error(s)`);
  if (problems.length > 0) {
    throw new Error(`UI runtime check failed at ${checkpoint}: ${problems.join('; ')}`);
  }
}

async function capture(page, fileName) {
  await assertPageHealthy(page, fileName);
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  await collectLayoutAudit(page, fileName);
  console.log(filePath);
}

async function captureWithLayout(page, fileName, layoutOptions) {
  await assertPageHealthy(page, fileName);
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  await collectLayoutAudit(page, fileName, layoutOptions);
  console.log(filePath);
}

async function collectLayoutAudit(page, fileName, options = {}) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0 > div');
    const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
    const scrollHeight = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0);
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      document: {
        scrollWidth,
        scrollHeight,
      },
      dialog: dialogRect
        ? {
            top: Math.round(dialogRect.top),
            bottom: Math.round(dialogRect.bottom),
            height: Math.round(dialogRect.height),
          }
        : null,
    };
  });
  const maxHorizontalOverflowPx = options.maxHorizontalOverflowPx ?? 2;
  const maxScrollRatio = options.maxScrollRatio ?? 1.2;
  const horizontalOverflowPx = Math.max(0, metrics.document.scrollWidth - metrics.viewport.width);
  const scrollRatio = Number((metrics.document.scrollHeight / metrics.viewport.height).toFixed(3));
  const checks = [
    {
      name: 'landscape viewport',
      status: metrics.viewport.width >= 1366 && metrics.viewport.height >= 768 ? 'PASS' : 'FAIL',
      actual: `${metrics.viewport.width}x${metrics.viewport.height}`,
      expected: 'at least 1366x768',
    },
    {
      name: 'horizontal overflow',
      status: horizontalOverflowPx <= maxHorizontalOverflowPx ? 'PASS' : 'FAIL',
      actual: horizontalOverflowPx,
      expected: `<=${maxHorizontalOverflowPx}px`,
    },
  ];

  if (options.requireViewportFit) {
    checks.push({
      name: 'desktop vertical fit',
      status: scrollRatio <= maxScrollRatio ? 'PASS' : 'FAIL',
      actual: scrollRatio,
      expected: `<=${maxScrollRatio}`,
    });
  }
  if (options.requireDialogWithinViewport) {
    const dialogFits = Boolean(metrics.dialog)
      && metrics.dialog.top >= 0
      && metrics.dialog.bottom <= metrics.viewport.height;
    checks.push({
      name: 'dialog within viewport',
      status: dialogFits ? 'PASS' : 'FAIL',
      actual: metrics.dialog || 'missing',
      expected: 'visible dialog fits in viewport',
    });
  }

  const failedChecks = checks.filter(check => check.status === 'FAIL');
  layoutAuditRecords.push({
    fileName,
    enforced: Boolean(options.requireViewportFit || options.requireDialogWithinViewport),
    status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
    viewport: metrics.viewport,
    document: metrics.document,
    horizontalOverflowPx,
    scrollRatio,
    checks,
  });
}

function writeLayoutAudit() {
  const failed = layoutAuditRecords.filter(record => record.enforced && record.status === 'FAIL');
  const runtimeStatus = runtimeErrors.length === 0 ? 'PASS' : 'FAIL';
  const summary = {
    summaryType: 'pisces-web-core-layout-audit',
    summaryVersion: 1,
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: failed.length === 0 && runtimeStatus === 'PASS' ? 'PASS' : 'FAIL',
    strict: layoutAuditStrict,
    screenshotDir: path.relative(repoRoot, outDir),
    viewportContract: 'desktop landscape core workspaces should avoid body-level vertical scrolling',
    enforcedCount: layoutAuditRecords.filter(record => record.enforced).length,
    screenshotCount: layoutAuditRecords.length,
    failedCount: failed.length,
    failedScreens: failed.map(record => record.fileName),
    runtimeStatus,
    runtimeErrorCount: runtimeErrors.length,
    runtimeErrors,
    records: layoutAuditRecords,
  };
  fs.writeFileSync(layoutAuditFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(layoutAuditFile);
  if (layoutAuditStrict && (failed.length > 0 || runtimeErrors.length > 0)) {
    throw new Error(
      `Core UI audit failed: ${failed.length} layout failure(s), ${runtimeErrors.length} runtime error(s)`,
    );
  }
}

async function gotoAndCapture(page, route, headingText, fileName, layoutOptions) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  if (headingText) {
    await page.getByText(headingText, { exact: false }).first().waitFor({ timeout: 5000 });
  }
  await stabilize(page);
  await captureWithLayout(page, fileName, layoutOptions);
}

(async () => {
  const launchOptions = {
    headless: true,
  };
  if (chromePath && fs.existsSync(chromePath)) {
    launchOptions.executablePath = chromePath;
  }
  const browser = await chromium.launch(launchOptions);
  try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.on('dialog', async dialog => dialog.dismiss());
  page.on('pageerror', error => {
    runtimeErrors.push({ type: 'pageerror', url: page.url(), message: error.message });
  });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    runtimeErrors.push({ type: 'console', url: page.url(), message: message.text() });
  });
  await installMocks(page);

  await gotoAndCapture(page, '/ai-center', '先处理值得关注的实验', '01-ai-center-priority-workspace.png', HORIZONTAL_WORKSPACE);
  await gotoAndCapture(page, '/experiments', '实验工作台', '02-experiment-workbench-list.png', HORIZONTAL_WORKSPACE);
  await page.locator('button[title="打开应用和负责人筛选"]').click();
  await page.getByRole('heading', { name: '高级筛选' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await captureWithLayout(page, '02b-experiment-workbench-filter-modal.png', HORIZONTAL_MODAL);
  await page.locator('button[title="关闭"]').first().click();
  await page.locator('button[title="查看配置摘要"]').first().click();
  await page.getByText('实验摘要').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await captureWithLayout(page, '02c-experiment-workbench-config-summary-modal.png', HORIZONTAL_MODAL);
  await page.locator('button[title="关闭"]').first().click();
  await gotoAndCapture(page, '/experiments/exp_checkout_001', '结账页信任提示实验', '03-experiment-detail-data-nav.png', HORIZONTAL_WORKSPACE);

  await page.getByRole('button', { name: /^配置管理/ }).click();
  await page.getByText('配置草稿与版本').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03b-experiment-config-version-governance.png');

  await page.getByRole('button', { name: /^结论/ }).click();
  await page.getByRole('heading', { name: '结论状态' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03c-experiment-conclusion.png');

  await page.getByRole('button', { name: /^审批/ }).click();
  await page.getByRole('heading', { name: '配置/启动审批' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03c2-experiment-approval.png');

  await page.getByRole('button', { name: /^实验结构/ }).click();
  await page.getByText('实验时间').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03d-experiment-runtime-structure.png');

  await page.getByRole('button', { name: /^统计/ }).click();
  await page.getByText('实时统计').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03e0-experiment-statistics-groups.png');
  await page.getByRole('button', { name: /^动态分流状态/ }).click();
  await page.getByText('多臂老虎机算法状态').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '03e-experiment-statistics-mab.png');

  await page.getByRole('button', { name: /^数据链路/ }).click();
  await page.getByText('数据链路状态', { exact: false }).first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /^重放任务/ }).click();
  await page.waitForTimeout(300);
  await capture(page, '04-data-pipeline-status-and-running-replay.png');
  await page.getByRole('button', { name: /^生成计划/ }).first().click();
  await page.locator('input[type="datetime-local"]').nth(0).fill('2026-07-30T00:00');
  await page.locator('input[type="datetime-local"]').nth(1).fill('2026-07-30T01:00');
  await page.getByPlaceholder('输入事件标识，使用逗号分隔').fill('PAY_SUCCESS, REFUND_REQUEST');
  await page.locator('button[title="生成只读重放计划"]').click();
  await page.getByText('计划结果').waitFor({ timeout: 5000 });
  await page.getByText('计划结果').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await capture(page, '05-data-pipeline-replay-plan.png');
  await page.getByRole('button', { name: /修复该段/ }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await capture(page, '05b-data-pipeline-segment-repair.png');

  await gotoAndCapture(page, '/experiments/exp_checkout_001/decision', '建议毕业保障前置组', '06-ai-decision-workspace.png', HORIZONTAL_WORKSPACE);
  await gotoAndCapture(page, '/applications', '应用管理', '07-application-space-governance.png', HORIZONTAL_WORKSPACE);

  await page.goto(`${baseUrl}/ai-design`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '示例实验' }).click();
  await page.getByRole('heading', { name: '快速生成示例实验' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await captureWithLayout(page, '08e-ai-design-demo-modal.png', HORIZONTAL_MODAL);
  await page.locator('button[title="关闭示例实验"]').click();
  await stabilize(page);
  await captureWithLayout(page, '08-ai-design-structured-draft.png', HORIZONTAL_WORKSPACE);
  await page.getByRole('button', { name: /^基础/ }).click();
  await page.locator('input[placeholder="例如：二手手机标题实验"]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await captureWithLayout(page, '08b-ai-design-basic-tab.png', HORIZONTAL_WORKSPACE);
  await page.getByRole('button', { name: /^事件/ }).click();
  await page.getByRole('heading', { name: '选择实验事件' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '08c-ai-design-event-tab.png');
  await page.getByRole('button', { name: /^分组/ }).click();
  await page.getByRole('heading', { name: '实验组配置' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, '08d-ai-design-group-tab.png');

  await page.goto(`${baseUrl}/variants-lab`, { waitUntil: 'domcontentloaded' });
  await page.getByText('生成完整实验方案').first().waitFor({ timeout: 5000 });
  await page.getByPlaceholder('说明希望改善的用户行为或业务结果').fill('为结账页生成更能解释保障权益的标题和按钮文案');
  await page.getByPlaceholder('描述用户特征、需求和当前顾虑').fill('价格敏感但重视售后保障的用户');
  await page.getByRole('button', { name: '生成完整方案' }).click();
  await page.getByText('qwen3.7-max', { exact: true }).waitFor({ timeout: 5000 });
  await stabilize(page);
  await captureWithLayout(page, '09-variant-lab-tongyi-model-evidence.png', HORIZONTAL_WORKSPACE);
  await page.getByRole('button', { name: /对话修改/ }).click();
  await page.getByRole('heading', { name: '对话修改方案' }).waitFor({ timeout: 5000 });
  await stabilize(page);
  await captureWithLayout(page, '09b-variant-lab-refinement-drawer.png', HORIZONTAL_MODAL);
  await page.getByRole('button', { name: '语气更克制' }).click();
  await page.getByRole('button', { name: '发送修改要求' }).click();
  await page.getByText(/已按本轮要求更新为第 2 版/).waitFor({ timeout: 5000 });
  await stabilize(page);
  await captureWithLayout(page, '09c-variant-lab-refinement-conversation.png', HORIZONTAL_MODAL);
  await page.getByRole('button', { name: '恢复上一版' }).click();
  await page.getByText(/已恢复第 1 版方案/).waitFor({ timeout: 5000 });
  await page.getByText(/当前第 1 版/).waitFor({ timeout: 5000 });

  writeLayoutAudit();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
