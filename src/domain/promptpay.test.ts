import { describe, expect, test } from 'vitest'
import generatePayload from 'promptpay-qr'
import { buildPromptPayPayload, crc16, normalizePromptPayId } from './promptpay'

describe('crc16', () => {
  test('CCITT-FALSE check value', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('normalizePromptPayId', () => {
  test('phone formats', () => {
    expect(normalizePromptPayId('phone', '081-234-5678')).toBe('0812345678')
    expect(normalizePromptPayId('phone', '+66812345678')).toBe('0812345678')
    expect(normalizePromptPayId('phone', '66 81 234 5678')).toBe('0812345678')
    expect(normalizePromptPayId('phone', '081234567')).toBeNull()
    expect(normalizePromptPayId('phone', '1812345678')).toBeNull()
  })
  test('national id', () => {
    expect(normalizePromptPayId('nationalId', '1-2345-67890-12-3')).toBe('1234567890123')
    expect(normalizePromptPayId('nationalId', '12345678901234')).toBeNull()
  })
  test('ewallet', () => {
    expect(normalizePromptPayId('ewallet', '123456789012345')).toBe('123456789012345')
    expect(normalizePromptPayId('ewallet', '12345')).toBeNull()
  })
})

describe('buildPromptPayPayload', () => {
  test('matches promptpay-qr for phone', () => {
    expect(buildPromptPayPayload('phone', '0812345678', 52965)).toBe(
      generatePayload('0812345678', { amount: 529.65 }),
    )
  })
  test('matches promptpay-qr for national id', () => {
    expect(buildPromptPayPayload('nationalId', '1234567890123', 100)).toBe(
      generatePayload('1234567890123', { amount: 1 }),
    )
  })
  test('matches promptpay-qr for ewallet', () => {
    expect(buildPromptPayPayload('ewallet', '123456789012345', 35310)).toBe(
      generatePayload('123456789012345', { amount: 353.1 }),
    )
  })
  test('structure', () => {
    const p = buildPromptPayPayload('phone', '0812345678', 52965)
    expect(p.startsWith('000201010212')).toBe(true)
    expect(p).toContain('0016A000000677010111')
    expect(p).toContain('01130066812345678')
    expect(p).toContain('5802TH5303764')
    expect(p).toContain('5406529.65')
    expect(p.slice(-8, -4)).toBe('6304')
  })
})
