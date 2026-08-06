import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIntegrationHealthSummary,
  getIntegrationCheckStatusMeta,
  getIntegrationStatusMeta,
  getIntegrationTargetLabel,
} from './applicationIntegrationHealth.js'

test('integration health summary separates every Chinese-facing state', () => {
  const summary = buildIntegrationHealthSummary({
    checks: [
      { status: 'PASS' },
      { status: 'PASS' },
      { status: 'WAITING' },
      { status: 'WARNING' },
      { status: 'BLOCKED' },
    ],
  })

  assert.deepEqual(summary, {
    total: 5,
    passed: 2,
    waiting: 1,
    warning: 1,
    blocked: 1,
  })
  assert.equal(getIntegrationStatusMeta('READY').label, '接入完整')
  assert.equal(getIntegrationCheckStatusMeta('BLOCKED').label, '已阻断')
  assert.equal(getIntegrationTargetLabel('dictionary'), '维护业务字典')
  assert.deepEqual(buildIntegrationHealthSummary(null), {
    total: 0,
    passed: 0,
    waiting: 0,
    warning: 0,
    blocked: 0,
  })
})
