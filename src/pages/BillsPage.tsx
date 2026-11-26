import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { computeBill } from '../domain/calc'
import { newBill } from '../domain/factory'
import { formatBaht } from '../domain/money'
import type { Bill } from '../domain/types'
import { useT } from '../i18n'
import { deleteBill, getSettings, listBills, saveBill } from '../store/db'
import { Button, Cell, NavBar, Section } from '../ui/kit'

export default function BillsPage() {
  const t = useT()
  const nav = useNavigate()
  const [bills, setBills] = useState<Bill[]>([])
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    listBills().then(setBills)
  }, [])

  async function handleNew() {
    const s = await getSettings()
    const b = newBill([], s.defaults)
    await saveBill(b)
    nav(`/bill/${b.id}`)
  }

  async function handleDelete(id: string) {
    await deleteBill(id)
    setBills((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="page">
      <NavBar
        title={t('app.name')}
        left={
          bills.length > 0 ? (
            <Button onClick={() => setEditing((e) => !e)}>{editing ? t('common.done') : t('common.edit')}</Button>
          ) : undefined
        }
        right={<Button onClick={() => nav('/settings')}>{t('settings.title')}</Button>}
      />
      <div className="page-content">
        <h1 className="large-title">{t('bills.title')}</h1>
        <div style={{ margin: '12px 0' }}>
          <Button variant="primary" onClick={handleNew}>
            + {t('bills.new')}
          </Button>
        </div>

        {bills.length === 0 ? (
          <p className="muted center" style={{ marginTop: 48 }}>
            {t('bills.empty')}
          </p>
        ) : (
          <Section>
            {bills.map((b) => {
              const r = computeBill(b)
              const dateStr = b.createdAt.slice(0, 10)
              return (
                <Cell
                  key={b.id}
                  label={b.title.trim() || t('bills.untitled')}
                  sub={`${dateStr} · ${t('bills.people', { n: b.people.length })}`}
                  value={`${formatBaht(r.total)}`}
                  onClick={editing ? undefined : () => nav(`/bill/${b.id}`)}
                  accessory={
                    editing ? (
                      <Button variant="destructive" onClick={() => handleDelete(b.id)}>
                        {t('common.delete')}
                      </Button>
                    ) : undefined
                  }
                />
              )
            })}
          </Section>
        )}
      </div>
    </div>
  )
}
