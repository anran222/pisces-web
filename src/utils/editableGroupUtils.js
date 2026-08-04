export const getEditableGroupPanelKey = (group = {}, index = 0) => group?.id || `group-${index}`

const normalizeGroupId = (value) => (typeof value === 'string' ? value.trim() : '')

export const getOrderedGroupEntries = (groups = {}) => Object.entries(groups)
  .sort(([leftId], [rightId]) => {
    if (leftId === 'control') return -1
    if (rightId === 'control') return 1
    return leftId.localeCompare(rightId)
  })

export const buildExperimentGroupTrafficAllocation = (groups = []) => groups.map(group => ({
  group: group.id,
  ratio: Number(group.trafficRatio) || 0
}))

export const rebalanceExperimentGroupTraffic = (groups = []) => {
  if (groups.length === 0) {
    return []
  }

  const sharedRatio = Number((1 / groups.length).toFixed(4))
  return groups.map((group, index) => ({
    ...group,
    trafficRatio: index === groups.length - 1
      ? Number((1 - sharedRatio * (groups.length - 1)).toFixed(4))
      : sharedRatio
  }))
}

export const buildNextExperimentGroup = (groups = []) => {
  const existingIds = new Set(groups.map(group => normalizeGroupId(group?.id)))
  let variantIndex = 0
  let variantSuffix = ''
  let groupId = ''

  do {
    variantSuffix = variantIndex < 26
      ? String.fromCharCode(97 + variantIndex)
      : String(variantIndex + 1)
    groupId = `variant_${variantSuffix}`
    variantIndex += 1
  } while (existingIds.has(groupId))

  return {
    id: groupId,
    name: `实验组${variantSuffix.toUpperCase()}`,
    trafficRatio: 0,
    config: { ...(groups[0]?.config || {}) }
  }
}

export const buildEditableGroupSummary = (group = {}, schema = []) => {
  const groupId = group?.id || ''
  const groupName = group?.name || groupId || '未命名实验组'
  const trafficRatio = Number(group?.trafficRatio) || 0
  const configCount = Array.isArray(schema) && schema.length > 0
    ? schema.filter(field => field?.key).length
    : Object.keys(group?.config || {}).length

  return {
    groupId,
    groupName,
    trafficPercent: `${(trafficRatio * 100).toFixed(0)}%`,
    configCount
  }
}
