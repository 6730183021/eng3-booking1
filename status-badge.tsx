import { STATUS_META } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", m.badge, className)}>
      <span aria-hidden>{m.icon}</span>
      {m.short}
    </span>
  );
}
