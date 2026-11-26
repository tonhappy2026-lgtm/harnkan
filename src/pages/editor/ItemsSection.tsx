import { useState } from 'react'
import { newItem } from '../../domain/factory'
import { formatBaht, parseBaht, type Satang } from '../../domain/money'
import type { Bill, Item } from '../../domain/types'
import { useT } from '../../i18n'
import { Button, Section } from '../../ui/kit'

function MoneyInput({
  satang,
  placeholder,
  ariaLabel,
  onChange,
}: {
  satang: Satang
  placeholder?: string
  ariaLabel?: string
  onChange: (s: Satang) => void
}) {
  const [text, setText] = useState(() => (satang > 0 ? (satang / 100).toString() : ''))
  return (
    <input
      className="input input-num"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        if (!v.trim()) {
          onChange(0)
          return
        }
        const parsed = parseBaht(v)
        if (parsed !== null) onChange(parsed)
      }}
      onBlur={() => {
        setText(satang > 0 ? formatBaht(satang).replace(/\.00$/, '') : '')
      }}
    />
  )
}

function QtyInput({ qty, ariaLabel, onChange }: { qty: number; ariaLabel: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => String(qty))
  return (
    <input
      className="input input-num"
      style={{ maxWidth: 48 }}
      inputMode="numeric"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const n = parseInt(raw, 10)
        if (Number.isFinite(n) && n >= 1) onChange(n)
      }}
      onBlur={() => {
        const n = parseInt(text, 10)
        const valid = Number.isFinite(n) && n >= 1 ? n : 1
        onChange(valid)
        setText(String(valid))
      }}
    />
  )
}

export function ItemsSection({ bill, onChange }: { bill: Bill; onChange: (patch: Partial<Bill>) => void }) {
  const t = useT()

  if (bill.mode === 'equal') {
    return (
      <Section header={t('editor.amount')}>
        <div className="cell">
          <span className="cell-label">{t('editor.amount')}</span>
          <MoneyInput
            satang={bill.equalTotal}
            placeholder="0.00"
            ariaLabel={t('editor.amount')}
            onChange={(equalTotal) => onChange({ equalTotal })}
          />
        </div>
      </Section>
    )
  }

  function updateItem(id: string, patch: Partial<Item>) {
    onChange({
      items: bill.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    })
  }

  function removeItem(id: string) {
    onChange({ items: bill.items.filter((it) => it.id !== id) })
  }

  function toggleConsumer(item: Item, personId: string) {
    const allIds = bill.people.map((p) => p.id)
    const current = item.consumerIds.length === 0 ? allIds : item.consumerIds.filter((id) => allIds.includes(id))
    const exists = current.includes(personId)
    const next = exists ? current.filter((id) => id !== personId) : [...current, personId]
    // Do not allow deselecting the last remaining person via chip toggle (prevents accidental flip to Everyone)
    if (next.length === 0) return
    const normalized = next.length === allIds.length ? [] : next
    updateItem(item.id, { consumerIds: normalized })
  }

  return (
    <Section header={t('editor.items')}>
      {bill.items.map((it) => {
        const allSelected = it.consumerIds.length === 0
        return (
          <div key={it.id} className="cell" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                placeholder={t('editor.itemName')}
                value={it.name}
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
              />
              <MoneyInput
                satang={it.unitPrice}
                placeholder={t('editor.price')}
                ariaLabel={t('editor.price')}
                onChange={(unitPrice) => updateItem(it.id, { unitPrice })}
              />
              <QtyInput qty={it.qty} ariaLabel={t('editor.qty')} onChange={(qty) => updateItem(it.id, { qty })} />
              <Button variant="destructive" onClick={() => removeItem(it.id)}>
                {t('common.delete')}
              </Button>
            </div>
            {bill.people.length > 0 && (
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={allSelected}
                  onClick={() => updateItem(it.id, { consumerIds: [] })}
                >
                  {t('editor.everyone')}
                </button>
                {bill.people.map((p) => {
                  const active = allSelected || it.consumerIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="chip"
                      aria-pressed={active}
                      onClick={() => toggleConsumer(it, p.id)}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className="cell">
        <Button onClick={() => onChange({ items: [...bill.items, newItem()] })}>+ {t('editor.addItem')}</Button>
      </div>
    </Section>
  )
}
