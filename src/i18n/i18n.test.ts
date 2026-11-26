import { describe, expect, test } from 'vitest'
import th from './th.json'
import en from './en.json'
import { translate } from './index'

const keys = (o: object) => Object.keys(o).sort()

describe('i18n', () => {
  test('th and en have identical keys', () => {
    expect(keys(th)).toEqual(keys(en))
  })
  test('no empty strings', () => {
    for (const v of [...Object.values(th), ...Object.values(en)]) expect(v).not.toBe('')
  })
  test('app name', () => {
    expect(translate('th', 'app.name')).toBe('หารกัน')
    expect(translate('en', 'app.name')).toBe('HarnKan')
  })
  test('interpolation', () => {
    expect(translate('en', 'bills.people', { n: 3 })).toBe('3 people')
    expect(translate('th', 'bills.people', { n: 3 })).toBe('3 คน')
  })
  test('unknown key returns key', () => {
    expect(translate('en', 'nope.key')).toBe('nope.key')
  })
})
