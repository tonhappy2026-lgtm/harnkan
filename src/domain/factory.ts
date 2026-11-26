import type { Bill, Item, Person, Settings } from './types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

export function newBill(people: Person[], defaults: Settings['defaults']): Bill {
  return {
    id: uid(),
    title: '',
    createdAt: new Date().toISOString(),
    mode: 'equal',
    people,
    payerId: people[0]?.id ?? '',
    equalTotal: 0,
    items: [],
    serviceCharge: { enabled: true, percent: defaults.scPercent },
    vat: { enabled: true, percent: defaults.vatPercent, inclusive: false },
    discount: { enabled: false, type: 'amount', value: 0 },
    paidIds: [],
  }
}

export function newItem(): Item {
  return { id: uid(), name: '', unitPrice: 0, qty: 1, consumerIds: [] }
}

export function newPerson(name: string): Person {
  return { id: uid(), name: name.trim() }
}
