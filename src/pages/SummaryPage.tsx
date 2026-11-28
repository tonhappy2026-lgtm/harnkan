import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { computeBill } from '../domain/calc'
import { formatBaht } from '../domain/money'
import { buildPromptPayPayload } from '../domain/promptpay'
import type { Bill, Settings, Settlement } from '../domain/types'
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
  const [qrSettlement, setQrSettlement] = useState<Settlement | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!id) return
    getBill(id).then((b) => b && setBill(b))
    getSettings().then(setSettings)
  }, [id])

  useEffect(() => {
    if (!qrSettlement || !settings?.promptPay) {
      setQrDataUrl('')
      return
    }
    const payload = buildPromptPayPayload(settings.promptPay.type, settings.promptPay.id, qrSettlement.amount)
    QRCode.toDataURL(payload, { margin: 1, width: 480 }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [qrSettlement, settings])

  if (!bill || !settings) return null

  const result = computeBill(bill)
  const nameOf = (pid: string) => bill.people.find((p) => p.id === pid)?.name ?? pid

  const isSettled = (s: Settlement) =>
    bill.paidIds.includes(`${s.fromId}->${s.toId}`) || bill.paidIds.includes(s.fromId)

  const outstanding = result.settlements.reduce((sum, s) => (isSettled(s) ? sum : sum + s.amount), 0)

  async function toggleSettlementPaid(s: Settlement) {
    if (!bill) return
    const key = `${s.fromId}->${s.toId}`
    const already = isSettled(s)
    const paidIds = already ? bill.paidIds.filter((x) => x !== key && x !== s.fromId) : [...bill.paidIds, key]
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
    // The share card lives inside <details>; open it while capturing so it is actually rendered.
    const d = detailsRef.current
    const wasOpen = d?.open ?? true
    if (d) d.open = true
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    try {
      await shareImage(cardRef.current, `harnkan-${bill.id.slice(0, 6)}.png`)
    } finally {
      if (d) d.open = wasOpen
    }
  }

  return (
    <div className="page">
      <NavBar
        title={t('summary.title')}
        left={<Button onClick={() => nav(`/bill/${bill.id}`)}>‹ {t('common.back')}</Button>}
        right={<Button onClick={() => nav('/')}>{t('common.done')}</Button>}
      />
      <div className="page-content">
        <h1 className="large-title">{bill.title.trim() || t('bills.untitled')}</h1>

        <Section header={t('summary.settlements')} footer={t('summary.tapForQr')}>
          {result.settlements.length === 0 ? (
            <Cell label={<span className="muted">{t('summary.allSettled')}</span>} />
          ) : (
            result.settlements.map((s) => {
              const done = isSettled(s)
              const fromName = nameOf(s.fromId)
              const toName = nameOf(s.toId)
              return (
                <div key={`${s.fromId}->${s.toId}`} className="cell cell-lg">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`${t('summary.paid')} ${fromName}`}
                    className="check"
                    style={{ width: 30, height: 30, fontSize: 18 }}
                    onClick={() => toggleSettlementPaid(s)}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1, textAlign: 'left', padding: '4px 0', color: 'inherit', fontSize: 17 }}
                    onClick={() => setQrSettlement(s)}
                  >
                    <div className={done ? 'strike' : ''}>
                      {t('summary.transferTo', { from: fromName, to: toName })}
                    </div>
                    <div className="cell-sub">{done ? t('summary.paid') : ''}</div>
                  </button>
                  <div className={`cell-value ${done ? 'strike' : ''}`}>{formatBaht(s.amount)}</div>
                </div>
              )
            })
          )}
          <Cell
            label={t('summary.outstanding')}
            value={<span className="hero-amount" data-testid="outstanding-total">{formatBaht(outstanding)}</span>}
          />
        </Section>

        <div style={{ display: 'flex', gap: 12, margin: '8px 0 16px' }}>
          <Button variant="tinted" style={{ flex: 1 }} onClick={handleCopyText}>
            {copied ? t('summary.copied') : t('summary.copyText')}
          </Button>
          <Button variant="primary" style={{ flex: 1 }} onClick={handleShareImage}>
            {t('summary.shareImage')}
          </Button>
        </div>

        <details className="details" ref={detailsRef}>
          <summary>{t('summary.details')}</summary>

          <Section header={t('summary.perPerson')}>
            {bill.people.map((p) => {
              const share = result.shares[p.id] ?? 0
              const paidAmt = result.paidByPerson[p.id] ?? 0
              return (
                <Cell
                  key={p.id}
                  label={p.name}
                  sub={`${t('summary.ate')} ${formatBaht(share)} · ${t('summary.alreadyPaid')} ${formatBaht(paidAmt)}`}
                  value={formatBaht(share)}
                />
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
          </Section>

          <div ref={cardRef} className="share-card">
            <h2>{bill.title.trim() || t('bills.untitled')}</h2>
            <div className="cell-sub" style={{ marginBottom: 12 }}>
              {t('app.name')} · {bill.createdAt.slice(0, 10)}
            </div>
            {bill.people.map((p) => {
              const paidAmt = result.paidByPerson[p.id] ?? 0
              return (
                <div key={p.id} className="share-row">
                  <span>
                    {p.name}{' '}
                    {paidAmt > 0 && (
                      <span className="muted">
                        ({t('summary.alreadyPaid')} {formatBaht(paidAmt)})
                      </span>
                    )}
                  </span>
                  <span>{formatBaht(result.shares[p.id] ?? 0)}</span>
                </div>
              )
            })}
            <div className="share-row total">
              <span>{t('summary.total')}</span>
              <span>{formatBaht(result.total)}</span>
            </div>
            {result.settlements.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--sep)' }}>
                <div className="cell-sub" style={{ marginBottom: 6, fontWeight: 600 }}>
                  {t('summary.settlements')}
                </div>
                {result.settlements.map((s) => {
                  const done = isSettled(s)
                  return (
                    <div key={`${s.fromId}->${s.toId}`} className="share-row">
                      <span className={done ? 'strike' : ''}>
                        {t('summary.transferTo', { from: nameOf(s.fromId), to: nameOf(s.toId) })}
                      </span>
                      <span className={done ? 'paid' : ''}>{formatBaht(s.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </details>
      </div>

      <Sheet open={qrSettlement !== null} onClose={() => setQrSettlement(null)}>
        {qrSettlement && (
          <div className="center">
            <h3 style={{ margin: '4px 0' }}>
              {t('summary.transferTo', { from: nameOf(qrSettlement.fromId), to: nameOf(qrSettlement.toId) })}
            </h3>
            <div className="total-value">{formatBaht(qrSettlement.amount)}</div>
            {settings.promptPay ? (
              <>
                <div className="cell-sub">{t('summary.scanToPay', { name: nameOf(qrSettlement.toId) })}</div>
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
