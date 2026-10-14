"use client";
// Booking request form — the data that becomes the official document (PDF).
import { useState } from "react";
import { Send } from "lucide-react";
import { ACTIVITY_TYPES, EQUIPMENT } from "@/lib/constants";
import { bookingFormSchema, fieldErrors, type BookingFormInput } from "@/lib/validation";
import type { Profile, RoomSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

type FormState = {
  activity_name: string; activity_type: string; purpose: string; attendees: string;
  organization: string; advisor_name: string; contact_phone: string; equipment: string[]; extra_notes: string;
};

export type SubmitResult = { ok: boolean; message?: string; fields?: Record<string, string> };

export function BookingForm({
  room, profile, initial, submitLabel = "ส่งคำร้องขอใช้ห้อง", onSubmit, onCancel, disabled, showRequester = true,
}: {
  room: Pick<RoomSummary, "capacity" | "code">;
  profile: Pick<Profile, "full_name" | "student_id" | "department" | "year_of_study" | "phone" | "email">;
  initial?: Partial<BookingFormInput>;
  submitLabel?: string;
  onSubmit: (values: BookingFormInput) => Promise<SubmitResult>;
  onCancel?: () => void;
  disabled?: boolean;
  showRequester?: boolean;
}) {
  const [v, setV] = useState<FormState>({
    activity_name: initial?.activity_name ?? "",
    activity_type: initial?.activity_type ?? "",
    purpose: initial?.purpose ?? "",
    attendees: initial?.attendees ? String(initial.attendees) : "",
    organization: initial?.organization ?? "",
    advisor_name: initial?.advisor_name ?? "",
    contact_phone: initial?.contact_phone ?? profile.phone ?? "",
    equipment: initial?.equipment ?? [],
    extra_notes: initial?.extra_notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(!!initial);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bookingFormSchema.safeParse(v);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (parsed.success && parsed.data.attendees > room.capacity)
      errs.attendees = `ห้อง ${room.code} รองรับได้สูงสุด ${room.capacity} คน`;
    if (!agree) errs.agree = "กรุณายืนยันข้อตกลงการใช้ห้อง";
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;

    setBusy(true);
    const res = await onSubmit(parsed.data);
    setBusy(false);
    if (!res.ok && res.fields) setErrors(res.fields);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {showRequester && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-maroon-800">ข้อมูลผู้ยื่นคำร้อง</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
            {[
              ["ชื่อ–นามสกุล", profile.full_name],
              ["รหัสนิสิต", profile.student_id],
              ["ภาควิชา", profile.department],
              ["ชั้นปี", profile.year_of_study ? `ปี ${profile.year_of_study}` : "-"],
              ["อีเมล", profile.email],
            ].map(([k, val]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="truncate font-medium text-slate-800">{val || "-"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-slate-500">
            ข้อมูลดึงจากบัญชีของคุณอัตโนมัติ · <a href="/onboarding" className="text-maroon-700 underline">แก้ไขข้อมูลส่วนตัว</a>
          </p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-maroon-800 sm:col-span-2">รายละเอียดการใช้ห้อง</h3>
        <Field label="ชื่อกิจกรรม / โครงการ" htmlFor="activity_name" required error={errors.activity_name} className="sm:col-span-2">
          <Input id="activity_name" value={v.activity_name} onChange={(e) => set("activity_name", e.target.value)}
            placeholder="เช่น ติวสอบกลางภาค วิชา Operations Research" aria-invalid={!!errors.activity_name} />
        </Field>
        <Field label="ประเภทกิจกรรม" htmlFor="activity_type" required error={errors.activity_type}>
          <Select id="activity_type" value={v.activity_type} onChange={(e) => set("activity_type", e.target.value)} aria-invalid={!!errors.activity_type}>
            <option value="">— เลือก —</option>
            {Object.entries(ACTIVITY_TYPES).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="จำนวนผู้เข้าร่วม (คน)" htmlFor="attendees" required error={errors.attendees} hint={`ความจุห้องสูงสุด ${room.capacity} คน`}>
          <Input id="attendees" type="number" inputMode="numeric" min={1} max={room.capacity} value={v.attendees}
            onChange={(e) => set("attendees", e.target.value)} aria-invalid={!!errors.attendees} />
        </Field>
        <Field label="วัตถุประสงค์การใช้ห้อง" htmlFor="purpose" required error={errors.purpose} className="sm:col-span-2">
          <Textarea id="purpose" value={v.purpose} onChange={(e) => set("purpose", e.target.value)}
            placeholder="อธิบายกิจกรรมโดยย่อ เพื่อประกอบการพิจารณาอนุมัติ" aria-invalid={!!errors.purpose} />
        </Field>
        <Field label="หน่วยงาน / ชมรม / กลุ่ม" htmlFor="organization" error={errors.organization} hint="ถ้ามี">
          <Input id="organization" value={v.organization} onChange={(e) => set("organization", e.target.value)} placeholder="เช่น ชมรม IE Club" />
        </Field>
        <Field label="อาจารย์ที่ปรึกษาโครงการ" htmlFor="advisor_name" error={errors.advisor_name} hint="ถ้ามี">
          <Input id="advisor_name" value={v.advisor_name} onChange={(e) => set("advisor_name", e.target.value)} placeholder="เช่น ผศ.ดร. …" />
        </Field>
        <Field label="เบอร์โทรติดต่อ" htmlFor="contact_phone" required error={errors.contact_phone}>
          <Input id="contact_phone" type="tel" inputMode="tel" value={v.contact_phone}
            onChange={(e) => set("contact_phone", e.target.value)} placeholder="08xxxxxxxx" aria-invalid={!!errors.contact_phone} />
        </Field>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-maroon-800">อุปกรณ์ที่ต้องการให้เจ้าหน้าที่เตรียม</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(EQUIPMENT).map(([k, label]) => (
            <Checkbox key={k} label={label} checked={v.equipment.includes(k)}
              onChange={(e) => set("equipment", e.target.checked ? [...v.equipment, k] : v.equipment.filter((x) => x !== k))} />
          ))}
        </div>
      </section>

      <Field label="หมายเหตุเพิ่มเติม" htmlFor="extra_notes" error={errors.extra_notes}>
        <Textarea id="extra_notes" value={v.extra_notes} onChange={(e) => set("extra_notes", e.target.value)} className="min-h-16" />
      </Field>

      <div className="rounded-lg border border-slate-200 p-3">
        <Checkbox
          checked={agree}
          onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: "" })); }}
          label="ข้าพเจ้ายืนยันว่าข้อมูลข้างต้นเป็นความจริง และจะดูแลความสะอาด ความเรียบร้อย และทรัพย์สินภายในห้องตามระเบียบของคณะ"
        />
        {errors.agree && <p className="mt-1 text-xs text-red-600">{errors.agree}</p>}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>ยกเลิก</Button>
        )}
        <Button type="submit" size="lg" loading={busy} disabled={disabled}>
          <Send className="h-4 w-4" /> {submitLabel}
        </Button>
      </div>
    </form>
  );
}
