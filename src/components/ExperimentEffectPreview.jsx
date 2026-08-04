import { useEffect, useMemo, useState } from 'react'
import { Boxes, FlaskConical, Link2, Settings2, ShieldCheck, Smartphone } from 'lucide-react'

import { getOrderedGroupEntries } from '../utils/editableGroupUtils'
import { buildProductCardEffect } from '../utils/experimentEffectPreview'
import { localizeSystemText } from '../utils/uiLabels'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '未设置'
  if (typeof value === 'object') return JSON.stringify(value)
  return localizeSystemText(value)
}

export default function ExperimentEffectPreview({
  experimentId,
  applicationName,
  appId,
  configVersion,
  groups = {},
  schema = []
}) {
  const groupEntries = useMemo(() => getOrderedGroupEntries(groups), [groups])
  const [selectedGroupId, setSelectedGroupId] = useState(groupEntries[0]?.[0] || '')

  useEffect(() => {
    if (!groupEntries.some(([groupId]) => groupId === selectedGroupId)) {
      setSelectedGroupId(groupEntries[0]?.[0] || '')
    }
  }, [groupEntries, selectedGroupId])

  const selectedEntry = groupEntries.find(([groupId]) => groupId === selectedGroupId) || groupEntries[0]
  const selectedGroup = selectedEntry?.[1] || {}
  const effect = buildProductCardEffect(selectedGroup, schema)
  const configuredFields = schema.length > 0
    ? schema.filter(field => field?.key).map(field => ({
      key: field.key,
      label: field.label || field.key,
      value: selectedGroup.config?.[field.key] ?? field.defaultValue
    }))
    : Object.entries(selectedGroup.config || {}).map(([key, value]) => ({ key, label: key, value }))

  if (groupEntries.length === 0) {
    return (
      <section className="glass-card p-6">
        <p className="text-sm text-slate-500">当前实验还没有可预览的实验组。</p>
      </section>
    )
  }

  return (
    <section className="glass-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Smartphone size={18} className="text-[var(--brand)]" />
            二手手机商品卡
          </div>
          <p className="mt-1 text-xs text-slate-500">切换实验组可直接核对字段配置对应的业务效果。</p>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {groupEntries.map(([groupId, group]) => (
            <button
              key={groupId}
              type="button"
              onClick={() => setSelectedGroupId(groupId)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                selectedGroupId === groupId
                  ? 'border-blue-200 bg-blue-50 text-[var(--brand)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {localizeSystemText(group.name || groupId)}
              <span className="ml-2 text-xs font-normal opacity-70">
                {Math.round(Number(group.trafficRatio || 0) * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid divide-y divide-slate-200 bg-slate-50/70 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:divide-x lg:divide-y-0">
        {[
          { icon: Boxes, label: '应用空间', value: applicationName || appId || '未关联' },
          { icon: FlaskConical, label: '实验', value: experimentId },
          { icon: Link2, label: '命中分组', value: localizeSystemText(selectedGroup.name || selectedGroupId) },
          { icon: Settings2, label: '配置版本', value: `v${configVersion || 1}` }
        ].map((item, index) => (
          <div key={item.label} className="contents">
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
              <item.icon size={16} className="shrink-0 text-[var(--brand)]" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                <p className="truncate text-sm font-medium text-slate-900" title={item.value}>{item.value}</p>
              </div>
            </div>
            {index < 3 ? <div className="hidden items-center px-1 text-slate-300 lg:flex">→</div> : null}
          </div>
        ))}
      </div>

      <div className="grid min-h-[460px] lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="flex items-start justify-center bg-[#eef2f6] p-4">
          <article className="grid w-full max-w-[760px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:grid-cols-[48%_52%]">
            <div className="flex min-h-[300px] items-center justify-center bg-[#f5f6f8] p-4">
              <img
                src={effect.imageUrl}
                alt="二手手机商品"
                className="h-full max-h-[350px] w-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-col p-5">
              <span className="w-fit rounded-md bg-[#e8f7ef] px-2.5 py-1 text-xs font-bold text-[#16794f]">
                {effect.qualityBadge}
              </span>
              <h3 className="mt-4 text-xl font-bold leading-8 text-slate-950">{effect.headline}</h3>
              <p className="mt-2 text-sm text-slate-500">256GB · 深空灰 · 电池健康度 92%</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[#c94e36]">¥</span>
                <span className="text-3xl font-bold text-[#c94e36]">4,699</span>
                <span className="text-xs text-slate-400 line-through">¥6,299</span>
              </div>
              <div className="mt-5 flex items-center gap-2 border-y border-slate-100 py-3 text-sm text-slate-600">
                <ShieldCheck size={17} className="shrink-0 text-[#16794f]" />
                <span>{effect.warrantyText}</span>
              </div>
              <button type="button" className="mt-auto w-full rounded-lg bg-[#202632] px-4 py-3 text-sm font-bold text-white">
                {effect.ctaText}
              </button>
            </div>
          </article>
        </div>

        <div className="border-t border-slate-200 bg-white p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">字段映射</p>
              <p className="mt-1 text-xs text-slate-500">{localizeSystemText(selectedGroupId)}</p>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
              {configuredFields.length} 项
            </span>
          </div>
          <div className="mt-4 max-h-[360px] overflow-y-auto border-y border-slate-100">
            {configuredFields.length > 0 ? configuredFields.map(field => (
              <div key={field.key} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1.3fr)] gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700" title={field.label}>{field.label}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-400" title={field.key}>{field.key}</p>
                </div>
                <p className="break-words text-slate-600">{formatValue(field.value)}</p>
              </div>
            )) : (
              <p className="py-8 text-center text-sm text-slate-500">当前分组没有配置字段。</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
