import { parseBaht } from '../../domain/money'
import type { Bill } from '../../domain/types'
import { useT } from '../../i18n'
import { Cell, Section, Segmented, Toggle } from '../../ui/kit'

export function ChargesSection({ bill, onChange }: { bill: Bill; onChange: (patch: Partial<Bill>) => void }) {
  const t = useT()
  const { serviceCharge: sc, vat, discount } = bill

  const discDisplay =
    discount.type === 'percent' ? String(discount.value) : discount.value > 0 ? String(discount.value / 100) : ''

  return (
    <Section header={t('editor.charges')}>
      <Cell
        label={t('editor.serviceCharge')}
        value={
          sc.enabled ? (
            <input
              className="input input-num"
              style={{ maxWidth: 64 }}
              inputMode="decimal"
              aria-label="Service charge %"
              value={String(sc.percent)}
              onChange={(e) =>
                onChange({ serviceCharge: { ...sc, percent: Math.max(0, Number(e.target.value) || 0) } })
              }
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
            <input
              className="input input-num"
              style={{ maxWidth: 64 }}
              inputMode="decimal"
              aria-label="VAT %"
              value={String(vat.percent)}
              onChange={(e) => onChange({ vat: { ...vat, percent: Math.max(0, Number(e.target.value) || 0) } })}
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
            value={discDisplay}
            onChange={(e) => {
              const raw = e.target.value
              const value =
                discount.type === 'percent' ? Math.max(0, Number(raw) || 0) : (parseBaht(raw) ?? 0)
              onChange({ discount: { ...discount, value } })
            }}
          />
        </div>
      )}
    </Section>
  )
}
