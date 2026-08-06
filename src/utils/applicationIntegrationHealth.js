const INTEGRATION_STATUS_META = {
  READY: {
    label: '接入完整',
    className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]',
  },
  ATTENTION: {
    label: '需要关注',
    className: 'border-[#f3e3a0] bg-[#fffbea] text-[#8a6d1d]',
  },
  BLOCKED: {
    label: '存在阻断',
    className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]',
  },
}

const CHECK_STATUS_META = {
  PASS: {
    label: '已完成',
    className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]',
  },
  WAITING: {
    label: '待接入',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  WARNING: {
    label: '需关注',
    className: 'border-[#f3e3a0] bg-[#fffbea] text-[#8a6d1d]',
  },
  BLOCKED: {
    label: '已阻断',
    className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]',
  },
}

const fallbackMeta = {
  label: '状态未知',
  className: 'border-slate-200 bg-slate-50 text-slate-600',
}

export const getIntegrationStatusMeta = status => INTEGRATION_STATUS_META[status] || fallbackMeta

export const getIntegrationCheckStatusMeta = status => CHECK_STATUS_META[status] || fallbackMeta

export const buildIntegrationHealthSummary = (health = {}) => {
  const checks = Array.isArray(health?.checks) ? health.checks : []
  return {
    total: checks.length,
    passed: checks.filter(check => check.status === 'PASS').length,
    waiting: checks.filter(check => check.status === 'WAITING').length,
    warning: checks.filter(check => check.status === 'WARNING').length,
    blocked: checks.filter(check => check.status === 'BLOCKED').length,
  }
}

export const getIntegrationTargetLabel = (target) => {
  if (target === 'dictionary') return '维护业务字典'
  if (target === 'experiments') return '创建实验'
  if (target === 'runtime') return '查看实验运行'
  return '维护应用配置'
}
