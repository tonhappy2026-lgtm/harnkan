import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { defaultSettings, getSettings, saveSettings } from '../store/db'
import SettingsPage from './SettingsPage'

beforeEach(async () => {
  await clear()
  await saveSettings({ ...defaultSettings(), language: 'th' })
})

describe('SettingsPage', () => {
  test('validates PromptPay ID, saves normalized, and rejects invalid backup file', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider lang="th">
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    const input = await screen.findByPlaceholderText('หมายเลข PromptPay')
    await user.type(input, '081234567')
    expect(screen.getByText('หมายเลขไม่ถูกต้อง')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '081-234-5678')
    await waitFor(async () => {
      const s = await getSettings()
      expect(s.promptPay).toEqual({ type: 'phone', id: '0812345678' })
    })

    // Test bad import
    const fileInput = screen.getByLabelText('นำเข้าข้อมูล (Import)') as HTMLInputElement
    const badFile = new File(['{"invalid":true}'], 'bad.json', { type: 'application/json' })
    await user.upload(fileInput, badFile)
    await waitFor(() => expect(screen.getByText('ไฟล์สำรองข้อมูลไม่ถูกต้อง')).toBeInTheDocument())

    // Fix 6: Valid import updates PromptPay input field from imported settings
    const goodPayload = JSON.stringify({
      app: 'harnkan',
      version: 1,
      settings: {
        language: 'th',
        promptPay: { type: 'phone', id: '0899999999' },
        friends: [],
        defaults: { scPercent: 10, vatPercent: 7 },
      },
      bills: [],
    })
    const goodFile = new File([goodPayload], 'good.json', { type: 'application/json' })
    await user.upload(fileInput, goodFile)
    await waitFor(() => expect(input).toHaveValue('0899999999'))
  })
})
