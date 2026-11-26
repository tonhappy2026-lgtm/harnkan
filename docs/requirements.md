# แอพหารค่าอาหาร (Bill Splitter) — Requirements & Design

> ชื่อแอพ: **หารกัน** · สถานะ: **Approved** · อัปเดต 2026-11-26 · ได้จากการ grilling session

## 1. เป้าหมาย
แอพบน iPhone สำหรับหารค่าใช้จ่ายเวลาไปกินข้าวหลายคน ใช้ **ออฟไลน์บนเครื่องเดียว** (คนจ่ายเป็นคนกรอก) แล้วแชร์ผลให้เพื่อน พร้อม QR PromptPay ให้แต่ละคนสแกนจ่าย

## 2. ข้อจำกัด & การตัดสินใจหลัก

| หัวข้อ | การตัดสินใจ | เหตุผล |
|---|---|---|
| แพลตฟอร์ม | **PWA** (Add to Home Screen ผ่าน Safari) | ไม่มี Mac → build native/App Store ไม่ได้, ไม่เสีย \$99/ปี |
| Tech stack | **React + Vite + TypeScript** + `vite-plugin-pwa` | ต่อยอดเป็น React Native/Expo ได้ภายหลัง |
| ข้อมูล | ออฟไลน์ เครื่องเดียว, เก็บใน **IndexedDB** | ไม่ต้องมี backend / login |
| Hosting | **GitHub Pages** (HTTPS) + GitHub Actions deploy | ฟรี, จำเป็นต้องมี HTTPS เพื่อติดตั้ง PWA |
| ภาษา | **ไทย + อังกฤษ** (สลับได้, ค่าเริ่มต้นตามภาษาเครื่อง) | |
| UI | สไตล์ iOS, **Light/Dark ตามเครื่อง** (`prefers-color-scheme`) | |

## 3. ฟีเจอร์ (MVP)

### 3.1 คนในบิล
- เพิ่ม/ลบคน, เลือกจาก **รายชื่อเพื่อนประจำ** ที่บันทึกไว้
- กำหนด **คนจ่ายเงิน (payer)** 1 คน — คนนี้ไม่ต้องสร้าง QR ให้ตัวเอง

### 3.2 โหมดการหาร (สลับได้)
- **หารเท่ากัน**: กรอกยอดรวม → หารจำนวนคน
- **หารตามรายการ**: เพิ่มเมนู (ชื่อ, ราคา, จำนวน) → เลือกคนที่กิน (ค่าเริ่มต้น = ทุกคน) → ราคาเมนูหารเท่ากันในกลุ่มคนที่เลือก
- สลับจากเท่ากัน → ตามรายการ ได้โดยไม่เสียข้อมูลคน

### 3.3 ค่าบริการ / ภาษี / ส่วนลด (เปิด-ปิดแยกกันได้)
| รายการ | ค่าเริ่มต้น | แก้ไขได้ |
|---|---|---|
| Service charge | เปิด, 10% | % |
| VAT | เปิด, 7% | % |
| ส่วนลด | ปิด | เป็นบาท หรือ % |

**ลำดับการคำนวณ** (ระดับบิล):
```
subtotal   = ผลรวมราคาอาหาร
afterDisc  = subtotal − discount
sc         = afterDisc × sc%          (ถ้าเปิด)
vat        = (afterDisc + sc) × vat%  (ถ้าเปิด)
total      = afterDisc + sc + vat
```
**การกระจายให้แต่ละคน: ตามสัดส่วน** ที่แต่ละคนกิน
```
share(p) = personSubtotal(p) / subtotal × total
```

### 3.4 การปัดเศษ
- แสดง **ทศนิยม 2 ตำแหน่งตามจริง**
- คำนวณภายในเป็น **สตางค์ (integer)** เพื่อเลี่ยง floating-point error
- เศษสตางค์ที่เหลือจากการหาร กระจายด้วยวิธี largest-remainder เพื่อให้ **ผลรวมทุกคน = total พอดี**

### 3.5 การเก็บเงิน
- ตั้งค่า **PromptPay ID** ของคนจ่ายครั้งเดียว (เบอร์มือถือ / เลขบัตรประชาชน / e-Wallet ID) — บันทึกไว้
- สร้าง **QR PromptPay แบบระบุยอด** ให้แต่ละคน (EMVCo / Thai QR Payment, tag 29, CRC16-CCITT) — สร้างในเครื่อง ไม่ต้องใช้เน็ต
- ปุ่มติ๊ก **"จ่ายแล้ว"** ต่อคน + แสดงยอดที่ยังค้าง

