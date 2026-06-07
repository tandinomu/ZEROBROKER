import { formatPrice, DZONGKHAGS, PROPERTY_TYPES } from '../lib/types'

describe('formatPrice', () => {
  it('formats crore amounts (>= 1 Cr = 10,000,000)', () => {
    expect(formatPrice(10000000)).toBe('Nu. 1.00 Cr')
    expect(formatPrice(18000000)).toBe('Nu. 1.80 Cr')
    expect(formatPrice(100000000)).toBe('Nu. 10.00 Cr')
  })

  it('formats lakh amounts (>= 1 L = 100,000, < 1 Cr)', () => {
    expect(formatPrice(100000)).toBe('Nu. 1.00 L')
    expect(formatPrice(500000)).toBe('Nu. 5.00 L')
    expect(formatPrice(8500000)).toBe('Nu. 85.00 L')
  })

  it('formats small amounts with locale separators', () => {
    expect(formatPrice(50000)).toBe('Nu. 50,000')
    expect(formatPrice(1000)).toBe('Nu. 1,000')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('Nu. 0')
  })
})

describe('DZONGKHAGS', () => {
  it('contains exactly 20 dzongkhags', () => {
    expect(DZONGKHAGS).toHaveLength(20)
  })

  it('includes major districts', () => {
    expect(DZONGKHAGS).toContain('Thimphu')
    expect(DZONGKHAGS).toContain('Paro')
    expect(DZONGKHAGS).toContain('Punakha')
    expect(DZONGKHAGS).toContain('Chhukha')
  })

  it('has no duplicate entries', () => {
    const unique = new Set(DZONGKHAGS)
    expect(unique.size).toBe(DZONGKHAGS.length)
  })
})

describe('PROPERTY_TYPES', () => {
  it('includes all expected property types', () => {
    const values = PROPERTY_TYPES.map(p => p.value)
    expect(values).toContain('land')
    expect(values).toContain('house')
    expect(values).toContain('apartment')
    expect(values).toContain('commercial')
    expect(values).toContain('vehicle')
  })

  it('every type has a non-empty label', () => {
    PROPERTY_TYPES.forEach(p => {
      expect(p.label.length).toBeGreaterThan(0)
    })
  })
})
