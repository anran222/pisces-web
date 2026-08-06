import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPreflightFingerprint,
  buildPreflightGroups,
  getPreflightStatusMeta,
  shouldConfirmPreflightWarnings,
} from './experimentPreflight.js'

test('preflight utilities group checks and identify warning confirmation', () => {
  const preflight = {
    readyToCreate: true,
    warningCount: 1,
    checks: [
      { section: '基础信息', status: 'PASS' },
      { section: '基础信息', status: 'WARNING' },
      { section: '指标', status: 'PASS' },
    ],
  }

  assert.deepEqual(buildPreflightGroups(preflight).map(group => [group.section, group.checks.length]), [
    ['基础信息', 2],
    ['指标', 1],
  ])
  assert.equal(shouldConfirmPreflightWarnings(preflight), true)
  assert.equal(getPreflightStatusMeta('WARNING').label, '建议确认')
  assert.equal(buildPreflightFingerprint({ appId: 'shop-app' }), '{"appId":"shop-app"}')
  assert.deepEqual(buildPreflightGroups(null), [])
})
