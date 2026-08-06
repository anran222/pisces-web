const CHECK_STATUS_META = {
  PASS: {
    label: '已通过',
    className: 'border-[#cde5d7] bg-[#f6fbf8] text-[#1e7e57]',
  },
  WARNING: {
    label: '建议确认',
    className: 'border-[#f3e3a0] bg-[#fffbea] text-[#8a6d1d]',
  },
  BLOCKED: {
    label: '必须修正',
    className: 'border-[#ecd8bf] bg-[#fff8ef] text-[#9a6026]',
  },
}

const fallbackMeta = {
  label: '状态未知',
  className: 'border-slate-200 bg-slate-50 text-slate-600',
}

export const getPreflightStatusMeta = status => CHECK_STATUS_META[status] || fallbackMeta

export const buildPreflightFingerprint = payload => JSON.stringify(payload || {})

export const buildPreflightGroups = (preflight = {}) => {
  const checks = Array.isArray(preflight?.checks) ? preflight.checks : []
  return checks.reduce((groups, check) => {
    const section = check.section || '其他'
    const current = groups.find(group => group.section === section)
    if (current) {
      current.checks.push(check)
      return groups
    }
    return [...groups, { section, checks: [check] }]
  }, [])
}

export const shouldConfirmPreflightWarnings = preflight => (
  Boolean(preflight?.readyToCreate) && Number(preflight?.warningCount || 0) > 0
)
