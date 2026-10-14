"use client";
// Horizontal day timeline for one room: what is taken, what is free, and the current selection.
import type { BookingSettings, RoomBlock, RoomSlot } from "@/lib/types";
import { hm } from "@/lib/rules";
import { fmtTimeRange, hhmm, minutesOf, timeKey } from "@/lib/time";
import { isLiveSlot } from "@/lib/room-state";
import { cn } from "@/lib/utils";

export function DaySchedule({
  roomId, slots, blocks, settings, selection, now, myHoldId, onPick,
}: {
  roomId: string; slots: RoomSlot[]; blocks: RoomBlock[]; settings: BookingSettings;
  selection: { start: Date; end: Date }; now: Date; myHoldId?: string | null; onPick?: (hhmm: string) => void;
}) {
  const open = minutesOf(hm(settings.open_time));
  const close = minutesOf(hm(settings.close_time));
  const span = close - open;
  const pos = (d: Date | string) => {
    const m = minutesOf(timeKey(d));
    return Math.max(0, Math.min(100, ((m - open) / span) * 100));
  };
  const segs = [
    ...slots
      .filter((s) => s.room_id === roomId && isLiveSlot(s, now))
      .map((s) => ({
        key: s.booking_id, from: s.starts_at, to: s.ends_at,
        cls: s.booking_id === myHoldId ? "bg-amber-300 ring-2 ring-maroon-700" : s.state === "held" ? "bg-amber-300" : "bg-red-400",
        title: `${s.state === "held" ? "มีคนกำลังจอง" : s.state === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"} ${fmtTimeRange(s.starts_at, s.ends_at)}`,
      })),
    ...blocks
      .filter((b) => b.room_id === roomId || b.room_id === null)
      .map((b) => ({ key: b.id, from: b.starts_at, to: b.ends_at, cls: "bg-slate-300", title: `ปิดการจอง: ${b.reason}` })),
  ];
  const hours: number[] = [];
  for (let m = Math.ceil(open / 60) * 60; m <= close; m += 60) hours.push(m);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const minute = open + ((e.clientX - r.left) / r.width) * span;
    const snapped = Math.floor(minute / settings.slot_minutes) * settings.slot_minutes;
    onPick(hhmm(Math.min(Math.max(snapped, open), close - settings.slot_minutes)));
  };

  return (
    <div>
      <div
        className={cn("relative h-9 overflow-hidden rounded-lg bg-emerald-50 ring-1 ring-emerald-200", onPick && "cursor-pointer")}
        onClick={handleClick}
        title={onPick ? "คลิกเพื่อเลือกเวลาเริ่ม" : undefined}
      >
        {hours.map((m) => (
          <span key={m} className="absolute top-0 h-full w-px bg-emerald-200" style={{ left: `${((m - open) / span) * 100}%` }} />
        ))}
        {segs.map((s) => (
          <span
            key={s.key}
            title={s.title}
            className={cn("absolute top-1 bottom-1 rounded", s.cls)}
            style={{ left: `${pos(s.from)}%`, width: `${pos(s.to) - pos(s.from)}%` }}
          />
        ))}
        <span
          className="absolute top-0 h-full rounded-md border-2 border-dashed border-maroon-700 bg-maroon-700/10"
          style={{ left: `${pos(selection.start)}%`, width: `${pos(selection.end) - pos(selection.start)}%` }}
          aria-label="ช่วงเวลาที่เลือก"
        />
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-slate-500">
        {hours.filter((_, i) => i % 2 === 0).map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - open) / span) * 100}%` }}>
            {String(m / 60).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
