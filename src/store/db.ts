import { del, get, set, entries, setMany, clear as clearStore } from 'idb-keyval'
import type { Bill, Settings } from '../domain/types'

// Default idb-keyval store holds settings + one key per bill.
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

function isBill(v: unknown): v is Bill {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.mode === 'equal' || v.mode === 'itemized') &&
    Array.isArray(v.people) &&
    Array.isArray(v.items) &&
    isObj(v.serviceCharge) &&
    isObj(v.vat) &&
    isObj(v.discount) &&
    Array.isArray(v.paidIds)
  )
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
    !isObj(data.settings) ||
    !Array.isArray(data.bills) ||
    !data.bills.every(isBill)
  ) {
    throw new Error('invalid-backup')
  }
  const bills = data.bills as Bill[]
  const settings = { ...defaultSettings(), ...(data.settings as Partial<Settings>) }
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
