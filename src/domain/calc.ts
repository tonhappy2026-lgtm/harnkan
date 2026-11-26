import { allocate, type Satang } from './money'
import type { Bill, BillResult } from './types'

const pct = (amount: Satang, percent: number) => Math.round((amount * percent) / 100)

export function computeBill(bill: Bill): BillResult {
  const ids = bill.people.map((p) => p.id)
  const valid = new Set(ids)
  const personSubtotals: Record<string, Satang> = Object.fromEntries(ids.map((id) => [id, 0]))
  const unassignedItemIds: string[] = []
  let rawSubtotal: Satang = 0

  if (bill.mode === 'equal') {
    rawSubtotal = Math.max(0, bill.equalTotal)
    if (ids.length > 0) {
      allocate(rawSubtotal, ids.map(() => 1)).forEach((v, i) => {
        personSubtotals[ids[i]] += v
      })
    }
  } else {
    for (const item of bill.items) {
      const line = Math.max(0, Math.round(item.unitPrice))
      if (ids.length === 0) {
        rawSubtotal += line
        continue
      }
      let consumers = item.consumerIds.length === 0 ? ids : item.consumerIds.filter((id) => valid.has(id))
      if (consumers.length === 0) {
        unassignedItemIds.push(item.id)
        continue
      }
      rawSubtotal += line
      consumers = ids.filter((id) => consumers.includes(id)) // keep bill order, dedupe
      allocate(line, consumers.map(() => 1)).forEach((v, i) => {
        personSubtotals[consumers[i]] += v
      })
    }
  }

  const subtotal = ids.length > 0 ? ids.reduce((a, id) => a + personSubtotals[id], 0) : rawSubtotal
  const d = bill.discount
  const rawDiscount = !d.enabled ? 0 : d.type === 'percent' ? pct(subtotal, d.value) : Math.round(d.value)
  const discount = Math.min(Math.max(0, rawDiscount), subtotal)
  const afterDisc = subtotal - discount
  const serviceCharge = bill.serviceCharge.enabled ? pct(afterDisc, bill.serviceCharge.percent) : 0
  const vatOn = bill.vat.enabled
  const vatAdded = vatOn && !bill.vat.inclusive ? pct(afterDisc + serviceCharge, bill.vat.percent) : 0
  const total = afterDisc + serviceCharge + vatAdded
  const vatIncluded =
    vatOn && bill.vat.inclusive ? Math.round((total * bill.vat.percent) / (100 + bill.vat.percent)) : 0

  const shares: Record<string, Satang> = {}
  if (ids.length > 0) {
    allocate(total, ids.map((id) => personSubtotals[id])).forEach((v, i) => {
      shares[ids[i]] = v
    })
  }

  return { subtotal, discount, serviceCharge, vatAdded, vatIncluded, total, personSubtotals, shares, unassignedItemIds }
}
