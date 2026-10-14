"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { saveProfile } from "@/app/actions/profile";
import { DEPARTMENTS } from "@/lib/constants";
import { fieldErrors, staffProfileSchema, studentProfileSchema } from "@/lib/validation";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

export function OnboardingForm({ profile, firstTime }: { profile: Profile; firstTime: boolean }) {
  const router = useRouter();
  const isStudent = profile.role === "student";
  const [v, setV] = useState({
    full_name: profile.full_name ?? "",
    department: profile.department ?? "",
    year_of_study: profile.year_of_study ? String(profile.year_of_study) : "",
    phone: profile.phone ?? "",
  });
  const [accepted, setAccepted] = useState(!!profile.privacy_accepted_at);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = isStudent ? { ...v, accept_privacy: accepted } : { full_name: v.full_name, phone: v.phone };
    const parsed = (isStudent ? studentProfileSchema : staffProfileSchema).safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await saveProfile(input);
    setBusy(false);
    if (!res.ok) {
      if ("fields" in res && res.fields) setErrors(res.fields);
      return toast.error(res.message);
    }
    toast.success("บันทึกข้อมูลแล้ว");
    router.replace(isStudent ? "/book" : "/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {firstTime ? (isStudent ? "ยืนยันข้อมูลนิสิตก่อนเริ่มใช้งาน" : "ยืนยันข้อมูลเจ้าหน้าที่") : "ข้อมูลส่วนตัว"}
          </CardTitle>
          <p className="text-sm text-slate-500">
            {isStudent
              ? "ข้อมูลนี้ใช้กรอกลงเอกสารคำร้องอย่างเป็นทางการโดยอัตโนมัติ — กรอกครั้งเดียว ใช้ได้ทุกการจอง"
              : "ชื่อของคุณจะแสดงในเอกสารเมื่อเป็นผู้พิจารณาคำร้อง"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="อีเมลจุฬาฯ" className={isStudent ? undefined : "sm:col-span-2"}>
              <Input value={profile.email} disabled />
            </Field>
            {isStudent && (
              <Field label="รหัสนิสิต" hint="ดึงจากอีเมลจุฬาฯ อัตโนมัติ (แก้ไขไม่ได้)">
                <Input value={profile.student_id ?? "ไม่พบ — กรุณาติดต่อเจ้าหน้าที่"} disabled />
              </Field>
            )}
            <Field label="ชื่อ–นามสกุล (ภาษาไทย)" htmlFor="full_name" required error={errors.full_name} className="sm:col-span-2">
              <Input id="full_name" value={v.full_name} onChange={(e) => set("full_name", e.target.value)}
                placeholder="นายสมชาย ใจดี" aria-invalid={!!errors.full_name} />
            </Field>
            {isStudent && (
              <>
                <Field label="ภาควิชา" htmlFor="department" required error={errors.department}>
                  <Select id="department" value={v.department} onChange={(e) => set("department", e.target.value)} aria-invalid={!!errors.department}>
                    <option value="">— เลือก —</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="ชั้นปี" htmlFor="year_of_study" required error={errors.year_of_study}>
                  <Select id="year_of_study" value={v.year_of_study} onChange={(e) => set("year_of_study", e.target.value)} aria-invalid={!!errors.year_of_study}>
                    <option value="">— เลือก —</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>ปี {y}</option>)}
                  </Select>
                </Field>
              </>
            )}
            <Field label="เบอร์โทรศัพท์" htmlFor="phone" required={isStudent} error={errors.phone}>
              <Input id="phone" type="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)}
                placeholder="08xxxxxxxx" aria-invalid={!!errors.phone} />
            </Field>

            {isStudent && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:col-span-2">
                <p className="mb-2 flex items-center gap-1.5 font-medium text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-maroon-700" /> การเก็บและใช้ข้อมูลส่วนบุคคล
                </p>
                <p className="mb-2 text-slate-600">
                  คณะฯ เก็บชื่อ รหัสนิสิต ภาควิชา ชั้นปี เบอร์โทรศัพท์ และอีเมลของคุณ เพื่อจัดทำเอกสารคำร้องขอใช้ห้อง
                  ติดต่อกลับเกี่ยวกับการจอง และเป็นหลักฐานการใช้ห้อง ข้อมูลจะเปิดให้เฉพาะเจ้าหน้าที่ที่เกี่ยวข้องเท่านั้น
                </p>
                <Checkbox
                  checked={accepted}
                  onChange={(e) => { setAccepted(e.target.checked); setErrors((x) => ({ ...x, accept_privacy: "" })); }}
                  label="ข้าพเจ้ารับทราบและยินยอมให้ใช้ข้อมูลตามวัตถุประสงค์ข้างต้น"
                />
                {errors.accept_privacy && <p className="mt-1 text-xs text-red-600">{errors.accept_privacy}</p>}
              </div>
            )}

            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" size="lg" loading={busy} disabled={isStudent && !profile.student_id}>
                {firstTime && isStudent ? "บันทึกและเริ่มจองห้อง" : "บันทึก"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
