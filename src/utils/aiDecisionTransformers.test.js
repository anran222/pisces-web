import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEmptyEventDefinition,
  buildEmptyGroupConfigField,
  buildEmptyMetricDefinition,
  buildDemoExperimentCards,
  buildDefaultExperimentCreatePayload,
  buildDecisionWorkspaceModel,
  buildExperimentDraftFromResponse,
  buildExperimentCreatePayload,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_OPTIONS,
  EVENT_KEY_PATTERN,
  GROUP_CONFIG_VALUE_TYPES,
  GROUP_CONFIG_VALUE_TYPE_OPTIONS,
  METRIC_AGGREGATION_TYPES,
  METRIC_AGGREGATION_TYPE_OPTIONS,
  METRIC_DENOMINATOR_TYPES,
  METRIC_DENOMINATOR_TYPE_OPTIONS,
  buildVariantCandidatePayload,
  normalizeVariantCandidates,
  normalizeVariantGenerationModelEvidence
} from './aiDecisionTransformers.js'

test('buildDecisionWorkspaceModel summarizes diagnosis and graduation signals', () => {
  const model = buildDecisionWorkspaceModel({
    statistics: {
      summary: {
        totalVisitors: 1280,
        bestPerformingGroup: 'variant_b'
      },
      dataQualityCheck: {
        analysisReady: true,
        srmDetected: false,
        blockingIssues: ['样本量不足']
      }
    },
    diagnosis: {
      summary: '建议先修复样本量问题',
      confidence: 0.86,
      guardrailStatus: 'BLOCKED',
      riskFlags: ['SAMPLE_SIZE'],
      recommendedActions: [
        {
          title: '补充样本',
          action: '继续运行三天',
          executionMode: 'MANUAL_ONLY'
        }
      ]
    },
    graduation: {
      summary: '当前不建议毕业',
      confidence: 0.78,
      decision: 'CONTINUE',
      guardrailStatus: 'BLOCKED',
      riskFlags: ['SAMPLE_SIZE']
    }
  })

  assert.equal(model.hero.decision, 'CONTINUE')
  assert.equal(model.hero.guardrailStatus, 'BLOCKED')
  assert.equal(model.hero.bestGroup, 'variant_b')
  assert.equal(model.hero.totalVisitors, 1280)
  assert.deepEqual(model.riskFlags, ['SAMPLE_SIZE'])
  assert.equal(model.actions[0].executionMode, 'MANUAL_ONLY')
  assert.equal(model.blockingIssues[0], '样本量不足')
})

test('buildDecisionWorkspaceModel normalizes enum confidence into numeric score', () => {
  const model = buildDecisionWorkspaceModel({
    diagnosis: {
      summary: '建议继续观察',
      confidence: 'HIGH',
      guardrailStatus: 'PASS',
      riskFlags: []
    },
    graduation: {
      summary: '当前可以继续推进',
      confidence: 'MEDIUM',
      decision: 'CONTINUE',
      guardrailStatus: 'PASS',
      riskFlags: []
    }
  })

  assert.equal(model.hero.confidence, 0.6)
})

test('buildDecisionWorkspaceModel exposes the sample-size gate before AI evidence arrives', () => {
  const model = buildDecisionWorkspaceModel({
    statistics: {
      summary: {
        totalVisitors: 1600,
        bestPerformingGroup: 'trust_value'
      },
      dataQualityCheck: {
        analysisReady: false,
        blockingIssues: ['当前每组样本量未达到最小要求']
      }
    }
  })

  assert.equal(model.hero.decision, 'CONTINUE')
  assert.equal(model.hero.guardrailStatus, 'BLOCKED')
  assert.equal(model.hero.summary, '分析尚未就绪，继续运行并累计样本。')
  assert.equal(model.hero.totalVisitors, 1600)
  assert.equal(model.hero.confidence, null)
  assert.deepEqual(model.riskFlags, ['当前每组样本量未达到最小要求'])
})

test('buildDecisionWorkspaceModel exposes passing quality checks before AI evidence arrives', () => {
  const model = buildDecisionWorkspaceModel({
    statistics: {
      summary: {
        breachedGuardrails: []
      },
      dataQualityCheck: {
        analysisReady: true,
        blockingIssues: []
      }
    }
  })

  assert.equal(model.hero.guardrailStatus, 'PASS')
  assert.deepEqual(model.riskFlags, [])
})

