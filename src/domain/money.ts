/** Integer number of satang (1 baht = 100 satang). */
export type Satang = number

const AMOUNT_RE = /^\d+(\.\d+)?$/

/** Parse a user-entered baht amount ("1,200.50") into satang. Returns null if invalid or negative. */
export function parseBaht(input: string): Satang | null {
  const s = input.trim().replace(/,/g, '')
  if (!AMOUNT_RE.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  const satang = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  // round half up on the third decimal
  const roundUp = frac.length > 2 && Number(frac[2]) >= 5 ? 1 : 0
  const result = satang + roundUp
  return Number.isSafeInteger(result) ? result : null
}

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatBaht(s: Satang): string {
  return fmt.format(s / 100)
}

/**
 * Split `total` proportionally to `weights` using largest-remainder so the parts sum to `total` exactly.
 * Ties go to the lower index. All-zero weights yield zeros.
 */
export function allocate(total: Satang, weights: number[]): Satang[] {
  const sumW = weights.reduce((a, b) => a + b, 0)
  if (sumW <= 0 || total <= 0) return weights.map(() => 0)
  const parts = weights.map((w) => Math.floor((total * w) / sumW))
  const rems = weights.map((w, i) => ({ i, r: (total * w) % sumW }))
  let left = total - parts.reduce((a, b) => a + b, 0)
  rems.sort((a, b) => b.r - a.r || a.i - b.i)
  for (let k = 0; left > 0 && k < rems.length; k++, left--) parts[rems[k].i] += 1
  return parts
}
