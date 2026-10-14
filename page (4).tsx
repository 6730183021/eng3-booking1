import { Suspense } from "react";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BookingSettings, StaffMember } from "@/lib/types";
import { SettingsForm, StaffManager } from "@/components/admin/settings-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "ตั้งค่าระบบ" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const me = await requireSuperAdmin();
  const supabase = await createClient();
  const [settings, staff] = await Promise.all([
    supabase.from("booking_settings").select("*").single(),
    supabase.from("staff_members").select("*").order("role").order("email"),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-500">กฎการจองมีผลทันทีทั้งในหน้าเว็บและในฐานข้อมูล</p>
      </div>
      <SettingsForm initial={settings.data as BookingSettings} />
      <StaffManager initial={(staff.data ?? []) as StaffMember[]} myEmail={me.email} />
    </div>
  );
}
