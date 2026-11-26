import { describe, expect, test } from 'vitest'
import { allocate, formatBaht, parseBaht } from './money'

describe('parseBaht', () => {
  test('parses valid amounts to satang', () => {
    expect(parseBaht('12.5')).toBe(1250)
    expect(parseBaht('1,200')).toBe(120000)
    expect(parseBaht('0.005')).toBe(1)
    expect(parseBaht(' 99 ')).toBe(9900)
  })
  test('rejects invalid input', () => {
    expect(parseBaht('')).toBeNull()
    expect(parseBaht('abc')).toBeNull()
    expect(parseBaht('-5')).toBeNull()
    expect(parseBaht('1.2.3')).toBeNull()
  })
})

describe('formatBaht', () => {
  test('formats with grouping and 2 decimals', () => {
    expect(formatBaht(141240)).toBe('1,412.40')
    expect(formatBaht(5)).toBe('0.05')
    expect(formatBaht(0)).toBe('0.00')
  })
})

describe('allocate', () => {
  test('equal split with largest remainder', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
  })
  test('proportional split', () => {
    expect(allocate(141240, [45000, 45000, 30000])).toEqual([52965, 52965, 35310])
  })
  test('zero weights give zeros', () => {
    expect(allocate(10, [0, 0])).toEqual([0, 0])
  })
  test('remainder goes to largest fraction', () => {
    expect(allocate(7, [1, 2])).toEqual([2, 5])
  })
  test('sum always equals total', () => {
    const r = allocate(100001, [3, 7, 11, 13])
    expect(r.reduce((a, b) => a + b, 0)).toBe(100001)
  })
})
