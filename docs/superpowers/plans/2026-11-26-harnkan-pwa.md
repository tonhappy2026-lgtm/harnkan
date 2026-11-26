# หารกัน (HarnKan) PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline, single-device PWA for iPhone that splits a restaurant bill (equal or itemized, with toggleable SC/VAT/discount) and generates PromptPay QR per person.

**Architecture:** Pure, fully unit-tested domain layer (`money`, `calc`, `promptpay`) with no React/DOM imports; a thin persistence layer over IndexedDB; React pages on top using a HashRouter (GitHub Pages friendly). All money is integer satang.

**Tech Stack:** Node.js LTS, Vite, React 18, TypeScript (strict), Vitest + @testing-library/react + jsdom, vite-plugin-pwa, react-router-dom (HashRouter), idb-keyval, qrcode, html-to-image. Dev-only: promptpay-qr (cross-check oracle in tests).

**Spec:** `docs/requirements.md`

## Global Constraints

- App name `หารกัน` / `HarnKan`; repo `harnkan`; Vite `base: '/harnkan/'`.
- All amounts are integer **satang** (`type Satang = number`); display always 2 decimals, e.g. `1,412.40`.
- Calculation order: subtotal → −discount → +SC on afterDisc → +VAT on (afterDisc+SC) unless `vat.inclusive`.
- Per-person share = `allocate(total, personSubtotals)` (proportional, largest-remainder, sum must equal total exactly).
- Defaults: SC enabled 10%, VAT enabled 7% exclusive, discount disabled.
- Domain files (`src/domain/*`) must not import React, DOM, or storage.
- UI strings only via i18n keys; both `th.json` and `en.json` must have identical key sets.
- Theme follows `prefers-color-scheme`; iOS look (system font `-apple-system`, grouped inset lists, `env(safe-area-inset-*)`).
- No network calls at runtime; QR generated locally.

## Review Focus

1. Item whose consumers were all removed from the bill → must be reported in `unassignedItemIds` and excluded, never silently lost or double-counted (Task 3 test).
2. Discount larger than subtotal → clamp to subtotal, total never negative (Task 3 test).
3. Amount entry like `"12.5"`, `"1,200"`, `""`, `"abc"` → parse to 1250 / 120000 / null / null (Task 2 test).
4. PromptPay phone entered with dashes/spaces/`+66` → normalized correctly; 9‑digit or 14‑digit IDs rejected (Task 4 test).
5. Corrupt or foreign JSON on Import → rejected with error, existing data untouched (Task 5 test).

---

### Task 0: Prerequisite — install Node.js (user action)

- [ ] Run `winget install OpenJS.NodeJS.LTS`, reopen terminal.
- [ ] Verify: `node -v` → `v22.x` or newer; `npm -v` prints a version.

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`, `src/test/setup.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, then `npm i react-router-dom idb-keyval qrcode html-to-image` and `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/qrcode vite-plugin-pwa promptpay-qr`.
- [ ] **Step 2:** `vite.config.ts`: `base: '/harnkan/'`, Vitest `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`. Add scripts `"test": "vitest run"`.
- [ ] **Step 3: Smoke test** `src/App.test.tsx`: `render(<App/>)` and `expect(document.body).toBeTruthy()`.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 5:** `git init && git add -A && git commit -m "chore: scaffold harnkan vite react-ts"`

### Task 2: Money utilities

**Files:** Create `src/domain/money.ts`; Test `src/domain/money.test.ts`

**Interfaces — Produces:**
- `type Satang = number`
- `parseBaht(input: string): Satang | null`
- `formatBaht(s: Satang): string` — `en-US` grouping, 2 decimals
- `allocate(total: Satang, weights: number[]): Satang[]`

