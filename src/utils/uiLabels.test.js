import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatChineseDateTime,
  getApprovalStatusLabel,
  getDecisionLabel,
  getGuardrailStatusLabel,
  getRiskFlagLabel,
  getTrafficStrategyLabel,
  getValueTypeLabel,
  localizeSystemText
} from './uiLabels.js'

test('enum labels are displayed in Chinese', () => {
  assert.equal(getTrafficStrategyLabel('HASH'), '哈希分流')
  assert.equal(getTrafficStrategyLabel('THOMPSON_SAMPLING'), '汤普森采样')
  assert.equal(getApprovalStatusLabel('PENDING'), '待审批')
  assert.equal(getGuardrailStatusLabel('BLOCKED'), '已阻断')
  assert.equal(getDecisionLabel('CONTINUE'), '继续观察')
  assert.equal(getValueTypeLabel('JSON'), '结构化数据')
})

test('AI and backend explanations replace known English protocol values', () => {
  assert.equal(
    localizeSystemText('variant_a exposure=0, sampleSizeReached=false'),
    '实验组一 曝光=0, 样本量达标状态=否'
  )
  assert.equal(localizeSystemText('实验组B NO_DATA'), '实验组二 暂无数据')
  assert.equal(getRiskFlagLabel('SAMPLE_SIZE_NOT_REACHED'), '样本量尚未达标')
  assert.equal(localizeSystemText('startTime/endTime replay Redis'), '开始时间/结束时间 重放 实时缓存')
})

test('date time values use Chinese 24 hour formatting', () => {
  const formatted = formatChineseDateTime('2026-08-05T09:30:00')
  assert.match(formatted, /2026/)
  assert.match(formatted, /09:30:00/)
})
