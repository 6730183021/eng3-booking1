"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, UserCog } from "lucide-react";
import { addStaffMember, removeStaffMember, saveSettings } from "@/app/actions/admin";
import { ROLE_LABELS } from "@/lib/constants";
import { hm } from "@/lib/rules";
import type { BookingSettings, StaffMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

export function SettingsForm({ initial }: { initial: BookingSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    ...initial,
    open_time: hm(initial.open_time),
    close_time: hm(initial.close_time),
  });
  const [busy, setBusy] = useState(false);
  const num = (k: keyof BookingSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setS((p) => ({ ...p, [k]: Number(e.target.value) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveSettings(s);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("บันทึกกฎการจองแล้ว");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>กฎการจอง (Booking rules)</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ต้องจองล่วงหน้าอย่างน้อย (ชั่วโมง)"><Input type="number" min={0} value={s.min_lead_hours} onChange={num("min_lead_hours")} /></Field>
          <Field label="จองได้สูงสุดต่อครั้ง (นาที)" hint="180 = 3 ชั่วโมง"><Input type="number" min={15} step={15} value={s.max_duration_minutes} onChange={num("max_duration_minutes")} /></Field>
          <Field label="หน่วยเวลาในการจอง">
            <Select value={s.slot_minutes} onChange={num("slot_minutes")}>
              {[15, 30, 60].map((m) => <option key={m} value={m}>{m} นาที</option>)}
            </Select>
          </Field>
          <Field label="เวลาเปิดอาคาร"><Input type="time" value={s.open_time} onChange={(e) => setS({ ...s, open_time: e.target.value })} /></Field>
          <Field label="เวลาปิดอาคาร" hint="ห้ามจองเกินเวลานี้"><Input type="time" value={s.close_time} onChange={(e) => setS({ ...s, close_time: e.target.value })} /></Field>
          <Field label="ล็อกห้องระหว่างกรอกฟอร์ม (นาที)" hint="Pessimistic lock 1–30 นาที"><Input type="number" min={1} max={30} value={s.hold_minutes} onChange={num("hold_minutes")} /></Field>
          <Field label="แก้ไขคำร้องได้ก่อนใช้ห้อง (ชั่วโมง)" hint="ใช้กับการยกเลิกรายการที่อนุมัติแล้วด้วย · รายการที่ยังไม่อนุมัติยกเลิกได้จนถึงเวลาเริ่ม">
            <Input type="number" min={0} value={s.cancel_before_hours} onChange={num("cancel_before_hours")} />
          </Field>
          <Field label="จองล่วงหน้าได้ไม่เกิน (วัน)"><Input type="number" min={1} value={s.max_advance_days} onChange={num("max_advance_days")} /></Field>
          <Field label="การจองที่ยังไม่สิ้นสุดต่อคน (รายการ)"><Input type="number" min={1} value={s.max_active_bookings} onChange={num("max_active_bookings")} /></Field>
          <fieldset className="sm:col-span-2 lg:col-span-3">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">วันที่เปิดให้จอง</legend>
            <div className="flex flex-wrap gap-4">
              {DAYS.map((d, i) => (
                <Checkbox key={d} label={d} checked={s.open_days.includes(i + 1)}
                  onChange={(e) => setS({ ...s, open_days: e.target.checked ? [...s.open_days, i + 1].sort() : s.open_days.filter((x) => x !== i + 1) })} />
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end sm:col-span-2 lg:col-span-3">
            <Button type="submit" loading={busy}>บันทึกกฎการจอง</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function StaffManager({ initial, myEmail }: { initial: StaffMember[]; myEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffMember["role"]>("staff");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addStaffMember(email, role);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(`เพิ่มสิทธิ์ ${email} แล้ว (มีผลเมื่อเข้าสู่ระบบ)`);
    setEmail("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-maroon-700" /> สิทธิ์เจ้าหน้าที่ (Role management)</CardTitle>
        <p className="text-sm text-slate-500">
          Staff = เปิด–ปิดห้อง · Approver = อนุมัติเอกสาร + จัดการการปิดจอง · Super Admin = จัดการทั้งระบบ
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@chula.ac.th" className="sm:flex-1" />
          <Select value={role} onChange={(e) => setRole(e.target.value as StaffMember["role"])} className="sm:w-56">
            <option value="staff">{ROLE_LABELS.staff}</option>
            <option value="approver">{ROLE_LABELS.approver}</option>
            <option value="super_admin">{ROLE_LABELS.super_admin}</option>
          </Select>
          <Button type="submit" loading={busy}><Plus className="h-4 w-4" /> เพิ่ม/เปลี่ยนสิทธิ์</Button>
        </form>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {initial.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1 truncate">{m.email}</span>
              <span className="rounded-full bg-maroon-50 px-2 py-0.5 text-xs text-maroon-800">{ROLE_LABELS[m.role]}</span>
              <Button size="icon" variant="ghost" disabled={m.email === myEmail} title="ถอนสิทธิ์"
                onClick={async () => {
                  const res = await removeStaffMember(m.email);
                  if (!res.ok) return toast.error(res.message);
                  toast.success("ถอนสิทธิ์แล้ว");
                  router.refresh();
                }}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </li>
          ))}
          {initial.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">ยังไม่มีเจ้าหน้าที่</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