- [ ] **Step 1: Failing tests**
```ts
expect(parseBaht('12.5')).toBe(1250); expect(parseBaht('1,200')).toBe(120000)
expect(parseBaht('0.005')).toBe(1);   expect(parseBaht('')).toBeNull(); expect(parseBaht('abc')).toBeNull()
expect(parseBaht('-5')).toBeNull()
expect(formatBaht(141240)).toBe('1,412.40'); expect(formatBaht(5)).toBe('0.05')
expect(allocate(100, [1,1,1])).toEqual([34,33,33])
expect(allocate(141240, [45000,45000,30000])).toEqual([52965,52965,35310])
expect(allocate(10, [0,0])).toEqual([0,0])
expect(allocate(7, [1,2])).toEqual([2,5])          // floor 2.33→2, 4.67→4, remainder to largest frac (idx1)
```
- [ ] **Step 2:** `npx vitest run src/domain/money.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `allocate`: if `sum(weights)===0` return zeros; base = `Math.floor(total*w/sum)`; distribute leftover 1 satang each by descending fractional remainder, ties → lower index.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): money parse/format/allocate`.

### Task 3: Bill calculation

**Files:** Create `src/domain/types.ts`, `src/domain/calc.ts`, `src/domain/factory.ts`; Test `src/domain/calc.test.ts`

**Interfaces:**
- Consumes: `allocate`, `Satang` (Task 2)
- Produces: types `Person`, `Item`, `Bill`, `Settings` exactly as spec §4 (with `vat.inclusive`); and
```ts
interface BillResult {
  subtotal: Satang; discount: Satang; serviceCharge: Satang;
  vatAdded: Satang; vatIncluded: Satang;   // vatIncluded>0 only when vat.inclusive
  total: Satang;
  personSubtotals: Record<string, Satang>;
  shares: Record<string, Satang>;
  unassignedItemIds: string[];
}
computeBill(bill: Bill): BillResult
newBill(people: Person[], defaults: Settings['defaults']): Bill   // factory.ts, ids via crypto.randomUUID()
```

Rules: item line = `unitPrice*qty`; consumers = `consumerIds` filtered to existing people, empty list → all people; if `consumerIds` non-empty but none remain → unassigned & excluded. Line split among consumers with `allocate(line, ones)`. Equal mode: `allocate(equalTotal, ones for all people)`. Percent → `Math.round`. Disabled toggles contribute 0.

- [ ] **Step 1: Failing tests** (people A,B,C; payer A)
```ts
// equal 1000 baht, SC/VAT off
expect(computeBill(equal(100000)).shares).toEqual({A:33334,B:33333,C:33333})
// itemized: หมูกระทะ 900 (all), เบียร์ 300 (A,B); SC10 VAT7
const r = computeBill(itemized)
expect([r.subtotal, r.serviceCharge, r.vatAdded, r.total]).toEqual([120000,12000,9240,141240])
expect(r.shares).toEqual({A:52965,B:52965,C:35310})
// vat inclusive
const i = computeBill({...itemized, vat:{enabled:true,percent:7,inclusive:true}})
expect([i.vatAdded, i.total, i.vatIncluded]).toEqual([0,132000,8636])
// discount 10%
expect(computeBill(withDiscount('percent',10)).total).toBe(127116)
// discount > subtotal clamps
expect(computeBill(withDiscount('amount',999999)).total).toBe(0)
// removed consumer → unassigned
const u = computeBill({...itemized, people: [A,C]})   // beer consumers A,B → only A remains → still assigned
expect(u.unassignedItemIds).toEqual([])
const v = computeBill({...itemized, items:[{...beer, consumerIds:['Z']}, pork]})
expect(v.unassignedItemIds).toEqual([beer.id]); expect(v.subtotal).toBe(90000)
// sum invariant
expect(Object.values(r.shares).reduce((a,b)=>a+b,0)).toBe(r.total)
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): computeBill with SC/VAT/discount`.

### Task 4: PromptPay payload

**Files:** Create `src/domain/promptpay.ts`; Test `src/domain/promptpay.test.ts`

**Interfaces — Produces:**
- `type PromptPayType = 'phone' | 'nationalId' | 'ewallet'`
- `normalizePromptPayId(type, raw: string): string | null` — digits only; phone accepts `0XXXXXXXXX` (10) or `+66/66XXXXXXXXX`; nationalId 13; ewallet 15
- `crc16(s: string): string` — CRC-16/CCITT-FALSE, 4 uppercase hex
- `buildPromptPayPayload(type, id: string, amount: Satang): string`

