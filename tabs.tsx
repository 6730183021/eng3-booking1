"use client";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value, onChange, items, className,
}: {
  value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; count?: number }[]; className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-1", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            value === it.value ? "bg-white text-maroon-800 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-xs", value === it.value ? "bg-maroon-100 text-maroon-800" : "bg-slate-200 text-slate-600")}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
