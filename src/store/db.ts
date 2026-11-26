import { del, get, set, entries, setMany, clear as clearStore } from 'idb-keyval'
import { normalizePromptPayId } from '../domain/promptpay'
import type { Bill, Item, Person, Settings } from '../domain/types'

const store = undefined
const SETTINGS = 'settings'
const BILL_PREFIX = 'bill:'

function detectLanguage(): Settings['language'] {
  const lang = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return lang.toLowerCase().startsWith('th') ? 'th' : 'en'
}

export function defaultSettings(): Settings {
  return { language: detectLanguage(), friends: [], defaults: { scPercent: 10, vatPercent: 7 } }
}

export async function listBills(): Promise<Bill[]> {
  const all = await entries<string, unknown>(store)
  return all
    .filter(([k]) => typeof k === 'string' && k.startsWith(BILL_PREFIX))
    .map(([, v]) => v as Bill)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const getBill = (id: string) => get<Bill>(BILL_PREFIX + id, store)
export const saveBill = (b: Bill) => set(BILL_PREFIX + b.id, b, store)
export const deleteBill = (id: string) => del(BILL_PREFIX + id, store)

export async function getSettings(): Promise<Settings> {
  const s = await get<Settings>(SETTINGS, store)
  return s ? { ...defaultSettings(), ...s } : defaultSettings()
}
export const saveSettings = (s: Settings) => set(SETTINGS, s, store)

interface Backup {
  app: 'harnkan'
  version: 1
  settings: Settings
  bills: Bill[]
}

export async function exportAll(): Promise<string> {
  const backup: Backup = { app: 'harnkan', version: 1, settings: await getSettings(), bills: await listBills() }
  return JSON.stringify(backup, null, 2)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isFinNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isPerson(v: unknown): v is Person {
  return isObj(v) && typeof v.id === 'string' && typeof v.name === 'string'
}

function isItem(v: unknown): v is Item {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isFinNum(v.unitPrice) &&
    isFinNum(v.qty) &&
    Array.isArray(v.consumerIds) &&
    v.consumerIds.every((c) => typeof c === 'string')
  )
}

function isBill(v: unknown): v is Bill {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.mode === 'equal' || v.mode === 'itemized') &&
    typeof v.payerId === 'string' &&
    isFinNum(v.equalTotal) &&
    Array.isArray(v.people) &&
    v.people.every(isPerson) &&
    Array.isArray(v.items) &&
    v.items.every(isItem) &&
    isObj(v.serviceCharge) &&
    typeof v.serviceCharge.enabled === 'boolean' &&
    isFinNum(v.serviceCharge.percent) &&
    isObj(v.vat) &&
    typeof v.vat.enabled === 'boolean' &&
    isFinNum(v.vat.percent) &&
    typeof v.vat.inclusive === 'boolean' &&
    isObj(v.discount) &&
    typeof v.discount.enabled === 'boolean' &&
    (v.discount.type === 'amount' || v.discount.type === 'percent') &&
    isFinNum(v.discount.value) &&
    Array.isArray(v.paidIds) &&
    v.paidIds.every((p) => typeof p === 'string')
  )
}

function isValidSettings(v: unknown): v is Partial<Settings> {
  if (!isObj(v)) return false
  if (v.language !== undefined && v.language !== 'th' && v.language !== 'en') return false
  if (v.friends !== undefined && (!Array.isArray(v.friends) || !v.friends.every(isPerson))) return false
  if (v.defaults !== undefined) {
    if (!isObj(v.defaults) || !isFinNum(v.defaults.scPercent) || !isFinNum(v.defaults.vatPercent)) return false
  }
  if (v.promptPay !== undefined) {
    if (
      !isObj(v.promptPay) ||
      (v.promptPay.type !== 'phone' && v.promptPay.type !== 'nationalId' && v.promptPay.type !== 'ewallet') ||
      typeof v.promptPay.id !== 'string' ||
      normalizePromptPayId(v.promptPay.type, v.promptPay.id) === null
    ) {
      return false
    }
  }
  return true
}

export async function importAll(json: string): Promise<void> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('invalid-backup')
  }
  if (
    !isObj(data) ||
    data.app !== 'harnkan' ||
    data.version !== 1 ||
    !isValidSettings(data.settings) ||
    !Array.isArray(data.bills) ||
    !data.bills.every(isBill)
  ) {
    throw new Error('invalid-backup')
  }
  const bills = data.bills as Bill[]
  const settings = { ...defaultSettings(), ...data.settings }
  await clearStore(store)
  await setMany([[SETTINGS, settings], ...bills.map((b) => [BILL_PREFIX + b.id, b] as [string, Bill])], store)
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
