"use client";
import { Lock } from "lucide-react";
import { fmtCountdown } from "@/lib/time";
import { cn } from "@/lib/utils";

export function HoldCountdown({ expiresAt, now, totalMinutes }: { expiresAt: string; now: Date; totalMinutes: number }) {
  const left = new Date(expiresAt).getTime() - now.getTime();
  const pct = Math.max(0, Math.min(100, (left / (totalMinutes * 60_000)) * 100));
  const urgent = left < 2 * 60_000;
  return (
    <div className={cn("rounded-xl border p-3", urgent ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")} role="timer" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", urgent ? "text-red-800" : "text-amber-900")}>
          <Lock className="h-4 w-4" />
          ห้องถูกล็อกไว้ให้คุณ
        </p>
        <span className={cn("font-mono text-2xl font-bold tabular-nums", urgent ? "text-red-700" : "text-amber-800")} suppressHydrationWarning>
          {fmtCountdown(left)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-red-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-600">ผู้อื่นจะจองช่วงเวลานี้ไม่ได้จนกว่าจะหมดเวลา กรุณาส่งแบบฟอร์มภายในเวลาที่กำหนด</p>
    </div>
  );
}
