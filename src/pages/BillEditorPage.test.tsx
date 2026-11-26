import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { newBill } from '../domain/factory'
import { saveBill, saveSettings, defaultSettings } from '../store/db'
import BillEditorPage from './BillEditorPage'

beforeEach(async () => {
  await clear()
  await saveSettings({ ...defaultSettings(), language: 'th' })
})

describe('BillEditorPage', () => {
  test('renders 3 people in itemized mode, calculates total with SC10/VAT7, toggles SC and VAT inclusive', async () => {
    const bill = {
      ...newBill(
        [
          { id: 'A', name: 'A' },
          { id: 'B', name: 'B' },
          { id: 'C', name: 'C' },
        ],
        { scPercent: 10, vatPercent: 7 },
      ),
      id: 'b1',
      mode: 'itemized' as const,
      items: [],
    }
    await saveBill(bill)

    const user = userEvent.setup()
    render(
      <I18nProvider lang="th">
        <MemoryRouter initialEntries={['/bill/b1']}>
          <Routes>
            <Route path="/bill/:id" element={<BillEditorPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText(/\+ เพิ่มรายการ/)).toBeInTheDocument())
    await user.click(screen.getByText(/\+ เพิ่มรายการ/))

    const nameInput = screen.getByPlaceholderText('ชื่อเมนู')
    const priceInput = screen.getByLabelText('ราคา')
    await user.type(nameInput, 'หมูกระทะ')
    await user.clear(priceInput)
    await user.type(priceInput, '900')

    // SC 10% + VAT 7% on 900 -> 900 + 90 = 990 + 69.30 = 1,059.30
    await waitFor(() => expect(screen.getByTestId('editor-total')).toHaveTextContent('1,059.30'))

    // Toggle SC off -> 900 + 63 = 963.00
    const scToggle = screen.getByRole('switch', { name: 'Service charge' })
    await user.click(scToggle)
    await waitFor(() => expect(screen.getByTestId('editor-total')).toHaveTextContent('963.00'))

    // Toggle "ราคารวม VAT แล้ว" on -> 900.00
    const vatIncToggle = screen.getByRole('switch', { name: 'ราคารวม VAT แล้ว' })
    await user.click(vatIncToggle)
    await waitFor(() => expect(screen.getByTestId('editor-total')).toHaveTextContent('900.00'))

    // Fix 1: Decimal discount typing ("12.50") must not wipe on '.'
    const discToggle = screen.getByRole('switch', { name: 'ส่วนลด' })
    await user.click(discToggle)
    const discInput = screen.getByTestId('discount-input')
    await user.type(discInput, '12.50')
    await waitFor(() => expect(screen.getByTestId('editor-total')).toHaveTextContent('887.50'))

    // Fix 2: Deselecting B and C leaves A; clicking A again must not flip back to Everyone
    await user.click(screen.getByRole('button', { name: 'B' }))
    await user.click(screen.getByRole('button', { name: 'C' }))
    const btnA = screen.getByRole('button', { name: 'A' })
    expect(btnA).toHaveAttribute('aria-pressed', 'true')
    await user.click(btnA)
    expect(btnA).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'ทุกคน' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('computes total immediately even before adding people, and auto-adds typed person name on blur', async () => {
    const bill = {
      ...newBill([], { scPercent: 10, vatPercent: 7 }),
      id: 'b2',
      mode: 'equal' as const,
    }
    await saveBill(bill)

    const user = userEvent.setup()
    render(
      <I18nProvider lang="th">
        <MemoryRouter initialEntries={['/bill/b2']}>
          <Routes>
            <Route path="/bill/:id" element={<BillEditorPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    const amountInput = await screen.findByLabelText('ยอดอาหาร (บาท)')
    await user.type(amountInput, '1000')
    // 1000 + 10% SC (100) + 7% VAT (77) = 1,177.00 even with 0 people
    await waitFor(() => expect(screen.getByTestId('editor-total')).toHaveTextContent('1,177.00'))

    // Typing a person name and blurring (tapping elsewhere) auto-adds the person
    const personInput = screen.getByPlaceholderText('ชื่อ')
    await user.type(personInput, 'ต้น')
    await user.tab()
    await waitFor(() => expect(screen.getByText('ต้น')).toBeInTheDocument())
  })
})
