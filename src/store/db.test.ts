import { beforeEach, describe, expect, test } from 'vitest'
import { clear } from 'idb-keyval'
import { newBill } from '../domain/factory'
import { deleteBill, exportAll, getBill, getSettings, importAll, listBills, saveBill, saveSettings } from './db'

const defaults = { scPercent: 10, vatPercent: 7 }

beforeEach(async () => {
  await clear()
})

describe('bills', () => {
  test('save, list newest first, get, delete', async () => {
    const a = { ...newBill([], defaults), createdAt: '2026-01-01T00:00:00.000Z' }
    const b = { ...newBill([], defaults), createdAt: '2026-02-01T00:00:00.000Z' }
    await saveBill(a)
    await saveBill(b)
    expect((await listBills()).map((x) => x.id)).toEqual([b.id, a.id])
    expect(await getBill(a.id)).toEqual(a)
    await deleteBill(a.id)
    expect((await listBills()).map((x) => x.id)).toEqual([b.id])
  })
})

describe('settings', () => {
  test('defaults when empty', async () => {
    const s = await getSettings()
    expect(s.friends).toEqual([])
    expect(s.defaults).toEqual(defaults)
    expect(['th', 'en']).toContain(s.language)
  })
  test('roundtrip', async () => {
    const s = { ...(await getSettings()), language: 'en' as const }
    await saveSettings(s)
    expect((await getSettings()).language).toBe('en')
  })
})

describe('backup', () => {
  test('export then import restores data', async () => {
    const a = newBill([{ id: 'p', name: 'P' }], defaults)
    await saveBill(a)
    await saveSettings({ ...(await getSettings()), language: 'en' })
    const json = await exportAll()
    await clear()
    expect(await listBills()).toEqual([])
    await importAll(json)
    expect(await getBill(a.id)).toEqual(a)
    expect((await getSettings()).language).toBe('en')
  })
  test('invalid backup is rejected and data untouched', async () => {
    const a = newBill([], defaults)
    await saveBill(a)
    await expect(importAll('{"foo":1}')).rejects.toThrow('invalid-backup')
    await expect(importAll('not json')).rejects.toThrow('invalid-backup')
    await expect(importAll('{"app":"harnkan","version":1,"settings":{},"bills":[{"x":1}]}')).rejects.toThrow(
      'invalid-backup',
    )
    expect((await listBills()).map((x) => x.id)).toEqual([a.id])
  })
})
