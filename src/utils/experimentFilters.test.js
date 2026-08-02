import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExperimentListParams, filterExperimentsBySearch } from './experimentFilters.js'

test('buildExperimentListParams removes empty filters and ignores all status', () => {
  assert.deepEqual(buildExperimentListParams({
    status: 'all',
    appId: '  shop-app  ',
    owner: ' ',
    statuses: null
  }), {
    appId: 'shop-app'
  })
})

test('buildExperimentListParams joins statuses array for backend query', () => {
  assert.deepEqual(buildExperimentListParams({
    statuses: ['RUNNING', ' ', 'PAUSED'],
    owner: 'ops'
  }), {
    statuses: 'RUNNING,PAUSED',
    owner: 'ops'
  })
})

test('filterExperimentsBySearch matches name id app and owner', () => {
  const experiments = [
    { id: 'exp-a', name: '价格实验', appId: 'shop-app', owner: 'alice' },
    { id: 'exp-b', name: '搜索实验', appId: 'search-app', owner: 'bob' }
  ]

  assert.deepEqual(filterExperimentsBySearch(experiments, 'bob'), [experiments[1]])
  assert.deepEqual(filterExperimentsBySearch(experiments, 'shop'), [experiments[0]])
  assert.deepEqual(filterExperimentsBySearch(experiments, 'exp-b'), [experiments[1]])
})
