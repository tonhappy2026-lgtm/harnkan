import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { computeBill } from '../domain/calc'
import { formatBaht } from '../domain/money'
import { buildPromptPayPayload } from '../domain/promptpay'
import type { Bill, Person, Settings } from '../domain/types'
import { useT } from '../i18n'
import { shareImage } from '../share/shareImage'
import { buildShareText } from '../share/shareText'
import { getBill, getSettings, saveBill } from '../store/db'
import { Button, Cell, NavBar, Section, Sheet } from '../ui/kit'

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const t = useT()
  const [bill, setBill] = useState<Bill | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [qrPerson, setQrPerson] = useState<Person | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    getBill(id).then((b) => b && setBill(b))
    getSettings().then(setSettings)
  }, [id])

  useEffect(() => {
    if (!qrPerson || !bill || !settings?.promptPay) {
      setQrDataUrl('')
      return
    }
    const r = computeBill(bill)
    const amt = r.shares[qrPerson.id] ?? 0
    const payload = buildPromptPayPayload(settings.promptPay.type, settings.promptPay.id, amt)
    QRCode.toDataURL(payload, { margin: 1, width: 480 }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [qrPerson, bill, settings])

  if (!bill || !settings) return null

  const result = computeBill(bill)
  const payer = bill.people.find((p) => p.id === bill.payerId)

  const outstanding = bill.people.reduce((sum, p) => {
    if (p.id === bill.payerId || bill.paidIds.includes(p.id)) return sum
    return sum + (result.shares[p.id] ?? 0)
  }, 0)

  async function togglePaid(personId: string) {
    if (!bill) return
    const exists = bill.paidIds.includes(personId)
    const paidIds = exists ? bill.paidIds.filter((x) => x !== personId) : [...bill.paidIds, personId]
    const next = { ...bill, paidIds }
    setBill(next)
    await saveBill(next)
  }

  async function handleCopyText() {
    if (!bill) return
    const text = buildShareText(bill, result, t)
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      // ignore in test env
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleShareImage() {
    if (!cardRef.current || !bill) return
    await shareImage(cardRef.current, `harnkan-${bill.id.slice(0, 6)}.png`)
  }

  return (
    <div className="page">
      <NavBar
        title={t('summary.title')}
        left={<Button onClick={() => nav(`/bill/${bill.id}`)}>‹ {t('common.back')}</Button>}
        right={<Button onClick={() => nav('/')}>{t('common.done')}</Button>}
      />
      <div className="page-content">
        <div ref={cardRef} className="share-card">
          <h2>{bill.title.trim() || t('bills.untitled')}</h2>
          <div className="cell-sub" style={{ marginBottom: 12 }}>
            {t('app.name')} · {bill.createdAt.slice(0, 10)}
          </div>
          {bill.people.map((p) => {
            const isPayer = p.id === bill.payerId
            const isPaid = isPayer || bill.paidIds.includes(p.id)
            return (
              <div key={p.id} className="share-row">
                <span>
                  {p.name}{' '}
                  {isPayer ? (
                    <span className="muted">({t('summary.payer')})</span>
                  ) : isPaid ? (
                    <span className="paid">({t('summary.paid')})</span>
                  ) : null}
                </span>
                <span>{formatBaht(result.shares[p.id] ?? 0)}</span>
              </div>
            )
          })}
          <div className="share-row total">
            <span>{t('summary.total')}</span>
            <span>{formatBaht(result.total)}</span>
          </div>
          {payer && (
            <div className="cell-sub" style={{ marginTop: 8 }}>
              {t('share.payTo', { name: payer.name })}
            </div>
          )}
        </div>

        <Section header={t('summary.perPerson')} footer={t('summary.tapForQr')}>
          {bill.people.map((p) => {
            const isPayer = p.id === bill.payerId
            const isPaid = isPayer || bill.paidIds.includes(p.id)
            const amt = result.shares[p.id] ?? 0
            return (
              <div key={p.id} className="cell">
                {!isPayer && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isPaid}
                    aria-label={`${t('summary.paid')} ${p.name}`}
                    className="check"
                    onClick={() => togglePaid(p.id)}
                  >
                    {isPaid ? '✓' : ''}
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, textAlign: 'left', padding: '4px 0', color: 'inherit' }}
                  onClick={() => !isPayer && setQrPerson(p)}
                  disabled={isPayer}
                >
                  <div className={isPaid && !isPayer ? 'strike' : ''}>{p.name}</div>
                  <div className="cell-sub">{isPayer ? t('summary.payer') : isPaid ? t('summary.paid') : ''}</div>
                </button>
                <div className="cell-value">{formatBaht(amt)}</div>
              </div>
            )
          })}
        </Section>

        <Section>
          <Cell label={t('summary.subtotal')} value={formatBaht(result.subtotal)} />
          {result.discount > 0 && <Cell label={t('summary.discount')} value={`-${formatBaht(result.discount)}`} />}
          {bill.serviceCharge.enabled && (
            <Cell
              label={t('summary.serviceCharge', { p: bill.serviceCharge.percent })}
              value={formatBaht(result.serviceCharge)}
            />
          )}
          {bill.vat.enabled && !bill.vat.inclusive && (
            <Cell label={t('summary.vat', { p: bill.vat.percent })} value={formatBaht(result.vatAdded)} />
          )}
          {bill.vat.enabled && bill.vat.inclusive && (
            <Cell label={t('summary.vatIncluded', { p: bill.vat.percent })} value={formatBaht(result.vatIncluded)} />
          )}
          <Cell label={<strong>{t('summary.total')}</strong>} value={<strong>{formatBaht(result.total)}</strong>} />
          <Cell
            label={t('summary.outstanding')}
            value={<span data-testid="outstanding-total">{formatBaht(outstanding)}</span>}
          />
        </Section>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button variant="tinted" style={{ flex: 1 }} onClick={handleCopyText}>
            {copied ? t('summary.copied') : t('summary.copyText')}
          </Button>
          <Button variant="primary" style={{ flex: 1 }} onClick={handleShareImage}>
            {t('summary.shareImage')}
          </Button>
        </div>
      </div>

      <Sheet open={qrPerson !== null} onClose={() => setQrPerson(null)}>
        {qrPerson && (
          <div className="center">
            <h3 style={{ margin: '4px 0' }}>{qrPerson.name}</h3>
            <div className="total-value">{formatBaht(result.shares[qrPerson.id] ?? 0)}</div>
            {settings.promptPay ? (
              <>
                {payer && <div className="cell-sub">{t('summary.scanToPay', { name: payer.name })}</div>}
                {qrDataUrl && <img className="qr" src={qrDataUrl} alt="PromptPay QR" />}
                <div className="cell-sub">{settings.promptPay.id}</div>
              </>
            ) : (
              <div style={{ margin: '20px 0' }}>
                <p className="muted">{t('summary.noPromptPay')}</p>
                <Button variant="primary" onClick={() => nav('/settings')}>
                  {t('summary.setupPromptPay')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
