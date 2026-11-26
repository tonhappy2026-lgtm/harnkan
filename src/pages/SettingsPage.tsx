import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { newPerson } from '../domain/factory'
import { normalizePromptPayId } from '../domain/promptpay'
import type { PromptPayType, Settings } from '../domain/types'
import { useT, type Lang } from '../i18n'
import { exportAll, getSettings, importAll, saveSettings } from '../store/db'
import { Button, Cell, NavBar, Section, Segmented } from '../ui/kit'

export default function SettingsPage({ onLangChange }: { onLangChange?: (lang: Lang) => void }) {
  const nav = useNavigate()
  const t = useT()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ppType, setPpType] = useState<PromptPayType>('phone')
  const [ppRaw, setPpRaw] = useState('')
  const [scText, setScText] = useState('10')
  const [vatText, setVatText] = useState('7')
  const [friendName, setFriendName] = useState('')
  const [importStatus, setImportStatus] = useState<'ok' | 'err' | null>(null)

  function syncFromSettings(s: Settings) {
    setSettings(s)
    setPpType(s.promptPay?.type ?? 'phone')
    setPpRaw(s.promptPay?.id ?? '')
    setScText(String(s.defaults.scPercent))
    setVatText(String(s.defaults.vatPercent))
  }

  useEffect(() => {
    getSettings().then(syncFromSettings)
  }, [])

  if (!settings) return null

  async function persist(next: Settings) {
    setSettings(next)
    await saveSettings(next)
  }

  function handlePpChange(type: PromptPayType, raw: string) {
    setPpType(type)
    setPpRaw(raw)
    if (!settings) return
    if (!raw.trim()) {
      const next = { ...settings }
      delete next.promptPay
      persist(next)
      return
    }
    const norm = normalizePromptPayId(type, raw)
    if (norm) {
      persist({ ...settings, promptPay: { type, id: norm } })
    }
  }

  const normalized = ppRaw.trim() ? normalizePromptPayId(ppType, ppRaw) : null
  const ppInvalid = ppRaw.trim().length > 0 && normalized === null

  async function addFriend() {
    if (!settings || !friendName.trim()) return
    const p = newPerson(friendName)
    await persist({ ...settings, friends: [...settings.friends, p] })
    setFriendName('')
  }

  async function removeFriend(id: string) {
    if (!settings) return
    await persist({ ...settings, friends: settings.friends.filter((f) => f.id !== id) })
  }

  async function handleExport() {
    const json = await exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `harnkan-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await importAll(text)
      const s = await getSettings()
      syncFromSettings(s)
      onLangChange?.(s.language)
      setImportStatus('ok')
    } catch {
      setImportStatus('err')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="page">
      <NavBar title={t('settings.title')} left={<Button onClick={() => nav('/')}>‹ {t('common.back')}</Button>} />
      <div className="page-content">
        <Section header={t('settings.language')}>
          <div className="cell">
            <Segmented<Lang>
              value={settings.language}
              options={[
                { value: 'th', label: 'ไทย' },
                { value: 'en', label: 'English' },
              ]}
              onChange={(language) => {
                persist({ ...settings, language })
                onLangChange?.(language)
              }}
            />
          </div>
        </Section>

        <Section
          header={t('settings.promptPay')}
          footer={
            ppInvalid ? (
              <span style={{ color: 'var(--red)' }}>{t('settings.invalidId')}</span>
            ) : normalized ? (
              <span className="paid">
                {t('settings.saved')}: {normalized}
              </span>
            ) : undefined
          }
        >
          <div className="cell">
            <Segmented<PromptPayType>
              value={ppType}
              options={[
                { value: 'phone', label: t('settings.phone') },
                { value: 'nationalId', label: t('settings.nationalId') },
                { value: 'ewallet', label: t('settings.ewallet') },
              ]}
              onChange={(type) => handlePpChange(type, ppRaw)}
            />
          </div>
          <div className="cell">
            <input
              className="input"
              inputMode={ppType === 'phone' ? 'tel' : 'numeric'}
              placeholder={t('settings.promptPayId')}
              value={ppRaw}
              onChange={(e) => handlePpChange(ppType, e.target.value)}
            />
          </div>
        </Section>

        <Section header={t('settings.friends')}>
          {settings.friends.map((f) => (
            <Cell
              key={f.id}
              label={f.name}
              accessory={
                <Button variant="destructive" onClick={() => removeFriend(f.id)}>
                  {t('common.delete')}
                </Button>
              }
            />
          ))}
          <div className="cell">
            <input
              className="input"
              placeholder={t('editor.personPlaceholder')}
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
            />
            <Button onClick={addFriend} disabled={!friendName.trim()}>
              {t('settings.addFriend')}
            </Button>
          </div>
        </Section>

        <Section header={t('settings.defaults')}>
          <Cell
            label={t('settings.defaultSc')}
            value={
              <input
                className="input input-num"
                style={{ maxWidth: 64 }}
                inputMode="decimal"
                value={scText}
                onChange={(e) => {
                  const raw = e.target.value
                  setScText(raw)
                  const n = Number(raw)
                  if (raw.trim() === '') {
                    persist({ ...settings, defaults: { ...settings.defaults, scPercent: 0 } })
                  } else if (Number.isFinite(n) && n >= 0) {
                    persist({ ...settings, defaults: { ...settings.defaults, scPercent: n } })
                  }
                }}
                onBlur={() => setScText(String(settings.defaults.scPercent))}
              />
            }
          />
          <Cell
            label={t('settings.defaultVat')}
            value={
              <input
                className="input input-num"
                style={{ maxWidth: 64 }}
                inputMode="decimal"
                value={vatText}
                onChange={(e) => {
                  const raw = e.target.value
                  setVatText(raw)
                  const n = Number(raw)
                  if (raw.trim() === '') {
                    persist({ ...settings, defaults: { ...settings.defaults, vatPercent: 0 } })
                  } else if (Number.isFinite(n) && n >= 0) {
                    persist({ ...settings, defaults: { ...settings.defaults, vatPercent: n } })
                  }
                }}
                onBlur={() => setVatText(String(settings.defaults.vatPercent))}
              />
            }
          />
        </Section>

        <Section header={t('settings.backup')} footer={t('settings.backupHint')}>
          <Cell label={t('settings.export')} onClick={handleExport} />
          <label className="cell" style={{ cursor: 'pointer' }}>
            <span className="cell-label">{t('settings.import')}</span>
            <input
              type="file"
              accept="application/json"
              aria-label={t('settings.import')}
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
          {importStatus && (
            <div className="cell" style={{ color: importStatus === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {importStatus === 'ok' ? t('settings.importOk') : t('settings.importError')}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
