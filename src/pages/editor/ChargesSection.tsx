import { useEffect, useState } from 'react'
import { parseBaht } from '../../domain/money'
import type { Bill } from '../../domain/types'
import { useT } from '../../i18n'
import { Cell, Section, Segmented, Toggle } from '../../ui/kit'

function NumberDraftInput({
  value,
  ariaLabel,
  placeholder,
  maxWidth,
  onChange,
}: {
  value: number
  ariaLabel: string
  placeholder?: string
  maxWidth?: number
  onChange: (n: number) => void
}) {
  const [text, setText] = useState(() => (value > 0 ? String(value) : ''))
  useEffect(() => {
    const parsed = Number(text)
    if (text !== '' && !text.endsWith('.') && parsed !== value) {
      setText(value > 0 ? String(value) : '')
    }
  }, [value])

  return (
    <input
      className="input input-num"
      style={maxWidth ? { maxWidth } : undefined}
      inputMode="decimal"
      placeholder={placeholder ?? '0'}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const n = Number(raw)
        if (raw.trim() === '') onChange(0)
        else if (Number.isFinite(n) && n >= 0) onChange(n)
      }}
      onBlur={() => setText(value > 0 ? String(value) : '0')}
    />
  )
}

export function ChargesSection({ bill, onChange }: { bill: Bill; onChange: (patch: Partial<Bill>) => void }) {
  const t = useT()
  const { serviceCharge: sc, vat, discount } = bill

  const [discText, setDiscText] = useState(() =>
    discount.type === 'percent'
      ? discount.value > 0
        ? String(discount.value)
        : ''
      : discount.value > 0
        ? String(discount.value / 100)
        : '',
  )

  useEffect(() => {
    setDiscText(
      discount.type === 'percent'
        ? discount.value > 0
          ? String(discount.value)
          : ''
        : discount.value > 0
          ? String(discount.value / 100)
          : '',
    )
  }, [discount.type])

  return (
    <Section header={t('editor.charges')}>
      <Cell
        label={t('editor.serviceCharge')}
        value={
          sc.enabled ? (
            <NumberDraftInput
              value={sc.percent}
              ariaLabel="Service charge %"
              maxWidth={64}
              onChange={(percent) => onChange({ serviceCharge: { ...sc, percent } })}
            />
          ) : undefined
        }
        accessory={
          <Toggle
            label={t('editor.serviceCharge')}
            checked={sc.enabled}
            onChange={(enabled) => onChange({ serviceCharge: { ...sc, enabled } })}
          />
        }
      />

      <Cell
        label={t('editor.vat')}
        value={
          vat.enabled ? (
            <NumberDraftInput
              value={vat.percent}
              ariaLabel="VAT %"
              maxWidth={64}
              onChange={(percent) => onChange({ vat: { ...vat, percent } })}
            />
          ) : undefined
        }
        accessory={
          <Toggle
            label={t('editor.vat')}
            checked={vat.enabled}
            onChange={(enabled) => onChange({ vat: { ...vat, enabled } })}
          />
        }
      />

      {vat.enabled && (
        <Cell
          label={t('editor.vatInclusive')}
          accessory={
            <Toggle
              label={t('editor.vatInclusive')}
              checked={vat.inclusive}
              onChange={(inclusive) => onChange({ vat: { ...vat, inclusive } })}
            />
          }
        />
      )}

      <Cell
        label={t('editor.discount')}
        accessory={
          <Toggle
            label={t('editor.discount')}
            checked={discount.enabled}
            onChange={(enabled) => onChange({ discount: { ...discount, enabled } })}
          />
        }
      />

      {discount.enabled && (
        <div className="cell" style={{ gap: 8 }}>
          <div style={{ width: 140 }}>
            <Segmented
              value={discount.type}
              options={[
                { value: 'amount', label: t('editor.discountAmount') },
                { value: 'percent', label: t('editor.discountPercent') },
              ]}
              onChange={(type) => onChange({ discount: { ...discount, type, value: 0 } })}
            />
          </div>
          <input
            className="input input-num"
            inputMode="decimal"
            placeholder="0"
            aria-label={t('editor.discount')}
            data-testid="discount-input"
            value={discText}
            onChange={(e) => {
              const raw = e.target.value
              setDiscText(raw)
              if (!raw.trim()) {
                onChange({ discount: { ...discount, value: 0 } })
                return
              }
              if (discount.type === 'percent') {
                const n = Number(raw)
                if (Number.isFinite(n) && n >= 0) onChange({ discount: { ...discount, value: n } })
              } else {
                const parsed = parseBaht(raw)
                if (parsed !== null) onChange({ discount: { ...discount, value: parsed } })
              }
            }}
          />
        </div>
      )}
    </Section>
  )
}
