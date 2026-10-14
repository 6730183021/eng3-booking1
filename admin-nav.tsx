import type { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";
import { NavLinks } from "@/components/layout/nav-links";

export function AdminNav({ role }: { role: UserRole }) {
  const approver = role === "approver" || role === "super_admin";
  const items = [
    approver && { href: "/admin/approvals", label: "คำร้องรออนุมัติ" },
    { href: "/admin/tasks", label: "ตารางงานเปิด–ปิดห้อง" },
    approver && { href: "/admin/rooms", label: "จัดการห้อง / ปิดการจอง" },
    role === "super_admin" && { href: "/admin/settings", label: "ตั้งค่าระบบ" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <p className="px-3 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        {ROLE_LABELS[role]}
      </p>
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        <NavLinks items={items} variant="side" />
      </nav>
    </div>
  );
}