test('buildExperimentCreatePayload maps ai draft into backend create request shape', () => {
  const payload = buildExperimentCreatePayload({
    experimentDraft: {
      name: 'AI 生成实验',
      description: '实验描述',
      startTime: '2026-03-20T10:00:00',
      endTime: '2026-03-27T10:00:00',
      groups: [
        {
          id: 'control',
          name: '对照组',
          trafficRatio: 0.5,
          config: { titleText: '原版标题' }
        },
        {
          id: 'variant_a',
          name: '变体A',
          trafficRatio: 0.5,
          config: { titleText: 'AI 标题' }
        }
      ],
      traffic: {
        totalTraffic: 1,
        strategy: 'HASH'
      }
    }
  })

  assert.equal(payload.name, 'AI 生成实验')
  assert.equal(payload.groups.length, 2)
  assert.deepEqual(payload.traffic.allocation, [
    { group: 'control', ratio: 0.5 },
    { group: 'variant_a', ratio: 0.5 }
  ])
})

test('buildDefaultExperimentCreatePayload creates editable manual draft', () => {
  const payload = buildDefaultExperimentCreatePayload(new Date('2026-03-21T10:30:00'))

  assert.equal(payload.name, '')
  assert.equal(payload.description, '')
  assert.equal(payload.layerId, '')
  assert.equal(payload.startTime, '2026-03-21T10:30')
  assert.equal(payload.endTime, '2026-03-28T10:30')
  assert.deepEqual(payload.groupConfigSchema, [])
  assert.equal(payload.groups.length, 2)
  assert.deepEqual(payload.traffic.allocation, [
    { group: 'control', ratio: 0.5 },
    { group: 'variant_a', ratio: 0.5 }
  ])
})

test('buildExperimentDraftFromResponse maps experiment response into editable draft', () => {
  const payload = buildExperimentDraftFromResponse({
    name: '二手手机实验',
    description: '详情页编辑草稿',
    layerId: 'detail-page',
    startTime: '2026-03-21T10:30:00',
    endTime: '2026-03-28T10:30:00',
    eventDefinitions: [
      { key: 'PRODUCT_VIEW', label: '商品查看', category: 'FUNNEL', primary: true }
    ],
    metricDefinitions: [
      { key: 'PAYMENT_RATE', name: '支付率', aggregationType: 'RATE', numeratorEventType: 'PAY_SUCCESS', denominatorType: 'EVENT_COUNT', denominatorEventType: 'PRODUCT_VIEW', primaryMetric: true, guardrailMetric: false }
    ],
    groupConfigSchema: [
      { key: 'mainTitle', label: '主标题', valueType: 'STRING', required: true, defaultValue: '默认标题' }
    ],
    groups: {
      control: {
        id: 'control',
        name: '对照组',
        trafficRatio: 0.5,
        config: { mainTitle: '原版标题' }
      },
      variant_a: {
        id: 'variant_a',
        name: '实验组A',
        trafficRatio: 0.5,
        config: { mainTitle: '新版标题' }
      }
    },
    traffic: {
      strategy: 'HASH',
      totalTraffic: 1,
      allocation: [
        { group: 'control', ratio: 0.5 },
        { group: 'variant_a', ratio: 0.5 }
      ]
    }
  })

  assert.equal(payload.name, '二手手机实验')
  assert.equal(payload.layerId, 'detail-page')
  assert.equal(payload.startTime, '2026-03-21T10:30')
  assert.equal(payload.eventDefinitions[0].key, 'PRODUCT_VIEW')
  assert.equal(payload.metricDefinitions[0].key, 'PAYMENT_RATE')
  assert.equal(payload.groupConfigSchema[0].key, 'mainTitle')
  assert.equal(payload.groups.length, 2)
  assert.equal(payload.groups[0].config.mainTitle, '原版标题')
})

test('buildEmptyGroupConfigField creates editable schema draft', () => {
  assert.deepEqual(buildEmptyGroupConfigField(), {
    key: '',
    label: '',
    valueType: 'STRING',
    required: false,
    description: '',
    defaultValue: ''
  })
  assert.deepEqual(GROUP_CONFIG_VALUE_TYPES, ['STRING', 'INTEGER', 'BOOLEAN', 'OBJECT', 'JSON'])
})

