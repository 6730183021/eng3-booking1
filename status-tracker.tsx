// Live status stepper: ส่งเรื่องแล้ว → กำลังตรวจสอบ → อนุมัติแล้ว / ไม่อนุมัติ
import { Check, X } from "lucide-react";
import type { Booking } from "@/lib/types";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "todo" | "failed";

export function StatusTracker({ booking, className }: { booking: Booking; className?: string }) {
  const s = booking.status;
  if (s === "cancelled") {
    return (
      <div className={cn("rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600", className)}>
        ⊘ ยกเลิกเมื่อ {booking.cancelled_at ? fmtDateTime(booking.cancelled_at) : "-"}
        {booking.cancel_reason && <span className="text-slate-500"> · {booking.cancel_reason}</span>}
      </div>
    );
  }

  const reviewed = s === "approved" || s === "rejected";
  const steps: { label: string; at?: string | null; state: StepState }[] = [
    { label: "ส่งเรื่องแล้ว", at: booking.submitted_at, state: "done" },
    {
      label: "เจ้าหน้าที่ตรวจสอบ",
      at: booking.review_started_at,
      state: reviewed ? "done" : s === "in_review" ? "current" : s === "submitted" ? "current" : "todo",
    },
    {
      label: s === "rejected" ? "ไม่อนุมัติ" : "อนุมัติแล้ว",
      at: booking.reviewed_at,
      state: s === "approved" ? "done" : s === "rejected" ? "failed" : "todo",
    },
  ];

  return (
    <ol className={cn("flex items-start", className)} aria-label="สถานะคำร้อง">
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && (
            <span
              className={cn(
                "absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2",
                step.state === "todo" ? "bg-slate-200" : step.state === "failed" ? "bg-red-300" : "bg-emerald-400",
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
              step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
              step.state === "current" && "border-violet-500 bg-white text-violet-600",
              step.state === "todo" && "border-slate-300 bg-white text-slate-400",
              step.state === "failed" && "border-red-500 bg-red-500 text-white",
            )}
          >
            {step.state === "done" ? <Check className="h-4 w-4" /> : step.state === "failed" ? <X className="h-4 w-4" /> : i + 1}
            {step.state === "current" && <span className="absolute inset-0 animate-ping rounded-full border-2 border-violet-400" />}
          </span>
          <span className={cn("mt-1.5 text-xs font-medium", step.state === "todo" ? "text-slate-400" : "text-slate-700")}>
            {step.state === "current" && i === 1 && s === "submitted" ? "รอเจ้าหน้าที่รับเรื่อง" : step.label}
          </span>
          {step.at && step.state !== "todo" && (
            <span className="text-[11px] text-slate-400">{fmtDateTime(step.at)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
