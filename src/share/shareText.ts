import { formatBaht } from '../domain/money'
import type { Bill, BillResult } from '../domain/types'
import type { T } from '../i18n'

export function buildShareText(bill: Bill, result: BillResult, t: T): string {
  const title = bill.title.trim() || t('bills.untitled')
  const payer = bill.people.find((p) => p.id === bill.payerId)
  const lines: string[] = [`${t('app.name')} — ${title}`]
  for (const p of bill.people) {
    const amt = formatBaht(result.shares[p.id] ?? 0)
    const paid = p.id === bill.payerId || bill.paidIds.includes(p.id)
    const tag = p.id === bill.payerId ? ` (${t('summary.payer')})` : paid ? ` (${t('summary.paid')})` : ''
    lines.push(`${p.name}: ${amt}${tag}`)
  }
  lines.push(`${t('share.total')} ${formatBaht(result.total)}`)
  if (payer) lines.push(t('share.payTo', { name: payer.name }))
  return lines.join('\n')
}