test('buildEmptyEventDefinition and metricDefinition create editable drafts', () => {
  assert.deepEqual(buildEmptyEventDefinition(), {
    key: '',
    label: '',
    description: '',
    category: 'BUSINESS',
    primary: false
  })
  assert.deepEqual(buildEmptyMetricDefinition(), {
    key: '',
    name: '',
    description: '',
    aggregationType: 'RATE',
    numeratorEventType: '',
    denominatorType: 'EVENT_COUNT',
    denominatorEventType: '',
    primaryMetric: false,
    guardrailMetric: false
  })
  assert.ok(EVENT_KEY_PATTERN.test('PAY_SUCCESS'))
  assert.deepEqual(EVENT_CATEGORIES, ['FUNNEL', 'ENGAGEMENT', 'BUSINESS', 'GUARDRAIL', 'CUSTOM'])
  assert.deepEqual(METRIC_AGGREGATION_TYPES, ['RATE', 'COUNT'])
  assert.deepEqual(METRIC_DENOMINATOR_TYPES, ['EVENT_COUNT', 'VISITOR_COUNT', 'ASSIGNMENT_COUNT', 'EXPOSURE_COUNT'])
})

test('option labels should be localized for create experiment form', () => {
  assert.deepEqual(EVENT_CATEGORY_OPTIONS, [
    { value: 'FUNNEL', label: '漏斗事件' },
    { value: 'ENGAGEMENT', label: '互动事件' },
    { value: 'BUSINESS', label: '业务事件' },
    { value: 'GUARDRAIL', label: '护栏事件' },
    { value: 'CUSTOM', label: '自定义事件' }
  ])
  assert.deepEqual(METRIC_AGGREGATION_TYPE_OPTIONS, [
    { value: 'RATE', label: '比率指标' },
    { value: 'COUNT', label: '数量指标' }
  ])
  assert.deepEqual(METRIC_DENOMINATOR_TYPE_OPTIONS, [
    { value: 'EVENT_COUNT', label: '按事件次数计算' },
    { value: 'VISITOR_COUNT', label: '按访客人数计算' },
    { value: 'ASSIGNMENT_COUNT', label: '按分流人数计算' },
    { value: 'EXPOSURE_COUNT', label: '按曝光人数计算' }
  ])
  assert.deepEqual(GROUP_CONFIG_VALUE_TYPE_OPTIONS, [
    { value: 'STRING', label: '文本' },
    { value: 'INTEGER', label: '整数' },
    { value: 'BOOLEAN', label: '布尔值' },
    { value: 'OBJECT', label: '对象' },
    { value: 'JSON', label: 'JSON' }
  ])
})

test('buildExperimentCreatePayload normalizes schema and group config values', () => {
  const payload = buildExperimentCreatePayload({
    experimentDraft: {
      name: '文案实验',
      description: '配置字段测试',
      startTime: '2026-03-21T10:00:00',
      endTime: '2026-03-28T10:00:00',
      eventDefinitions: [
        {
          key: 'product_view',
          label: '商品查看',
          category: 'FUNNEL',
          primary: true
        },
        {
          key: 'pay_success',
          label: '支付成功',
          category: 'BUSINESS',
          primary: false
        }
      ],
      metricDefinitions: [
        {
          key: 'pay_rate',
          name: '支付率',
          aggregationType: 'RATE',
          numeratorEventType: 'pay_success',
          denominatorType: 'EVENT_COUNT',
          denominatorEventType: 'product_view',
          primaryMetric: true,
          guardrailMetric: false
        }
      ],
      groupConfigSchema: [
        {
          key: 'mainTitle',
          label: '主标题',
          valueType: 'STRING',
          required: true,
          description: '首页主标题',
          defaultValue: '默认标题'
        },
        {
          key: 'badgeCount',
          label: '角标数量',
          valueType: 'INTEGER',
          required: false,
          description: '',
          defaultValue: '2'
        },
        {
          key: 'showQualityBadge',
          label: '展示质检标识',
          valueType: 'BOOLEAN',
          required: false,
          description: '',
          defaultValue: 'true'
        },
        {
          key: 'ctaMeta',
          label: '按钮信息',
          valueType: 'OBJECT',
          required: false,
          description: '',
          defaultValue: '{"style":"primary"}'
        },
        {
          key: 'highlightTags',
          label: '标签列表',
          valueType: 'JSON',
          required: false,
          description: '',
          defaultValue: '["官方质检"]'
        }
      ],
      groups: [
        {
          id: 'control',
          name: '对照组',
          trafficRatio: 0.5,
          config: {
            mainTitle: '原版标题',
            badgeCount: '3',
            showQualityBadge: 'false',
            ctaMeta: '{"style":"muted"}',
            highlightTags: '["平台验机"]'
          }
        }
      ],
      traffic: {
        totalTraffic: 1,
        strategy: 'HASH'
      }
    }
  })

  assert.equal(payload.eventDefinitions[0].key, 'PRODUCT_VIEW')
  assert.equal(payload.metricDefinitions[0].key, 'PAY_RATE')
  assert.equal(payload.metricDefinitions[0].numeratorEventType, 'PAY_SUCCESS')
  assert.equal(payload.metricDefinitions[0].denominatorEventType, 'PRODUCT_VIEW')
  assert.equal(payload.groupConfigSchema[1].defaultValue, 2)
  assert.equal(payload.groupConfigSchema[2].defaultValue, true)
  assert.deepEqual(payload.groupConfigSchema[3].defaultValue, { style: 'primary' })
  assert.deepEqual(payload.groupConfigSchema[4].defaultValue, ['官方质检'])
  assert.equal(payload.groups[0].config.badgeCount, 3)
  assert.equal(payload.groups[0].config.showQualityBadge, false)
  assert.deepEqual(payload.groups[0].config.ctaMeta, { style: 'muted' })
  assert.deepEqual(payload.groups[0].config.highlightTags, ['平台验机'])
})

