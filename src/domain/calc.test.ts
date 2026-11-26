import { describe, expect, test } from 'vitest'
import { computeBill } from './calc'
import { newBill } from './factory'
import type { Bill, Item, Person } from './types'

const A: Person = { id: 'A', name: 'A' }
const B: Person = { id: 'B', name: 'B' }
const C: Person = { id: 'C', name: 'C' }
const pork: Item = { id: 'pork', name: 'หมูกระทะ', unitPrice: 90000, qty: 1, consumerIds: [] }
const beer: Item = { id: 'beer', name: 'เบียร์', unitPrice: 30000, qty: 1, consumerIds: ['A', 'B'] }

function base(): Bill {
  return {
    id: 'b1',
    title: 't',
    createdAt: '2026-11-26T00:00:00.000Z',
    mode: 'itemized',
    people: [A, B, C],
    payerId: 'A',
    equalTotal: 0,
    items: [pork, beer],
    serviceCharge: { enabled: true, percent: 10 },
    vat: { enabled: true, percent: 7, inclusive: false },
    discount: { enabled: false, type: 'amount', value: 0 },
    paidIds: [],
  }
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

describe('computeBill', () => {
  test('equal mode, charges off', () => {
    const bill: Bill = {
      ...base(),
      mode: 'equal',
      equalTotal: 100000,
      serviceCharge: { enabled: false, percent: 10 },
      vat: { enabled: false, percent: 7, inclusive: false },
    }
    expect(computeBill(bill).shares).toEqual({ A: 33334, B: 33333, C: 33333 })
  })

  test('itemized with SC 10% and VAT 7%', () => {
    const r = computeBill(base())
    expect([r.subtotal, r.serviceCharge, r.vatAdded, r.total]).toEqual([120000, 12000, 9240, 141240])
    expect(r.personSubtotals).toEqual({ A: 45000, B: 45000, C: 30000 })
    expect(r.shares).toEqual({ A: 52965, B: 52965, C: 35310 })
    expect(sum(r.shares)).toBe(r.total)
  })

  test('VAT inclusive adds nothing but reports included VAT', () => {
    const r = computeBill({ ...base(), vat: { enabled: true, percent: 7, inclusive: true } })
    expect([r.vatAdded, r.total, r.vatIncluded]).toEqual([0, 132000, 8636])
  })

  test('discount percent', () => {
    const r = computeBill({ ...base(), discount: { enabled: true, type: 'percent', value: 10 } })
    expect(r.discount).toBe(12000)
    expect(r.total).toBe(127116)
    expect(sum(r.shares)).toBe(127116)
  })

  test('discount amount in satang larger than subtotal clamps to zero total', () => {
    const r = computeBill({ ...base(), discount: { enabled: true, type: 'amount', value: 99999900 } })
    expect(r.discount).toBe(120000)
    expect(r.total).toBe(0)
  })

  test('disabled discount is ignored', () => {
    const r = computeBill({ ...base(), discount: { enabled: false, type: 'amount', value: 5000 } })
    expect(r.discount).toBe(0)
  })

  test('removed consumer still leaves remaining consumer assigned', () => {
    const r = computeBill({ ...base(), people: [A, C] })
    expect(r.unassignedItemIds).toEqual([])
    expect(r.personSubtotals).toEqual({ A: 75000, C: 45000 })
  })

  test('item with no remaining consumers is unassigned and excluded', () => {
    const r = computeBill({ ...base(), items: [{ ...beer, consumerIds: ['Z'] }, pork] })
    expect(r.unassignedItemIds).toEqual(['beer'])
    expect(r.subtotal).toBe(90000)
  })

  test('qty multiplies price', () => {
    const r = computeBill({
      ...base(),
      items: [{ ...beer, qty: 3 }],
      serviceCharge: { enabled: false, percent: 10 },
      vat: { enabled: false, percent: 7, inclusive: false },
    })
    expect(r.shares).toEqual({ A: 45000, B: 45000, C: 0 })
  })

  test('no people still computes bill subtotal and total (shares empty)', () => {
    const r = computeBill({ ...base(), people: [] })
    expect(r.subtotal).toBe(120000)
    expect(r.total).toBe(141240)
    expect(r.shares).toEqual({})
  })
})

describe('newBill', () => {
  test('uses defaults', () => {
    const b = newBill([A, B], { scPercent: 10, vatPercent: 7 })
    expect(b.mode).toBe('equal')
    expect(b.payerId).toBe('A')
    expect(b.serviceCharge).toEqual({ enabled: true, percent: 10 })
    expect(b.vat).toEqual({ enabled: true, percent: 7, inclusive: false })
    expect(b.discount.enabled).toBe(false)
    expect(b.id).toBeTruthy()
  })
})
