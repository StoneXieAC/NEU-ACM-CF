import { describe, expect, it } from 'vitest'
import { getRatingClass } from './rating'

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