### 3.6 แชร์สรุป
- **ข้อความ**: คัดลอก / Web Share API → LINE
- **รูปภาพ**: render การ์ดสรุป (รวม QR) เป็น PNG ด้วย `html-to-image` → แชร์/บันทึก

### 3.7 ประวัติ & ข้อมูล
- บันทึก **ประวัติบิล** (ดู/แก้/ลบ/ทำซ้ำ)
- **Export/Import JSON** สำหรับ backup

> [!WARNING]
> ข้อมูลอยู่ใน Safari storage — ถ้าล้างข้อมูล Safari หรือไม่ได้เปิดแอพนาน iOS อาจลบข้อมูลได้ จึงต้องมี Export backup และขอ `navigator.storage.persist()`

## 4. Data Model (TypeScript)
```ts
type Satang = number; // integer

interface Person { id: string; name: string }

interface Item {
  id: string; name: string;
  unitPrice: Satang; qty: number;
  consumerIds: string[];        // ว่าง = ทุกคน
}

interface Bill {
  id: string; title: string; createdAt: string;
  mode: 'equal' | 'itemized';
  people: Person[]; payerId: string;
  equalTotal?: Satang;          // ใช้เมื่อ mode = equal
  items: Item[];                // ใช้เมื่อ mode = itemized
  serviceCharge: { enabled: boolean; percent: number };
  vat:           { enabled: boolean; percent: number; inclusive: boolean };
  discount:      { enabled: boolean; type: 'amount' | 'percent'; value: number };
  paidIds: string[];
}

interface Settings {
  language: 'th' | 'en';
  promptPay?: { type: 'phone' | 'nationalId' | 'ewallet'; id: string };
  friends: Person[];
  defaults: { scPercent: number; vatPercent: number };
}
```

## 5. หน้าจอ
1. **รายการบิล** (ประวัติ) + ปุ่ม "บิลใหม่"
2. **แก้ไขบิล**: คน → โหมด → รายการ/ยอด → SC/VAT/ส่วนลด
3. **สรุปผล**: ยอดต่อคน, ติ๊กจ่ายแล้ว, QR, แชร์ข้อความ/รูป
4. **ตั้งค่า**: ภาษา, PromptPay ID, เพื่อนประจำ, ค่า SC/VAT เริ่มต้น, Export/Import

## 6. โครงสร้างโปรเจกต์ (เสนอ)
```
src/
  domain/      calc.ts, promptpay.ts, money.ts   ← pure functions + unit tests (Vitest)
  store/       db.ts (IndexedDB via idb-keyval / Dexie)
  i18n/        th.json, en.json
  components/  ui แบบ iOS (List, Cell, Toggle, Sheet)
  pages/       Bills, BillEditor, Summary, Settings
```
- Testing: **Vitest** สำหรับ `calc` และ `promptpay` (มี test case CRC/payload ที่ทราบคำตอบ)
- Deploy: GitHub Actions → GitHub Pages (`base: '/<repo>/'` ใน Vite config)

## 7. Edge Cases ที่ต้องรองรับ
- เมนูที่ไม่มีใครถูกเลือก → แจ้งเตือน (ไม่ให้เงินหาย)
- ส่วนลดมากกว่ายอดอาหาร → จำกัดไม่ให้ติดลบ
- ลบคนที่ถูกผูกกับเมนูอยู่ → เอาออกจาก consumerIds + เตือนถ้าเมนูไม่เหลือคน
- subtotal = 0 → ไม่หาร
- PromptPay ID ไม่ถูกรูปแบบ → validate ก่อนสร้าง QR

## 8. การตัดสินใจที่ยืนยันแล้ว (2026-11-26)
- [x] มีตัวเลือก **"ราคารวม VAT แล้ว"** — เมื่อเปิด จะไม่บวก VAT เพิ่ม แต่แสดงยอด VAT ที่รวมอยู่ = `round(total × vat / (100 + vat))` เพื่อข้อมูล
- [x] กระจาย SC/VAT **ตามสัดส่วน**, มีปุ่ม **จ่ายแล้ว**, บันทึก **ประวัติ + เพื่อนประจำ**
- [x] ชื่อแอพ: **หารกัน** (English: *HarnKan*), ชื่อ repo: `harnkan` → URL `https://<user>.github.io/harnkan/`
- [x] Prerequisite: ต้องติดตั้ง **Node.js LTS** บนเครื่อง (ยังไม่มี) — `winget install OpenJS.NodeJS.LTS`

## 9. นอกขอบเขต (ไว้อนาคต)
- Sync หลายเครื่อง / ออนไลน์, หลายคนจ่าย (multi-payer), สแกนใบเสร็จ (OCR), สกุลเงินอื่น, ขึ้น App Store (ผ่าน Expo)
