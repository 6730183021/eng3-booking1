"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ items, variant = "top" }: { items: { href: string; label: string }[]; variant?: "top" | "side" }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              variant === "top"
                ? active ? "bg-white/15 text-white" : "text-maroon-100 hover:bg-white/10 hover:text-white"
                : active ? "bg-maroon-50 text-maroon-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
