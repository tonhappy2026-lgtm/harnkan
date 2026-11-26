import { createContext, useCallback, useContext, type ReactNode } from 'react'
import th from './th.json'
import en from './en.json'

export type Lang = 'th' | 'en'
type Vars = Record<string, string | number>
export type T = (key: string, vars?: Vars) => string

const dicts: Record<Lang, Record<string, string>> = { th, en }

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = dicts[lang][key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

const LangContext = createContext<Lang>('th')

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang(): Lang {
  return useContext(LangContext)
}

export function useT(): T {
  const lang = useContext(LangContext)
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang])
}
