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
        const parsed = parseBaht(v)
        onChange(parsed ?? 0)
      }}
      onBlur={() => {
        if (satang > 0) setText(formatBaht(satang).replace(/\.00$/, ''))
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
    // Keep exact array; if all selected, normalize to [] (everyone)
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
              <input
                className="input input-num"
                style={{ maxWidth: 48 }}
                inputMode="numeric"
                aria-label={t('editor.qty')}
                value={String(it.qty)}
                onChange={(e) => {
                  const n = Math.max(1, parseInt(e.target.value || '1', 10) || 1)
                  updateItem(it.id, { qty: n })
                }}
              />
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