test('buildVariantCandidatePayload trims empty constraints and adds context', () => {
  const payload = buildVariantCandidatePayload({
    variantType: 'TEXT',
    goal: '提升支付转化',
    audience: '价格敏感用户',
    count: 3,
    constraintsText: '不夸张\n\n保留品牌感知',
    sourceContextText: '当前文案偏保守'
  })

  assert.deepEqual(payload, {
    variantType: 'TEXT',
    goal: '提升支付转化',
    audience: '价格敏感用户',
    count: 3,
    constraints: ['不夸张', '保留品牌感知'],
    sourceContext: {
      brief: '当前文案偏保守'
    }
  })
})

test('buildVariantCandidatePayload adds real reference image only when provided', () => {
  const payload = buildVariantCandidatePayload({
    variantType: 'IMAGE',
    goal: '基于已有主图生成更适合售卖页的版本',
    audience: '价格敏感用户',
    count: 2,
    constraintsText: '保留主体\n不要过度修饰',
    sourceContextText: '当前主图背景较乱',
    referenceImageInput: 'data:image/png;base64,ZmFrZS1pbWFnZQ=='
  })

  assert.deepEqual(payload, {
    variantType: 'IMAGE',
    goal: '基于已有主图生成更适合售卖页的版本',
    audience: '价格敏感用户',
    count: 2,
    constraints: ['保留主体', '不要过度修饰'],
    sourceContext: {
      brief: '当前主图背景较乱',
      imageBase64: 'data:image/png;base64,ZmFrZS1pbWFnZQ=='
    }
  })
})

test('normalizeVariantCandidates keeps string candidates renderable', () => {
  const candidates = normalizeVariantCandidates({
    variants: ['放心下单', '价格透明']
  }, 'TEXT')

  assert.deepEqual(candidates, [
    { id: 'candidate-0', text: '放心下单', imageUrl: '' },
    { id: 'candidate-1', text: '价格透明', imageUrl: '' }
  ])
})

test('normalizeVariantCandidates maps object candidates into text', () => {
  const candidates = normalizeVariantCandidates({
    variants: [
      {
        variantId: 'v1',
        title: '放心下单',
        content: '质检保障看得见',
        rationale: '降低支付前疑虑'
      }
    ]
  }, 'TEXT')

  assert.deepEqual(candidates, [
    {
      id: 'v1',
      text: '放心下单\n质检保障看得见\n降低支付前疑虑',
      imageUrl: ''
    }
  ])
})

test('normalizeVariantCandidates maps image candidate objects', () => {
  const candidates = normalizeVariantCandidates({
    variants: [
      {
        id: 'image-a',
        imageUrl: 'https://example.com/candidate.png',
        title: '保障主图'
      }
    ]
  }, 'IMAGE')

  assert.deepEqual(candidates, [
    {
      id: 'image-a',
      text: '保障主图',
      imageUrl: 'https://example.com/candidate.png'
    }
  ])
})

