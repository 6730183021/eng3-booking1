# ระบบจองห้อง อาคาร 3 · คณะวิศวกรรมศาสตร์ จุฬาฯ (MVP)

Web app สำหรับจองห้องอาคาร 3 แบบออนไลน์ แทนการเดินเอกสาร 5–7 วัน
นิสิตเห็นห้องว่างทั้งอาคารบนแผนผัง 2D แบบเรียลไทม์ → ล็อกห้อง → กรอกฟอร์ม → ระบบออกเอกสาร PDF
เจ้าหน้าที่อนุมัติ/ปฏิเสธในคลิกเดียว และมีตารางงานเปิด–ปิดห้องรายวัน — ทุกสถานะเด้งไปที่หน้าจอนิสิตทันที

> สถานะ: **MVP พร้อมทดสอบจริง (pilot)** — ดู [Checklist ก่อนเปิดใช้งาน](#checklist-ก่อนเปิดใช้งานจริง) ด้านล่าง

---

## Tech stack และเหตุผล

| ชั้น | เลือกใช้ | ทำไม |
|---|---|---|
| Frontend + API | **Next.js 16 (App Router)** + TypeScript | หน้าเว็บ + Server Actions + Route Handlers (PDF/cron) ในโปรเจกต์เดียว deploy บน Vercel ได้ทันที |
| UI | **Tailwind CSS v4** + คอมโพเนนต์สไตล์ shadcn/ui (`src/components/ui`) | ธีมสีเลือดหมู `#800000` อยู่ที่ `src/app/globals.css` ที่เดียว |
| Database / Auth / Realtime | **Supabase** (PostgreSQL) | เลือกแทน Firebase เพราะ **Postgres กันการจองซ้อนได้ในระดับฐานข้อมูล** (EXCLUDE constraint), มี Row Level Security, Realtime, Google login และ pg_cron ในตัว — และเป็น SQL มาตรฐาน ส่งต่อให้ภาคคอมฯ ย้ายไปเซิร์ฟเวอร์คณะได้ |
| PDF | **@react-pdf/renderer** + ฟอนต์ Sarabun (OFL) | สร้าง PDF ฝั่งเซิร์ฟเวอร์ ภาษาไทยตัดคำถูกต้อง (ใช้ `Intl.Segmenter`) |
| แจ้งเตือน | **Resend** (อีเมล) + **LINE Messaging API** | LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025 จึงใช้ LINE Official Account แทน · ถ้าไม่ตั้งค่า ระบบจะ log ลง console แทน (ไม่พัง) |

---

## ฟีเจอร์ตาม requirement

**นิสิต** (`/book`, `/my-bookings`, `/onboarding`)
- Login ด้วยบัญชี Chula (Google — ผ่าน CUNET SSO) หรือ magic link ทางอีเมล · **ฐานข้อมูลปฏิเสธอีเมลที่ไม่ใช่ `@student.chula.ac.th`** (เจ้าหน้าที่ต้องอยู่ใน allow-list)
- รหัสนิสิตดึงจากอีเมลอัตโนมัติ **และแก้ไขไม่ได้** (กันการปลอมข้อมูลในเอกสารทางการ) · กรอกภาควิชา/ชั้นปี/เบอร์โทรครั้งเดียว + รับทราบการใช้ข้อมูลส่วนบุคคล (PDPA)
- แผนผัง 2D แยกชั้น (SVG) สี: 🟩 ว่าง · 🟨 มีคนกำลังทำรายการ (ล็อก) · 🟥 ไม่ว่าง · ⬜ ปิดปรับปรุง/ปิดการจอง · hover ดูความจุ+อุปกรณ์ · มือถือเลื่อนซ้าย–ขวาได้
- ตารางว่างรายวันของแต่ละห้อง (คลิกเพื่อเลือกเวลาเริ่ม)
- ล็อกห้อง 10 นาทีพร้อม countdown (เทียบนาฬิกาเซิร์ฟเวอร์) → กรอกฟอร์ม → ได้เลขที่คำร้อง `ENG3-2569-00001` + PDF
- Dashboard ติดตามสถานะสด: ส่งเรื่องแล้ว → กำลังตรวจสอบ → อนุมัติ/ไม่อนุมัติ (พร้อมเหตุผล) + ประวัติทุกขั้นตอน
- แก้ไขได้ถึง 24 ชม. ก่อนใช้ห้อง (แก้แล้วกลับไปรอตรวจใหม่) · ยกเลิก: ยังไม่อนุมัติ = ได้จนถึงเวลาเริ่ม, อนุมัติแล้ว = ก่อน 24 ชม.

**เจ้าหน้าที่** (`/admin/*`)
- Role: `staff` (เปิด–ปิดห้อง) · `approver` (อนุมัติเอกสาร + ปิดการจอง) · `super_admin` (ทุกอย่าง + ตั้งค่า)
- Inbox คำร้องเรียง FIFO, ป้าย “ใช้ห้องภายใน 48 ชม.”, ดูเอกสาร PDF ในหน้าเดียว, อนุมัติ/ไม่อนุมัติ/เพิกถอน พร้อมเหตุผลสำเร็จรูป
- ตารางงานรายวัน: งาน “เปิดห้อง” (ก่อนเวลา 15 นาที) และ “ปิดห้อง” + อุปกรณ์ที่ต้องเตรียม + เบอร์ผู้จอง · กดยืนยันเพื่อเก็บหลักฐาน · พิมพ์ได้
- จัดการห้อง (แก้ตำแหน่งบนแผนผังพร้อมพรีวิว) · ปิดการจองชั่วคราว (สอบ/ซ่อม) · ตั้งกฎการจอง · จัดการสิทธิ์เจ้าหน้าที่
- Audit trail ทุกการเปลี่ยนสถานะ (`booking_events`) — ใคร ทำอะไร เมื่อไร

---

## การกันจองชนกัน (Concurrency) ทำงานอย่างไร

ทุกการเขียนข้อมูลการจองผ่านฟังก์ชันในฐานข้อมูล (`supabase/migrations/…_functions.sql`) ไม่ใช่จากหน้าเว็บโดยตรง

```
นิสิต A ─┐                         ┌─ (a) pg_advisory_xact_lock(ห้อง)   ← คนที่ 2 ต้องรอคิว
นิสิต B ─┼─▶ hold_slot(ห้อง,เวลา) ─┼─ (b) ตรวจซ้อน → SLOT_LOCKED / SLOT_TAKEN (ข้อความภาษาไทย)
นิสิต C ─┘                         └─ (c) EXCLUDE USING gist (room_id =, tstzrange &&)  ← การันตีขั้นสุดท้าย
```

1. **Pessimistic lock:** `hold_slot` สร้างแถว `status = 'holding'` อายุ 10 นาที → ทุกคนเห็นสีเหลืองทันที (Realtime) → คนอื่นล็อกช่วงเวลาที่ซ้อนกันไม่ได้
2. **Hard guarantee:** EXCLUDE constraint ของ Postgres ไม่ยอมให้มีการจองที่ “ยังมีผล” (holding/submitted/in_review/approved) ซ้อนเวลากันในห้องเดียว แม้มีคำขอพร้อมกันกี่ร้อยครั้ง
3. **หมดเวลา:** ล็อกที่หมดอายุไม่บล็อกใคร (หน้าเว็บซ่อนทันที, `hold_slot` ลบทิ้ง, pg_cron เก็บกวาดทุกนาที)
4. **กันการกั๊กห้อง:** ล็อกช่วงเวลาเดิมซ้ำได้ไม่เกิน 2 ครั้ง/30 นาที และไม่เกิน 10 ครั้ง/ชั่วโมง
5. **ความเป็นส่วนตัว:** แผนผังอ่านจากตาราง `room_slots` (มีแค่ห้อง–เวลา–สถานะ) — นิสิตไม่เห็นชื่อ/รายละเอียดการจองของคนอื่น (RLS)

ทดสอบแล้ว: นิสิต 40 คนกดจองห้องเดียวกันพร้อมกัน → **ชนะ 1 คน อีก 39 คนได้ข้อความ “มีผู้ใช้อื่นกำลังทำรายการ”**

---

## ติดตั้ง (ประมาณ 30 นาที)

### 1) Supabase
1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (region: Singapore)
2. **SQL Editor** → รันไฟล์ตามลำดับ:
   `supabase/migrations/20261014000001_schema.sql` → `…02_functions.sql` → `…03_rls_realtime.sql` → `…04_cron.sql` → `supabase/seed.sql`
   (หรือใช้ Supabase CLI: `supabase link` แล้ว `supabase db push`)
3. เพิ่ม super admin คนแรก (ก่อนคนนั้น login ครั้งแรก):
   ```sql
   insert into public.staff_members (email, role) values ('your.name@chula.ac.th', 'super_admin');
   ```
4. **Authentication → Providers**
   - **Google:** สร้าง OAuth Client ที่ Google Cloud Console → ใส่ Client ID/Secret → Authorized redirect URI = `https://<project>.supabase.co/auth/v1/callback`
   - **Email:** เปิดไว้สำหรับ magic link
5. **Authentication → URL Configuration:** Site URL = URL ของเว็บ, Redirect URLs เพิ่ม `https://<your-app>/auth/callback` (และ `http://localhost:3000/auth/callback` ตอนพัฒนา)
6. **Authentication → SMTP Settings: ตั้ง Custom SMTP** (เช่น Resend) — *อีเมลในตัวของ Supabase ส่งได้เฉพาะสมาชิกทีมโปรเจกต์เท่านั้น ถ้าไม่ตั้ง นิสิตจะไม่ได้รับลิงก์เข้าสู่ระบบ*

### 2) รันบนเครื่อง
```bash
cp .env.example .env.local      # ใส่ค่าจาก Supabase → Project Settings → API
npm install
npm run dev                     # http://localhost:3000
```

### 3) Deploy (Vercel)
Import repo → ใส่ Environment Variables ตาม `.env.example` → Deploy
แจ้งเตือนเจ้าหน้าที่ก่อนเปิดห้อง: รัน `supabase/optional/reminder_cron.sql` (เรียก `/api/cron/reminders` ทุก 10 นาทีด้วย pg_cron + pg_net — ใช้ได้กับ Vercel ทุกแผน)

### Environment variables
| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | เชื่อม Supabase (โปรเจกต์เก่าใช้ `NEXT_PUBLIC_SUPABASE_ANON_KEY` แทนได้) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ลิงก์ในอีเมล/LINE/PDF |
| `SUPABASE_SECRET_KEY` | cron | ใช้เฉพาะ `/api/cron/reminders` (ห้ามใส่ใน client) |
| `RESEND_API_KEY`, `EMAIL_FROM` | แนะนำ | อีเมลยืนยัน/แจ้งผลถึงนิสิต (ต้อง verify โดเมนผู้ส่งใน Resend) |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_STAFF_TARGET_ID` | ไม่บังคับ | แจ้งคำร้องใหม่/เตือนเปิดห้องในกลุ่ม LINE เจ้าหน้าที่ |
| `CRON_SECRET` | cron | ป้องกันคนนอกเรียก endpoint cron |

---

## ทดสอบ

```bash
npm run typecheck && npm run lint && npm run build
npm run db:test     # ต้องมี PostgreSQL 15+ ในเครื่อง (ไม่ต้องใช้ Docker)
```
`db:test` รัน migration บน Postgres ชั่วคราว + ทดสอบกฎการจอง/สิทธิ์/สถานะ 44 กรณี + จำลองนิสิต 40 คนแย่งห้องเดียวกันพร้อมกัน

ดูหน้าตาเอกสาร PDF โดยไม่ต้องมีฐานข้อมูล:
```bash
npx esbuild scripts/render-sample-pdf.tsx --bundle --platform=node --format=esm --packages=external --jsx=automatic --outfile=scripts/.out/render.mjs && node scripts/.out/render.mjs sample.pdf
```

---

## โครงสร้างโปรเจกต์

```
supabase/
  migrations/      01 schema · 02 functions & RPC (กฎทั้งหมดอยู่ที่นี่) · 03 RLS & Realtime · 04 pg_cron
  seed.sql         ⚠️ แผนผังและห้อง "ตัวอย่าง" — ต้องแทนด้วยข้อมูลจริง
  tests/           ชุดทดสอบ SQL + race test
  optional/        cron เตือนเปิดห้อง
src/
  proxy.ts                         refresh session + กันหน้าที่ต้อง login (Next 16 ใช้ proxy แทน middleware)
  app/(student)/book               ① เลือกห้อง/เวลา ② ล็อก+ฟอร์ม ③ เสร็จ
  app/(student)/my-bookings        dashboard ติดตามสถานะ
  app/(student)/onboarding         ข้อมูลนิสิต + PDPA
  app/admin/{approvals,tasks,rooms,settings}
  app/actions/                     Server Actions (เรียก RPC ใน Postgres)
  app/api/bookings/[id]/pdf        สร้าง PDF (เจ้าของ/เจ้าหน้าที่เท่านั้น — บังคับด้วย RLS)
  app/api/cron/reminders           เตือนเปิดห้องทาง LINE
  components/floor-plan/           แผนผัง 2D (SVG, data-driven)
  components/booking/              workspace, ฟอร์ม, countdown, timeline, dashboard
  components/admin/                inbox, task board, room manager, settings
  lib/pdf/booking-document.tsx     ⚠️ แม่แบบเอกสารชั่วคราว — เปลี่ยนเป็นแบบฟอร์มของคณะได้ที่ไฟล์นี้ไฟล์เดียว
  lib/rules.ts / room-state.ts     กฎฝั่งหน้าเว็บ (สะท้อนกฎในฐานข้อมูลเพื่อ UX)
```

### แก้ไขแผนผังให้เป็นของจริง
- ห้อง: หน้า **/admin/rooms** (super admin) แก้พิกัด X/Y/กว้าง/สูง พร้อมพรีวิว หรือแก้ตาราง `rooms`
- ทางเดิน/บันได/ลิฟต์/ห้องน้ำ: คอลัมน์ `floors.features` (JSON) — พิกัด SVG 1000 × 560

### เปลี่ยนเป็นแบบฟอร์มทางการของคณะ
แก้ JSX ใน `src/lib/pdf/booking-document.tsx` อย่างเดียว ข้อมูล (`booking`) และ route ไม่ต้องเปลี่ยน
ข้อควรรู้: ข้อความไทยต้องผ่าน `<T>` ในไฟล์นั้น (แก้ปัญหาสระ “ำ” ทำให้ตัวอักษรหายใน react-pdf)

---

## Checklist ก่อนเปิดใช้งานจริง

- [ ] **แทนข้อมูลแผนผัง/ห้องตัวอย่าง** ใน `seed.sql` ด้วยผังอาคาร 3 จริง (ปัจจุบันเป็นข้อมูลสมมติ)
- [ ] **ตั้ง Custom SMTP ใน Supabase** (ไม่งั้น magic link ไม่ถึงนิสิต) และ verify โดเมนผู้ส่ง
- [ ] **ทดสอบ Google login ด้วยบัญชีนิสิตจริง** — ตรวจกับฝ่าย IT ว่า Chula Google Workspace อนุญาต OAuth app ภายนอกหรือไม่ (ถ้าไม่ ให้ใช้ magic link เป็นหลัก)
- [ ] ยืนยันรายชื่อภาควิชา (`src/lib/constants.ts`), ผู้รับในเอกสาร (“เรียน …”) และข้อความ PDPA กับคณะ / DPO ของมหาวิทยาลัย
- [ ] ยืนยันกฎการจอง (ล่วงหน้า 12 ชม., สูงสุด 3 ชม., 08:00–20:00, จ.–ส., แก้ไขก่อน 24 ชม.) ที่ /admin/settings
- [ ] Smoke test บน staging: login 2 บัญชี → ล็อกห้องเดียวกันพร้อมกัน → เห็นสีเหลืองสด → อนุมัติ → นิสิตเห็นสถานะเปลี่ยนทันที → PDF
- [ ] ตั้งค่า LINE Official Account (ถ้าใช้) — ข้อความ push มีโควตาต่อเดือนตามแพ็กเกจ

## ข้อจำกัดที่รู้อยู่ / งานต่อสำหรับเวอร์ชันถาวร
- ยังไม่มี UI test อัตโนมัติ (มี SQL test + build/type/lint) — แนะนำ Playwright ในเฟสถัดไป
- เปลี่ยนห้อง/เวลาของคำร้องเดิม = ยกเลิกแล้วจองใหม่
- การปิดการจอง (block) ไม่ยกเลิกคำร้องที่อนุมัติไปแล้วอัตโนมัติ (เจ้าหน้าที่เพิกถอนเองได้)
- จองซ้ำรายสัปดาห์ (recurring) ยังไม่รองรับ
- ถ้าจะย้ายจาก Supabase ไปเซิร์ฟเวอร์คณะ: ฐานข้อมูลเป็น PostgreSQL ล้วน — ต้องทำส่วน Auth (`auth.uid()`), Realtime และ Storage ทดแทน

---
ฟอนต์ Sarabun © The Sarabun Project Authors — SIL Open Font License (`assets/fonts/OFL.txt`)
