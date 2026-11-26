import { useState } from 'react'
import { newPerson } from '../../domain/factory'
import type { Bill, Person } from '../../domain/types'
import { useT } from '../../i18n'
import { Button, Cell, Section } from '../../ui/kit'

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
    onChange({ people, payerId, paidIds })
  }

  const unusedFriends = friends.filter((f) => !bill.people.some((p) => p.id === f.id || p.name === f.name))

  return (
    <Section header={t('editor.people')}>
      {bill.people.map((p) => {
        const isPayer = bill.payerId === p.id
        return (
          <Cell
            key={p.id}
            leading={
              <button
                type="button"
                className="btn"
                aria-label={`${t('editor.setPayer')} ${p.name}`}
                onClick={() => onChange({ payerId: p.id })}
                style={{ padding: '4px 6px' }}
              >
                <span className={isPayer ? 'payer-star' : 'muted'}>{isPayer ? '★' : '☆'}</span>
              </button>
            }
            label={p.name}
            sub={isPayer ? t('editor.payer') : undefined}
            accessory={
              <Button variant="destructive" onClick={() => removePerson(p.id)}>
                {t('common.delete')}
              </Button>
            }
          />
        )
      })}
      <div className="cell">
        <input
          className="input"
          placeholder={t('editor.personPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
  )
}