test('normalizeVariantGenerationModelEvidence maps production TongYi model metadata', () => {
  const evidence = normalizeVariantGenerationModelEvidence({
    aiProvider: 'tongyi',
    aiPrimaryModel: 'qwen3.7-max',
    aiModel: 'qwen3.7-max',
    aiApiMode: 'dashscope',
    aiFallbackUsed: false,
    aiFallbackModel: 'qwen3.7-max',
    aiAttemptedModels: ['qwen3.7-max'],
    aiModelStrategy: 'production-dashscope-qwen3.7-max-with-token-plan-preview-opt-in'
  })

  assert.deepEqual(evidence, {
    provider: 'tongyi',
    selectedModel: 'qwen3.7-max',
    selectedApiMode: 'dashscope',
    primaryModel: 'qwen3.7-max',
    fallbackModel: 'qwen3.7-max',
    fallbackUsed: false,
    attemptedModels: ['qwen3.7-max'],
    attemptedModelLabel: 'qwen3.7-max',
    modelStrategy: 'production-dashscope-qwen3.7-max-with-token-plan-preview-opt-in',
    statusLabel: '生产模型'
  })
})

test('normalizeVariantGenerationModelEvidence maps fallback metadata compactly', () => {
  const evidence = normalizeVariantGenerationModelEvidence({
    aiModel: 'qwen3.7-max',
    aiApiMode: 'dashscope',
    aiFallbackUsed: true,
    aiAttemptedModels: ['qwen3.8-max-preview', 'qwen3.7-max']
  })

  assert.equal(evidence.provider, 'tongyi')
  assert.equal(evidence.selectedModel, 'qwen3.7-max')
  assert.equal(evidence.selectedApiMode, 'dashscope')
  assert.equal(evidence.fallbackUsed, true)
  assert.equal(evidence.statusLabel, '已回退')
  assert.equal(evidence.attemptedModelLabel, 'qwen3.8-max-preview -> qwen3.7-max')
})

test('buildDemoExperimentCards maps qualified and unqualified demo experiments into user-facing cards', () => {
  const cards = buildDemoExperimentCards({
    qualifiedExperiment: {
      experimentId: 'exp_pass',
      experimentName: '二手手机售卖页优化实验 [USED_PHONE_DEMO_PASS]',
      canGraduate: true,
      canStop: false,
      aiDecision: 'GRADUATE',
      aiGuardrailStatus: 'PASS',
      aiSummary: 'AI判断当前实验可以毕业',
      primaryMetricKey: 'PAYMENT_RATE',
      groupCount: 4,
      schemaFieldCount: 6,
      baselineConversionRate: 0.12,
      winningConversionRate: 0.16
    },
    unqualifiedExperiment: {
      experimentId: 'exp_fail',
      experimentName: '二手手机售卖页优化实验 [USED_PHONE_DEMO_FAIL]',
      canGraduate: false,
      canStop: false,
      aiDecision: 'CONTINUE',
      aiGuardrailStatus: 'PASS',
      aiSummary: 'AI判断当前实验暂不毕业',
      primaryMetricKey: 'PAYMENT_RATE',
      groupCount: 4,
      schemaFieldCount: 6,
      baselineConversionRate: 0.12,
      winningConversionRate: 0.121
    }
  })

  assert.deepEqual(cards, [
    {
      key: 'qualified',
      tone: 'success',
      title: '达标示例',
      experimentId: 'exp_pass',
      experimentName: '二手手机售卖页优化实验 [USED_PHONE_DEMO_PASS]',
      summary: 'AI判断当前实验可以毕业',
      canGraduate: true,
      canStop: false,
      aiDecision: 'GRADUATE',
      aiGuardrailStatus: 'PASS',
      primaryMetricKey: 'PAYMENT_RATE',
      groupCount: 4,
      schemaFieldCount: 6,
      baselineConversionRate: 0.12,
      winningConversionRate: 0.16
    },
    {
      key: 'unqualified',
      tone: 'warning',
      title: '未达标示例',
      experimentId: 'exp_fail',
      experimentName: '二手手机售卖页优化实验 [USED_PHONE_DEMO_FAIL]',
      summary: 'AI判断当前实验暂不毕业',
      canGraduate: false,
      canStop: false,
      aiDecision: 'CONTINUE',
      aiGuardrailStatus: 'PASS',
      primaryMetricKey: 'PAYMENT_RATE',
      groupCount: 4,
      schemaFieldCount: 6,
      baselineConversionRate: 0.12,
      winningConversionRate: 0.121
    }
  ])
})
