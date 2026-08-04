import { describe, expect, it } from 'vitest'
import { getRatingClass, getRatingTierClass } from './rating'

describe('getRatingTierClass', () => {
  it.each([
    [null, 'rating-none'],
    [1199, 'rating-gray'],
    [1200, 'rating-green'],
    [1399, 'rating-green'],
    [1400, 'rating-cyan'],
    [1599, 'rating-cyan'],
    [1600, 'rating-blue'],
    [1899, 'rating-blue'],
    [1900, 'rating-violet'],
    [2099, 'rating-violet'],
    [2100, 'rating-orange'],
    [2399, 'rating-orange'],
    [2400, 'rating-red'],
  ])('maps %s to %s', (rating, expectedClass) => {
    expect(getRatingTierClass(rating)).toBe(expectedClass)
  })
})

describe('getRatingClass', () => {
  it('keeps new competitors visually neutral', () => {
    expect(getRatingClass(2200, 5)).toBe('rating-newbie')
  })

  it('maps established competitors to Codeforces bands', () => {
    expect(getRatingClass(1199, 6)).toBe('rating-gray')
    expect(getRatingClass(1600, 20)).toBe('rating-blue')
    expect(getRatingClass(2400, 30)).toBe('rating-red')
  })
})
