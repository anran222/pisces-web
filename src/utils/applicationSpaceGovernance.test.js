import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildApplicationSpaceDraft,
  buildApplicationSpacePayload,
  parseApprovalOwners,
  parseApprovalRequiredCount,
  parseApprovalSlaHours,
  parseExperimentQuota,
  parseReleaseWindowDays,
  parseReleaseWindowTime,
  summarizeApplicationSpaces,
} from './applicationSpaceGovernance.js'

test('buildApplicationSpaceDraft maps governance fields into editable values', () => {
  const draft = buildApplicationSpaceDraft({
    appId: 'shop-app',
    displayName: '交易应用',
    defaultOwner: 'pm-a',
    experimentQuota: 20,
    approvalRequired: true,
    approvalOwners: ['reviewer-a', 'reviewer-b'],
    approvalRequiredCount: 2,
    approvalSlaHours: 8,
    approvalEscalationOwners: ['ops-a', 'lead-a'],
    releaseWindowEnabled: true,
    releaseWindowTimezone: 'Asia/Shanghai',
    releaseWindowDays: [1, 3, 5],
    releaseWindowStartTime: '10:00',
    releaseWindowEndTime: '16:30',
  })

  assert.deepEqual(draft, {
    appId: 'shop-app',
    displayName: '交易应用',
    defaultOwner: 'pm-a',
    experimentQuota: 20,
    approvalRequired: true,
    approvalOwners: 'reviewer-a, reviewer-b',
    approvalRequiredCount: 2,
    approvalSlaHours: 8,
    approvalEscalationOwners: 'ops-a, lead-a',
    releaseWindowEnabled: true,
    releaseWindowTimezone: 'Asia/Shanghai',
    releaseWindowDays: '1, 3, 5',
    releaseWindowStartTime: '10:00',
    releaseWindowEndTime: '16:30',
  })
})

test('buildApplicationSpacePayload trims text and normalizes quota and approval owners', () => {
  const payload = buildApplicationSpacePayload({
    displayName: ' 交易应用 ',
    defaultOwner: ' pm-a ',
    experimentQuota: '',
    approvalRequired: true,
    approvalOwners: ' reviewer-a, pm-a, reviewer-a ',
    approvalRequiredCount: '2',
    approvalSlaHours: '8',
    approvalEscalationOwners: ' ops-a, lead-a, ops-a ',
    releaseWindowEnabled: true,
    releaseWindowTimezone: ' Asia/Shanghai ',
    releaseWindowDays: '1, 2, 2, 5',
    releaseWindowStartTime: '09:30',
    releaseWindowEndTime: '17:00',
  })

  assert.deepEqual(payload, {
    displayName: '交易应用',
    defaultOwner: 'pm-a',
    experimentQuota: null,
    approvalRequired: true,
    approvalOwners: ['reviewer-a', 'pm-a'],
    approvalRequiredCount: 2,
    approvalSlaHours: 8,
    approvalEscalationOwners: ['ops-a', 'lead-a'],
    releaseWindowEnabled: true,
    releaseWindowTimezone: 'Asia/Shanghai',
    releaseWindowDays: [1, 2, 5],
    releaseWindowStartTime: '09:30',
    releaseWindowEndTime: '17:00',
  })
})

test('parseApprovalOwners trims blank items and removes duplicates', () => {
  assert.deepEqual(parseApprovalOwners(' reviewer-a, , reviewer-b, reviewer-a '), [
    'reviewer-a',
    'reviewer-b',
  ])
})

test('parseExperimentQuota rejects non integer or negative quota', () => {
  assert.equal(parseExperimentQuota('0'), 0)
  assert.equal(parseExperimentQuota('12'), 12)
  assert.throws(() => parseExperimentQuota('-1'), /非负整数/)
  assert.throws(() => parseExperimentQuota('1.5'), /非负整数/)
})

test('parseApprovalRequiredCount defaults blank and rejects non positive count', () => {
  assert.equal(parseApprovalRequiredCount(''), 1)
  assert.equal(parseApprovalRequiredCount('2'), 2)
  assert.throws(() => parseApprovalRequiredCount('0'), /正整数/)
  assert.throws(() => parseApprovalRequiredCount('1.5'), /正整数/)
})

test('parseApprovalSlaHours defaults blank and rejects non positive count', () => {
  assert.equal(parseApprovalSlaHours(''), null)
  assert.equal(parseApprovalSlaHours('8'), 8)
  assert.throws(() => parseApprovalSlaHours('0'), /正整数/)
  assert.throws(() => parseApprovalSlaHours('1.5'), /正整数/)
})

test('parseReleaseWindowDays defaults weekdays and rejects invalid days', () => {
  assert.deepEqual(parseReleaseWindowDays(''), [1, 2, 3, 4, 5])
  assert.deepEqual(parseReleaseWindowDays('1, 3, 3, 7'), [1, 3, 7])
  assert.throws(() => parseReleaseWindowDays('0'), /1 到 7/)
  assert.throws(() => parseReleaseWindowDays('1.5'), /1 到 7/)
})

test('parseReleaseWindowTime validates HH:mm values', () => {
  assert.equal(parseReleaseWindowTime('', '09:00'), '09:00')
  assert.equal(parseReleaseWindowTime('18:30'), '18:30')
  assert.throws(() => parseReleaseWindowTime('9:00'), /HH:mm/)
  assert.throws(() => parseReleaseWindowTime('24:00'), /HH:mm/)
})

test('summarizeApplicationSpaces aggregates governance counters', () => {
  const summary = summarizeApplicationSpaces([
    {
      experimentCount: 2,
      runningExperimentCount: 1,
      approvalRequired: true,
      approvalSlaHours: 8,
      releaseWindowEnabled: true,
    },
    { experimentCount: 3, runningExperimentCount: 2, approvalRequired: false, releaseWindowEnabled: false },
  ])

  assert.deepEqual(summary, {
    applicationCount: 2,
    experimentCount: 5,
    runningExperimentCount: 3,
    approvalRequiredCount: 1,
    approvalSlaEnabledCount: 1,
    releaseWindowEnabledCount: 1,
  })
})
