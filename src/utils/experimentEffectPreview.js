const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim()
}

const findConfigValue = (config, schema, aliases, labelPattern) => {
  for (const alias of aliases) {
    const matchedKey = Object.keys(config || {}).find(key => key.toLowerCase() === alias.toLowerCase())
    if (matchedKey && normalizeText(config[matchedKey])) {
      return normalizeText(config[matchedKey])
    }
  }

  const matchedField = (schema || []).find(field => labelPattern.test(`${field?.label || ''} ${field?.key || ''}`))
  if (matchedField?.key && normalizeText(config?.[matchedField.key])) {
    return normalizeText(config[matchedField.key])
  }
  return ''
}

export const buildProductCardEffect = (group = {}, schema = []) => {
  const config = group?.config || {}
  return {
    imageUrl: findConfigValue(
      config,
      schema,
      ['productImageUrl', 'imageUrl', 'mainImageUrl', 'productImage'],
      /主图|商品图|图片|image/i
    ) || '/assets/refurbished-phone.webp',
    headline: findConfigValue(
      config,
      schema,
      ['headline', 'mainTitle', 'productTitle', 'titleText'],
      /标题|headline|title/i
    ) || '99新旗舰手机 · 官方质检二手优品',
    qualityBadge: findConfigValue(
      config,
      schema,
      ['qualityBadge', 'qualityLabel', 'badgeText', 'badge'],
      /质检|成色|品质|quality|badge/i
    ) || '质检认证',
    warrantyText: findConfigValue(
      config,
      schema,
      ['warrantyText', 'warranty', 'serviceText', 'guaranteeText'],
      /质保|保障|售后|warranty|guarantee/i
    ) || '7天无理由退货 · 1年质保',
    ctaText: findConfigValue(
      config,
      schema,
      ['ctaText', 'buttonText', 'actionText', 'cta'],
      /按钮|行动|购买|cta|button/i
    ) || '立即购买'
  }
}
