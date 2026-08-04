import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProductCardEffect } from './experimentEffectPreview.js'

test('buildProductCardEffect maps configured fields to the rendered product card', () => {
  const effect = buildProductCardEffect({
    config: {
      headline: '每一台都经过 30 项质检',
      qualityBadge: '99新',
      warrantyText: '一年质保',
      ctaText: '查看检测报告'
    }
  })

  assert.deepEqual(effect, {
    imageUrl: '/assets/refurbished-phone.webp',
    headline: '每一台都经过 30 项质检',
    qualityBadge: '99新',
    warrantyText: '一年质保',
    ctaText: '查看检测报告'
  })
})

test('buildProductCardEffect can infer custom keys from schema labels', () => {
  const effect = buildProductCardEffect(
    { config: { copyA: '平台验机通过', copyB: '马上查看' } },
    [
      { key: 'copyA', label: '品质角标' },
      { key: 'copyB', label: '购买按钮' }
    ]
  )

  assert.equal(effect.qualityBadge, '平台验机通过')
  assert.equal(effect.ctaText, '马上查看')
})

test('buildProductCardEffect maps generated product image into the preview', () => {
  const effect = buildProductCardEffect({
    config: { productImageUrl: '/generated/phone.png' }
  })

  assert.equal(effect.imageUrl, '/generated/phone.png')
})
