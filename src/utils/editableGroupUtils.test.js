import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEditableGroupSummary,
  buildExperimentGroupTrafficAllocation,
  buildNextExperimentGroup,
  getEditableGroupPanelKey,
  getOrderedGroupEntries,
  rebalanceExperimentGroupTraffic
} from './editableGroupUtils.js'

test('buildEditableGroupSummary prefers schema field count for editable groups', () => {
  const summary = buildEditableGroupSummary({
    id: 'variant_a',
    name: '实验组 A',
    trafficRatio: 0.35,
    config: { titleText: '新版标题', extraField: '额外字段' }
  }, [
    { key: 'titleText' },
    { key: 'highlightTags' },
    { key: 'featureTone' }
  ])

  assert.deepEqual(summary, {
    groupId: 'variant_a',
    groupName: '实验组 A',
    trafficPercent: '35%',
    configCount: 3
  })
})

test('buildEditableGroupSummary falls back to config count without schema', () => {
  const summary = buildEditableGroupSummary({
    id: 'control',
    trafficRatio: 0.5,
    config: { titleText: '原版标题', featureTone: '稳重' }
  })

  assert.equal(summary.groupName, 'control')
  assert.equal(summary.trafficPercent, '50%')
  assert.equal(summary.configCount, 2)
})

test('getEditableGroupPanelKey falls back to index when group id is empty', () => {
  assert.equal(getEditableGroupPanelKey({ id: 'control' }, 0), 'control')
  assert.equal(getEditableGroupPanelKey({}, 2), 'group-2')
})

test('getOrderedGroupEntries keeps control first and variants stable', () => {
  const entries = getOrderedGroupEntries({
    variant_b: { id: 'variant_b' },
    control: { id: 'control' },
    variant_a: { id: 'variant_a' }
  })

  assert.deepEqual(entries.map(([groupId]) => groupId), ['control', 'variant_a', 'variant_b'])
})

test('buildNextExperimentGroup clones baseline config and skips used ids', () => {
  const group = buildNextExperimentGroup([
    { id: 'control', config: { headline: 'baseline' } },
    { id: 'variant_a', config: { headline: 'variant' } }
  ])

  assert.equal(group.id, 'variant_b')
  assert.equal(group.name, '实验组B')
  assert.deepEqual(group.config, { headline: 'baseline' })
})

test('rebalanceExperimentGroupTraffic produces an exact total allocation', () => {
  const groups = rebalanceExperimentGroupTraffic([
    { id: 'control' },
    { id: 'variant_a' },
    { id: 'variant_b' }
  ])

  assert.equal(groups.reduce((total, group) => total + group.trafficRatio, 0), 1)
  assert.deepEqual(buildExperimentGroupTrafficAllocation(groups), [
    { group: 'control', ratio: 0.3333 },
    { group: 'variant_a', ratio: 0.3333 },
    { group: 'variant_b', ratio: 0.3334 }
  ])
})
