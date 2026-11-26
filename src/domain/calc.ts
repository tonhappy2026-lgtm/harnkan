import { allocate, type Satang } from './money'
import type { Bill, BillResult, Settlement } from './types'

const pct = (amount: Satang, percent: number) => Math.round((amount * percent) / 100)

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

/**
 * Compute minimal transfer list from net balances (paid - share).
 * Debtors (net < 0) pay creditors (net > 0).
 */
export function computeSettlements(ids: string[], netBalances: Record<string, Satang>): Settlement[] {
  const debtors = ids
    .filter((id) => (netBalances[id] ?? 0) < 0)
    .map((id) => ({ id, amt: -(netBalances[id] ?? 0) }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = ids
    .filter((id) => (netBalances[id] ?? 0) > 0)
    .map((id) => ({ id, amt: netBalances[id] ?? 0 }))
    .sort((a, b) => b.amt - a.amt)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    if (pay > 0) {
      settlements.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: pay })
    }
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt === 0) i++
    if (creditors[j].amt === 0) j++
  }
  return settlements
}

export function computeBill(bill: Bill): BillResult {
  const ids = bill.people.map((p) => p.id)
  const valid = new Set(ids)
  const personSubtotals: Record<string, Satang> = Object.fromEntries(ids.map((id) => [id, 0]))
  const unassignedItemIds: string[] = []
  let subtotal: Satang = 0

  // Accumulate exact integer weights using common denominator across all assigned items
  // so repeated divisions (e.g. three 1,000 THB items split 3 ways) never accumulate 1-satang rounding drift.
  const exactWeights: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))

  if (bill.mode === 'equal') {
    subtotal = Math.max(0, bill.equalTotal)
    if (ids.length > 0) {
      for (const id of ids) exactWeights[id] = 1
      allocate(subtotal, ids.map(() => 1)).forEach((v, i) => {
        personSubtotals[ids[i]] = v
      })
    }
  } else {
    const assignedItems: { line: Satang; consumers: string[] }[] = []
    for (const item of bill.items) {
      const line = Math.max(0, Math.round(item.unitPrice))
      if (ids.length === 0) {
        subtotal += line
        continue
      }
      let consumers = item.consumerIds.length === 0 ? ids : item.consumerIds.filter((id) => valid.has(id))
      if (consumers.length === 0) {
        unassignedItemIds.push(item.id)
        continue
      }
      subtotal += line
      consumers = ids.filter((id) => consumers.includes(id)) // keep bill order, dedupe
      assignedItems.push({ line, consumers })
    }

    if (ids.length > 0 && assignedItems.length > 0) {
      // Compute LCM of consumer counts (or fall back to floating weights if LCM would overflow safe int)
      let denom = 1
      let exact = true
      for (const it of assignedItems) {
        const next = lcm(denom, it.consumers.length)
        if (!Number.isSafeInteger(next) || next > 1e9) {
          exact = false
          break
        }
        denom = next
      }

      if (exact) {
        for (const it of assignedItems) {
          const mul = denom / it.consumers.length
          for (const cid of it.consumers) {
            exactWeights[cid] += it.line * mul
          }
        }
      } else {
        for (const it of assignedItems) {
          const share = it.line / it.consumers.length
          for (const cid of it.consumers) {
            exactWeights[cid] += share
          }
        }
      }

      allocate(
        subtotal,
        ids.map((id) => exactWeights[id]),
      ).forEach((v, i) => {
        personSubtotals[ids[i]] = v
      })
    }
  }

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
    allocate(
      total,
      ids.map((id) => exactWeights[id]),
    ).forEach((v, i) => {
      shares[ids[i]] = v
    })
  }

  // Paid amounts per person: if any custom paidAmounts > 0 exist, use them; otherwise default to payerId paying `total`.
  const rawPaidMap = bill.paidAmounts ?? {}
  const customPaidSum = ids.reduce((s, id) => s + Math.max(0, Math.round(rawPaidMap[id] ?? 0)), 0)
  const paidByPerson: Record<string, Satang> = {}
  const defaultPayer = valid.has(bill.payerId) ? bill.payerId : (ids[0] ?? '')
  for (const id of ids) {
    if (customPaidSum > 0) {
      paidByPerson[id] = Math.max(0, Math.round(rawPaidMap[id] ?? 0))
    } else {
      paidByPerson[id] = id === defaultPayer ? total : 0
    }
  }
  const totalPaid = ids.reduce((s, id) => s + (paidByPerson[id] ?? 0), 0)

  // To ensure settlements always close even if user entered partial advances < total,
  // any remaining unpaid difference (total - totalPaid) is attributed to defaultPayer.
  const effectivePaid: Record<string, Satang> = { ...paidByPerson }
  if (ids.length > 0 && customPaidSum > 0 && totalPaid !== total && defaultPayer) {
    effectivePaid[defaultPayer] = Math.max(0, (effectivePaid[defaultPayer] ?? 0) + (total - totalPaid))
  }

  const netBalances: Record<string, Satang> = {}
  for (const id of ids) {
    netBalances[id] = (effectivePaid[id] ?? 0) - (shares[id] ?? 0)
  }

  const settlements = computeSettlements(ids, netBalances)

  return {
    subtotal,
    discount,
    serviceCharge,
    vatAdded,
    vatIncluded,
    total,
    personSubtotals,
    shares,
    paidByPerson,
    totalPaid: customPaidSum > 0 ? totalPaid : total,
    netBalances,
    settlements,
    unassignedItemIds,
  }
}
