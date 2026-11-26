import { describe, expect, test } from 'vitest'
import { computeBill } from '../domain/calc'
import type { Bill } from '../domain/types'
import { translate } from '../i18n'
import { buildShareText } from './shareText'

describe('buildShareText', () => {
  test('formats Thai summary with per-person shares and total', () => {
    const bill: Bill = {
      id: 'b1',
      title: 'หมูกระทะศุกร์',
      createdAt: '2026-11-26T00:00:00.000Z',
      mode: 'itemized',
      people: [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
        { id: 'C', name: 'C' },
      ],
      payerId: 'A',
      equalTotal: 0,
      items: [
        { id: '1', name: 'หมูกระทะ', unitPrice: 90000, qty: 1, consumerIds: [] },
        { id: '2', name: 'เบียร์', unitPrice: 30000, qty: 1, consumerIds: ['A', 'B'] },
      ],
      serviceCharge: { enabled: true, percent: 10 },
      vat: { enabled: true, percent: 7, inclusive: false },
      discount: { enabled: false, type: 'amount', value: 0 },
      paidIds: [],
    }
    const result = computeBill(bill)
    const text = buildShareText(bill, result, (k, v) => translate('th', k, v))
    expect(text).toContain('หารกัน')
    expect(text).toContain('หมูกระทะศุกร์')
    expect(text).toContain('A: 529.65')
    expect(text).toContain('B: 529.65')
    expect(text).toContain('C: 353.10')
    expect(text).toContain('รวม 1,412.40')
  })
})
