import test from 'node:test'
import assert from 'node:assert/strict'
import { getActionMenuPlacement } from './experimentListUtils.js'

test('getActionMenuPlacement opens upward for the last two rows', () => {
  assert.equal(getActionMenuPlacement(0, 6), 'top-full mt-1')
  assert.equal(getActionMenuPlacement(3, 6), 'top-full mt-1')
  assert.equal(getActionMenuPlacement(4, 6), 'bottom-full mb-1')
  assert.equal(getActionMenuPlacement(5, 6), 'bottom-full mb-1')
})

test('getActionMenuPlacement still opens upward for short lists when row is near the bottom', () => {
  assert.equal(getActionMenuPlacement(0, 2), 'bottom-full mb-1')
  assert.equal(getActionMenuPlacement(1, 2), 'bottom-full mb-1')
})
