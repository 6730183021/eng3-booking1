import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { ROLE_LABELS, isStaffRole } from "@/lib/constants";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function AppHeader({ user, mode = "student" }: { user: CurrentUser; mode?: "student" | "admin" }) {
  const studentNav = [
    { href: "/book", label: "จองห้อง" },
    { href: "/my-bookings", label: "การจองของฉัน" },
  ];
  return (
    <header className="sticky top-0 z-30 bg-maroon-700 text-white shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
        <Brand light href={mode === "admin" ? "/admin" : "/book"} />
        {mode === "student" && (
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLinks items={studentNav} />
          </nav>
        )}
        {mode === "admin" && (
          <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">โหมดเจ้าหน้าที่</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {isStaffRole(user.role) && (
            <Link
              href={mode === "admin" ? "/book" : "/admin"}
              className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-maroon-100 hover:bg-white/10 sm:flex"
            >
              <ShieldCheck className="h-4 w-4" />
              {mode === "admin" ? "ไปหน้าจองห้อง" : "หลังบ้าน"}
            </Link>
          )}
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{user.full_name ?? user.email}</p>
            <p className="text-[11px] text-maroon-100">
              {user.role === "student" ? user.student_id ?? user.email : ROLE_LABELS[user.role]}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg p-2 text-maroon-100 hover:bg-white/10 hover:text-white" aria-label="ออกจากระบบ" title="ออกจากระบบ">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
      {mode === "student" && (
        <nav className="flex gap-1 border-t border-white/10 px-2 py-1 md:hidden">
          <NavLinks items={studentNav} />
        </nav>
      )}
    </header>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-30 h-16 bg-maroon-700">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
        <Brand light />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print mt-10 border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
      ระบบจองห้อง อาคาร 3 · คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย · MVP
    </footer>
  );
}
