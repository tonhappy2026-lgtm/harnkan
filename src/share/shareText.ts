import { formatBaht } from '../domain/money'
import type { Bill, BillResult } from '../domain/types'
import type { T } from '../i18n'

export function buildShareText(bill: Bill, result: BillResult, t: T): string {
  const title = bill.title.trim() || t('bills.untitled')
  const nameOf = (id: string) => bill.people.find((p) => p.id === id)?.name ?? id
  const lines: string[] = [`${t('app.name')} — ${title}`]

  for (const p of bill.people) {
    const share = formatBaht(result.shares[p.id] ?? 0)
    const paidAmt = result.paidByPerson[p.id] ?? 0
    const paidPart = paidAmt > 0 ? ` (${t('summary.alreadyPaid')} ${formatBaht(paidAmt)})` : ''
    lines.push(`${p.name}: ${share}${paidPart}`)
  }

  lines.push(`${t('share.total')} ${formatBaht(result.total)}`)

  if (result.settlements.length > 0) {
    lines.push(`--- ${t('summary.settlements')} ---`)
    for (const s of result.settlements) {
      const key = `${s.fromId}->${s.toId}`
      const isDone = bill.paidIds.includes(key) || bill.paidIds.includes(s.fromId)
      const doneTag = isDone ? ` (${t('summary.paid')})` : ''
      lines.push(`${t('summary.transferTo', { from: nameOf(s.fromId), to: nameOf(s.toId) })}: ${formatBaht(s.amount)}${doneTag}`)
    }
  }
  return lines.join('\n')
}
