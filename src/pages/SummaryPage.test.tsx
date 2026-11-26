import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import type { Bill } from '../domain/types'
import { defaultSettings, saveBill, saveSettings } from '../store/db'
import SummaryPage from './SummaryPage'

const fixtureBill: Bill = {
  id: 'b1',
  title: 'หมูกระทะศุกร์',
  createdAt: '2026-11-26T00:00:00.000Z',
  mode: 'itemized',
  people: [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  payerId: 'A',
  equalTotal: 0,
  items: [
    { id: '1', name: 'หมูกระทะ', unitPrice: 90000, qty: 1, consumerIds: [] },
    { id: '2', name: 'เบียร์', unitPrice: 30000, qty: 1, consumerIds: ['A', 'B'] },
  ],
  serviceCharge: { enabled: true, percent: 10 },
  vat: { enabled: true, percent: 7, inclusive: false },
  discount: { enabled: false, type: 'amount', value: 0 },
  paidIds: [],
}

beforeEach(async () => {
  await clear()
  await saveSettings({ ...defaultSettings(), language: 'th', promptPay: { type: 'phone', id: '0812345678' } })
  await saveBill(fixtureBill)
})

describe('SummaryPage', () => {
  test('toggling paid on C updates outstanding to B only (529.65)', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider lang="th">
        <MemoryRouter initialEntries={['/bill/b1/summary']}>
          <Routes>
            <Route path="/bill/:id/summary" element={<SummaryPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    // Initial outstanding: B (529.65) + C (353.10) = 882.75 (payer A excluded)
    await waitFor(() => expect(screen.getByTestId('outstanding-total')).toHaveTextContent('882.75'))

    const cCheckbox = screen.getByRole('checkbox', { name: 'จ่ายแล้ว C' })
    await user.click(cCheckbox)

    await waitFor(() => expect(screen.getByTestId('outstanding-total')).toHaveTextContent('529.65'))
  })
})
