import { useState } from 'react'
import { newPerson } from '../../domain/factory'
import { formatBaht, parseBaht, type Satang } from '../../domain/money'
import type { Bill, Person } from '../../domain/types'
import { useT } from '../../i18n'
import { Button, Cell, Section, Toggle } from '../../ui/kit'

function PaidInput({
  satang,
  placeholder,
  ariaLabel,
  onChange,
}: {
  satang: Satang
  placeholder: string
  ariaLabel: string
  onChange: (s: Satang) => void
}) {
  const [text, setText] = useState(() => (satang > 0 ? (satang / 100).toString() : ''))
  return (
    <input
      className="input input-num input-box"
      style={{ width: 100 }}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
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

export function PeopleSection({
  bill,
  friends,
  onChange,
}: {
  bill: Bill
  friends: Person[]
  onChange: (patch: Partial<Bill>) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [multiPay, setMultiPay] = useState(() => Object.values(bill.paidAmounts ?? {}).some((v) => v > 0))

  function addPersonByName(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    const p = newPerson(trimmed)
    const people = [...bill.people, p]
    const payerId = bill.payerId && people.some((x) => x.id === bill.payerId) ? bill.payerId : p.id
    onChange({ people, payerId })
    setName('')
  }

  function addFriend(f: Person) {
    if (bill.people.some((p) => p.id === f.id || p.name === f.name)) return
    const people = [...bill.people, { id: f.id, name: f.name }]
    const payerId = bill.payerId && people.some((x) => x.id === bill.payerId) ? bill.payerId : f.id
    onChange({ people, payerId })
  }

  function removePerson(id: string) {
    const people = bill.people.filter((p) => p.id !== id)
    const payerId = bill.payerId === id ? (people[0]?.id ?? '') : bill.payerId
    const paidIds = bill.paidIds.filter((pid) => pid !== id)
    const paidAmounts = { ...(bill.paidAmounts ?? {}) }
    delete paidAmounts[id]
    onChange({ people, payerId, paidIds, paidAmounts })
  }

  function setPersonPaid(personId: string, amount: Satang) {
    onChange({ paidAmounts: { ...(bill.paidAmounts ?? {}), [personId]: amount } })
  }

  function toggleMultiPay(on: boolean) {
    setMultiPay(on)
    if (!on) onChange({ paidAmounts: {} })
  }

  const unusedFriends = friends.filter((f) => !bill.people.some((p) => p.id === f.id || p.name === f.name))

  return (
    <>
      <Section header={t('editor.people')} footer={bill.people.length > 0 ? t('editor.payerHint') : undefined}>
        {bill.people.map((p) => {
          const isPayer = bill.payerId === p.id
          return (
            <div key={p.id} className="cell">
              <button
                type="button"
                className="btn"
                aria-label={`${t('editor.setPayer')} ${p.name}`}
                onClick={() => onChange({ payerId: p.id })}
                style={{ padding: '4px 8px', fontSize: 22 }}
              >
                <span className={isPayer ? 'payer-star' : 'muted'}>{isPayer ? '★' : '☆'}</span>
              </button>
              <div className="cell-label">
                <div>{p.name}</div>
                {isPayer && <div className="cell-sub">{t('editor.payer')}</div>}
              </div>
              {multiPay && (
                <PaidInput
                  satang={bill.paidAmounts?.[p.id] ?? 0}
                  placeholder={t('editor.paidAmount')}
                  ariaLabel={`${t('editor.paidAmount')} ${p.name}`}
                  onChange={(amt) => setPersonPaid(p.id, amt)}
                />
              )}
              <Button variant="destructive" onClick={() => removePerson(p.id)}>
                {t('common.delete')}
              </Button>
            </div>
          )
        })}
        <div className="cell">
          <input
            className="input"
            placeholder={t('editor.personPlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim()) addPersonByName(name)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPersonByName(name)
              }
            }}
          />
          <Button onClick={() => addPersonByName(name)} disabled={!name.trim()}>
            {t('editor.addPerson')}
          </Button>
        </div>
        {unusedFriends.length > 0 && (
          <div className="cell" style={{ flexWrap: 'wrap' }}>
            <span className="cell-sub" style={{ marginRight: 6 }}>
              {t('editor.friends')}:
            </span>
            <div className="chips">
              {unusedFriends.map((f) => (
                <button key={f.id} type="button" className="chip" onClick={() => addFriend(f)}>
                  + {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {bill.people.length > 1 && (
        <Section footer={multiPay ? t('editor.paidHint') : undefined}>
          <Cell
            label={t('editor.multiPay')}
            accessory={<Toggle label={t('editor.multiPay')} checked={multiPay} onChange={toggleMultiPay} />}
          />
        </Section>
      )}
    </>
  )
}
