export const getEditableGroupPanelKey = (group = {}, index = 0) => group?.id || `group-${index}`

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
