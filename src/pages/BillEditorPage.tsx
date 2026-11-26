import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { computeBill } from '../domain/calc'
import { formatBaht } from '../domain/money'
import type { Bill, Person, SplitMode } from '../domain/types'
import { useT } from '../i18n'
import { getBill, getSettings, saveBill } from '../store/db'
import { Button, NavBar, Section, Segmented } from '../ui/kit'
import { ChargesSection } from './editor/ChargesSection'
import { ItemsSection } from './editor/ItemsSection'
import { PeopleSection } from './editor/PeopleSection'

export default function BillEditorPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const t = useT()
  const [bill, setBill] = useState<Bill | null>(null)
  const [friends, setFriends] = useState<Person[]>([])

  useEffect(() => {
    if (!id) return
    getBill(id).then((b) => {
      if (b) setBill(b)
    })
    getSettings().then((s) => setFriends(s.friends))
  }, [id])

  useEffect(() => {
    if (!bill) return
    const timer = setTimeout(() => {
      saveBill(bill)
    }, 150)
    return () => clearTimeout(timer)
  }, [bill])

  if (!bill) return null

  const result = computeBill(bill)

  function update(patch: Partial<Bill>) {
    setBill((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function goBack() {
    if (bill) await saveBill(bill)
    nav('/')
  }

  async function goSummary() {
    if (!bill) return
    await saveBill(bill)
    nav(`/bill/${bill.id}/summary`)
  }

  return (
    <div className="page">
      <NavBar
        title={t('editor.title')}
        left={<Button onClick={goBack}>‹ {t('common.back')}</Button>}
        right={
          <Button onClick={goSummary} disabled={bill.people.length === 0}>
            {t('editor.viewSummary')}
          </Button>
        }
      />
      <div className="page-content">
        <Section header={t('editor.billName')}>
          <div className="cell">
            <input
              className="input"
              placeholder={t('editor.billNamePlaceholder')}
              value={bill.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>
        </Section>

        <PeopleSection bill={bill} friends={friends} onChange={update} />

        <Section header={t('editor.mode')}>
          <div className="cell">
            <Segmented<SplitMode>
              value={bill.mode}
              options={[
                { value: 'equal', label: t('editor.modeEqual') },
                { value: 'itemized', label: t('editor.modeItemized') },
              ]}
              onChange={(mode) => update({ mode })}
            />
          </div>
        </Section>

        <ItemsSection bill={bill} onChange={update} />

        {result.unassignedItemIds.length > 0 && (
          <div className="banner" role="alert">
            {t('editor.unassigned', { n: result.unassignedItemIds.length })}
          </div>
        )}

        <ChargesSection bill={bill} onChange={update} />
      </div>

      <div className="bottombar">
        <div className="bottombar-inner">
          <div style={{ flex: 1 }}>
            <div className="total-label">{t('editor.total')}</div>
            <div className="total-value" data-testid="editor-total">
              {formatBaht(result.total)}
            </div>
          </div>
          <Button
            variant="primary"
            style={{ width: 'auto' }}
            disabled={bill.people.length === 0}
            onClick={goSummary}
          >
            {bill.people.length === 0 ? t('editor.needPeople') : t('editor.viewSummary')}
          </Button>
        </div>
      </div>
    </div>
  )
}
