import Link from "next/link";
import { APP_NAME, FACULTY_NAME } from "@/lib/constants";

/** Text-based mark (does not use the university's official emblem) */
export function Brand({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black tracking-tight ${light ? "bg-white text-maroon-700" : "bg-maroon-700 text-white"}`}>
        E3
      </span>
      <span className="leading-tight">
        <span className={`block text-sm font-bold ${light ? "text-white" : "text-slate-900"}`}>{APP_NAME}</span>
        <span className={`hidden text-[11px] sm:block ${light ? "text-maroon-100" : "text-slate-500"}`}>{FACULTY_NAME}</span>
      </span>
    </Link>
  );
}
