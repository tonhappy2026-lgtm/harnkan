import type { Satang } from './money'
import type { PromptPayType } from './types'

export type { PromptPayType }

/** Normalize to the canonical digits for the given PromptPay type, or null if invalid. Phone returns 0XXXXXXXXX. */
export function normalizePromptPayId(type: PromptPayType, raw: string): string | null {
  let d = raw.replace(/[^\d]/g, '')
  switch (type) {
    case 'phone':
      if (d.length === 11 && d.startsWith('66')) d = '0' + d.slice(2)
      return /^0\d{9}$/.test(d) ? d : null
    case 'nationalId':
      return /^\d{13}$/.test(d) ? d : null
    case 'ewallet':
      return /^\d{15}$/.test(d) ? d : null
  }
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 uppercase hex chars. */
export function crc16(s: string): string {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value

/** Build an EMVCo Thai QR (PromptPay) payload with a fixed amount. `id` must already be normalized. */
export function buildPromptPayPayload(type: PromptPayType, id: string, amount: Satang): string {
  const target =
    type === 'phone'
      ? tlv('01', ('0000000000000' + '66' + id.replace(/^0/, '')).slice(-13))
      : tlv(type === 'nationalId' ? '02' : '03', id)
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('29', tlv('00', 'A000000677010111') + target) +
    tlv('58', 'TH') +
    tlv('53', '764') +
    tlv('54', (amount / 100).toFixed(2)) +
    '6304'
  return body + crc16(body)
}