Payload field order (EMVCo TLV, `id+len2+value`): `00`=`01`, `01`=`12`, `29`=[`00`=`A000000677010111`, `01`|`02`|`03`=target], `58`=`TH`, `53`=`764`, `54`=amount `toFixed(2)`, then `6304`+CRC over everything before it. Phone target = `0066` + number without leading 0, left-padded with `0` to 13.

- [ ] **Step 1: Failing tests**
```ts
import generatePayload from 'promptpay-qr'
expect(crc16('123456789')).toBe('29B1')
expect(normalizePromptPayId('phone','081-234-5678')).toBe('0812345678')
expect(normalizePromptPayId('phone','+66812345678')).toBe('0812345678')
expect(normalizePromptPayId('phone','081234567')).toBeNull()
expect(normalizePromptPayId('nationalId','1234567890123')).toBe('1234567890123')
expect(normalizePromptPayId('nationalId','12345678901234')).toBeNull()
expect(buildPromptPayPayload('phone','0812345678',52965)).toBe(generatePayload('0812345678',{amount:529.65}))
expect(buildPromptPayPayload('nationalId','1234567890123',100)).toBe(generatePayload('1234567890123',{amount:1}))
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(domain): PromptPay EMVCo payload`.

### Task 5: Persistence

**Files:** Create `src/store/db.ts`; Test `src/store/db.test.ts` (use `fake-indexeddb/auto`, add as devDep)

**Interfaces — Produces:**
```ts
listBills(): Promise<Bill[]>            // newest first
getBill(id): Promise<Bill|undefined>; saveBill(b: Bill): Promise<void>; deleteBill(id): Promise<void>
getSettings(): Promise<Settings>        // returns defaults if none: language from navigator ('th' if startsWith 'th' else 'en'), friends [], defaults {scPercent:10, vatPercent:7}
saveSettings(s: Settings): Promise<void>
exportAll(): Promise<string>            // JSON {app:'harnkan', version:1, settings, bills}
importAll(json: string): Promise<void>  // throws Error('invalid-backup') if app/version/shape wrong; replaces data only when valid
requestPersistence(): Promise<boolean>  // navigator.storage?.persist()
```
- [ ] **Step 1: Failing tests:** save→list→get roundtrip; delete; `getSettings()` defaults; export→wipe→import roundtrip equal; `importAll('{"foo":1}')` rejects `invalid-backup` and `listBills()` unchanged.
- [ ] **Step 2–4:** FAIL → implement with `idb-keyval` keys `settings`, `bills` (map by id) → PASS.
- [ ] **Step 5:** Commit `feat(store): IndexedDB persistence + backup`.

### Task 6: i18n, theme & iOS UI kit

**Files:** Create `src/i18n/th.json`, `src/i18n/en.json`, `src/i18n/index.tsx`, `src/ui/theme.css`, `src/ui/{List,Cell,Toggle,Sheet,NavBar,Button}.tsx`; Test `src/i18n/i18n.test.ts`

**Interfaces — Produces:** `I18nProvider({lang, children})`, `useT(): (key: string, vars?: Record<string,string|number>) => string`; UI components `List`, `Cell({label, value?, onClick?, accessory?})`, `Toggle({checked, onChange, label})`, `Sheet({open, onClose, children})`, `NavBar({title, left?, right?})`, `Button({variant:'primary'|'plain'|'destructive'})`.

- [ ] **Step 1: Failing test:** key sets of `th.json` and `en.json` are identical; `t('app.name')` returns `หารกัน` / `HarnKan`; `{n}` interpolation works.
- [ ] **Step 2–4:** FAIL → implement → PASS. `theme.css` defines CSS vars for light and `@media (prefers-color-scheme: dark)` using iOS system colors (bg `#F2F2F7`/`#000`, grouped `#FFF`/`#1C1C1E`, tint `#007AFF`/`#0A84FF`).
- [ ] **Step 5:** Commit `feat(ui): i18n th/en and iOS-style components`.

### Task 7: Bills list & Bill editor pages

