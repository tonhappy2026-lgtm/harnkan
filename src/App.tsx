import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider, type Lang } from './i18n'
import BillEditorPage from './pages/BillEditorPage'
import BillsPage from './pages/BillsPage'
import SettingsPage from './pages/SettingsPage'
import SummaryPage from './pages/SummaryPage'
import { getSettings, requestPersistence } from './store/db'
import './ui/theme.css'

export default function App() {
  const [lang, setLang] = useState<Lang>('th')

  useEffect(() => {
    getSettings().then((s) => setLang(s.language))
    requestPersistence()
  }, [])

  return (
    <I18nProvider lang={lang}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<BillsPage />} />
          <Route path="/bill/:id" element={<BillEditorPage />} />
          <Route path="/bill/:id/summary" element={<SummaryPage />} />
          <Route path="/settings" element={<SettingsPage onLangChange={setLang} />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
