import type { Satang } from './money'

export type { Satang }

export interface Person {
  id: string
  name: string
}

export interface Item {
  id: string
  name: string
  unitPrice: Satang
  qty: number
  /** empty = everyone */
  consumerIds: string[]
}

export type SplitMode = 'equal' | 'itemized'

export interface Bill {
  id: string
  title: string
  createdAt: string
  mode: SplitMode
  people: Person[]
  payerId: string
  /** Optional map of personId -> amount already paid at the restaurant (satang). */
  paidAmounts?: Record<string, Satang>
  equalTotal: Satang
  items: Item[]
  serviceCharge: { enabled: boolean; percent: number }
  vat: { enabled: boolean; percent: number; inclusive: boolean }
  /** value is satang when type = 'amount', percent when type = 'percent' */
  discount: { enabled: boolean; type: 'amount' | 'percent'; value: number }
  paidIds: string[]
}

export type PromptPayType = 'phone' | 'nationalId' | 'ewallet'

export interface Settings {
  language: 'th' | 'en'
  promptPay?: { type: PromptPayType; id: string }
  friends: Person[]
  defaults: { scPercent: number; vatPercent: number }
}

export interface Settlement {
  fromId: string
  toId: string
  amount: Satang
}

export interface BillResult {
  subtotal: Satang
  discount: Satang
  serviceCharge: Satang
  vatAdded: Satang
  vatIncluded: Satang
  total: Satang
  personSubtotals: Record<string, Satang>
  shares: Record<string, Satang>
  paidByPerson: Record<string, Satang>
  totalPaid: Satang
  netBalances: Record<string, Satang>
  settlements: Settlement[]
  unassignedItemIds: string[]
}