**Files:** Create `src/pages/BillsPage.tsx`, `src/pages/BillEditorPage.tsx`, `src/pages/editor/{PeopleSection,ItemsSection,ChargesSection}.tsx`; Modify `src/App.tsx` (HashRouter routes `/`, `/bill/:id`, `/bill/:id/summary`, `/settings`); Test `src/pages/BillEditorPage.test.tsx`

**Interfaces:** Consumes `newBill`, `computeBill`, `parseBaht`, `formatBaht`, store fns, `useT`, UI kit.

Behavior: list shows title/date/total, swipe-free delete via edit button, "บิลใหม่"; editor autosaves on change (debounce 300 ms); people added from text field or friends chips; payer selected by tapping star; segmented control equal/itemized; items with name, price, qty, consumer chips (default all); charges section with 3 toggles + percent fields + "ราคารวม VAT แล้ว" toggle under VAT; warning banner when `unassignedItemIds.length>0`; live total at bottom with "ดูสรุป" button.

- [ ] **Step 1: Failing test:** render editor with 3 people in itemized mode, add item "หมูกระทะ" 900 (all), SC10/VAT7 on → displayed total `1,059.30`; toggle SC off → `963.00`; toggle "ราคารวม VAT แล้ว" on → `900.00`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(pages): bills list and editor`.

### Task 8: Summary page (paid, QR, share)

**Files:** Create `src/pages/SummaryPage.tsx`, `src/share/shareText.ts`, `src/share/shareImage.ts`; Test `src/share/shareText.test.ts`, `src/pages/SummaryPage.test.tsx`

**Interfaces — Produces:** `buildShareText(bill: Bill, result: BillResult, t): string`; `shareImage(node: HTMLElement, filename: string): Promise<void>` (html-to-image `toBlob` → `navigator.share({files})` if `canShare`, else download).

Behavior: per-person rows with amount, paid checkbox (persists `paidIds`), outstanding total; tap row → Sheet with QR (`qrcode.toDataURL(buildPromptPayPayload(...))`) and amount; payer row has no QR; if no PromptPay set → link to Settings. Buttons: "คัดลอกข้อความ" (clipboard / Web Share text), "แชร์รูป".

- [ ] **Step 1: Failing tests:** `buildShareText` for itemized fixture (th) contains `หารกัน`, `A: 529.65`, `C: 353.10`, `รวม 1,412.40`; toggling paid on C makes outstanding show `529.65` (B only, payer A excluded).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(pages): summary with paid, PromptPay QR, share`.

### Task 9: Settings page

**Files:** Create `src/pages/SettingsPage.tsx`; Test `src/pages/SettingsPage.test.tsx`

Behavior: language segmented th/en; PromptPay type + ID with inline validation via `normalizePromptPayId`; friends add/remove; default SC/VAT %; Export (download `harnkan-backup-YYYYMMDD.json`) / Import (file input → `importAll`, shows error on `invalid-backup`).

- [ ] **Step 1: Failing test:** entering `081234567` shows invalid message; `0812345678` saves normalized; importing bad file shows error text.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(pages): settings`.

### Task 10: PWA & deployment

**Files:** Modify `vite.config.ts` (VitePWA), Create `public/icons/{icon-192,icon-512,apple-touch-icon-180}.png`, `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1:** VitePWA `registerType:'autoUpdate'`, manifest `{name:'หารกัน', short_name:'หารกัน', start_url:'/harnkan/', scope:'/harnkan/', display:'standalone', theme_color:'#007AFF', background_color:'#F2F2F7', lang:'th'}`, workbox precache all assets. `index.html`: `apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover`.
- [ ] **Step 2:** `deploy.yml`: on push to `main` → `npm ci && npm test && npm run build` → `actions/deploy-pages`.
- [ ] **Step 3:** Verify `npm run build && npm run preview` → `dist/sw.js` and `manifest.webmanifest` exist; Lighthouse PWA installable.
- [ ] **Step 4:** README: install steps for iPhone (Safari → Share → Add to Home Screen), dev commands, enabling GitHub Pages (Settings → Pages → Source: GitHub Actions).
- [ ] **Step 5:** Commit `feat: PWA manifest, service worker, GitHub Pages deploy`.
