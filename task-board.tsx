"use client";
// Operation board for the staff who open / close rooms.
// Each approved booking produces two tasks: OPEN (before start) and CLOSE (at end).
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, DoorClosed, DoorOpen, Phone, Printer, Users } from "lucide-react";
import { markRoomTask } from "@/app/actions/admin";
import { useNow } from "@/hooks/use-now";
import { useDebounced, useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { EQUIPMENT } from "@/lib/constants";
import { BOOKING_WITH_ROOM } from "@/lib/queries";
import { addDays, dateKey, dayBounds, fmtDate, timeKey } from "@/lib/time";
import type { BookingWithRoom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { LiveBadge } from "@/components/booking/booking-workspace";

const OPEN_LEAD_MIN = 15; // go and unlock 15 minutes before the booking starts

interface Task {
  key: string;
  kind: "open" | "close";
  at: Date;
  booking: BookingWithRoom;
  doneAt: string | null;
}

export function TaskBoard() {
  const supabase = useMemo(() => createClient(), []);
  const now = useNow(30_000);
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [bookings, setBookings] = useState<BookingWithRoom[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== date;

  const fetchDay = useCallback(
    async (day: string) => {
      const { start, end } = dayBounds(day);
      const { data } = await supabase
        .from("bookings")
        .select(BOOKING_WITH_ROOM)
        .eq("status", "approved")
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at");
      return { day, rows: (data ?? []) as BookingWithRoom[] };
    },
    [supabase],
  );
  const apply = useCallback(
    ({ day, rows }: { day: string; rows: BookingWithRoom[] }) => {
      setBookings(rows);
      setLoadedFor(day);
    },
    [],
  );
  const load = useCallback(() => fetchDay(date).then(apply), [fetchDay, apply, date]);

  useEffect(() => {
    let stale = false;
    fetchDay(date).then((r) => !stale && apply(r));
    return () => {
      stale = true;
    };
  }, [fetchDay, apply, date]);
  const reload = useDebounced(load, 150);
  const live = useRealtime(`tasks-${date}`, [{ table: "bookings" }], reload);

  const tasks: Task[] = bookings
    .flatMap((b) => [
      { key: `${b.id}-open`, kind: "open" as const, at: new Date(new Date(b.starts_at).getTime() - OPEN_LEAD_MIN * 60_000), booking: b, doneAt: b.opened_at },
      { key: `${b.id}-close`, kind: "close" as const, at: new Date(b.ends_at), booking: b, doneAt: b.closed_at },
    ])
    .sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === "close" ? -1 : 1));

  const isToday = date === dateKey(now);
  const done = tasks.filter((t) => t.doneAt).length;
  const overdue = tasks.filter((t) => !t.doneAt && isToday && t.at < now).length;

  async function complete(t: Task) {
    const res = await markRoomTask(t.booking.id, t.kind);
    if (!res.ok) return toast.error(res.message);
    toast.success(t.kind === "open" ? `บันทึก: เปิดห้อง ${t.booking.room.code} แล้ว` : `บันทึก: ปิดห้อง ${t.booking.room.code} เรียบร้อย`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ตารางงานเปิด–ปิดห้อง</h1>
          <p className="text-sm text-slate-500">{fmtDate(date)} · แสดงเฉพาะรายการที่อนุมัติแล้ว · ควรเปิดห้องก่อนเวลา {OPEN_LEAD_MIN} นาที</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <LiveBadge live={live} />
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="วันก่อนหน้า"><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="วันถัดไป"><ChevronRight className="h-4 w-4" /></Button>
          {!isToday && <Button variant="ghost" size="sm" onClick={() => setDate(dateKey(new Date()))}>วันนี้</Button>}
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> พิมพ์</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="ห้องที่ใช้งาน" value={bookings.length} />
        <Kpi label="งานทั้งหมด" value={tasks.length} />
        <Kpi label="เสร็จแล้ว" value={done} tone="good" />
        <Kpi label="เลยเวลา / ค้าง" value={overdue} tone={overdue ? "bad" : undefined} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="py-16 text-center text-slate-400">กำลังโหลด…</p>
        ) : tasks.length === 0 ? (
          <p className="py-16 text-center text-slate-500">ไม่มีห้องที่ต้องเปิด–ปิดในวันนี้</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => {
              const b = t.booking;
              const late = !t.doneAt && isToday && t.at < now;
              const soon = !t.doneAt && isToday && !late && t.at.getTime() - now.getTime() < 30 * 60_000;
              const blockedClose = t.kind === "close" && !b.opened_at;
              return (
                <li key={t.key} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", late && "bg-red-50/60", soon && "bg-amber-50/70", t.doneAt && "opacity-70")}>
                  <div className="flex w-36 shrink-0 items-center gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", t.kind === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>
                      {t.kind === "open" ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
                    </span>
                    <span>
                      <span className="block font-mono text-lg font-bold tabular-nums text-slate-900">{timeKey(t.at)}</span>
                      <span className="text-xs text-slate-500">{t.kind === "open" ? "เปิดห้อง" : "ปิดห้อง"}</span>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-slate-900">
                      {b.room.code} <span className="font-normal text-slate-600">{b.room.name} · ชั้น {b.room.floor}</span>
                    </p>
                    <p className="text-slate-600">
                      {timeKey(b.starts_at)}–{timeKey(b.ends_at)} น. · {b.activity_name}
                      <span className="ml-1 inline-flex items-center gap-0.5 text-slate-500"><Users className="h-3.5 w-3.5" />{b.attendees}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span>{b.requester?.full_name} ({b.requester?.student_id})</span>
                      <a href={`tel:${b.contact_phone}`} className="inline-flex items-center gap-1 text-maroon-700 hover:underline"><Phone className="h-3 w-3" />{b.contact_phone}</a>
                      <span className="font-mono">{b.doc_no}</span>
                    </p>
                    {t.kind === "open" && b.equipment.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {b.equipment.map((e) => (
                          <span key={e} className="rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">เตรียม: {EQUIPMENT[e] ?? e}</span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 sm:w-48 sm:text-right">
                    {t.doneAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        ✓ {t.kind === "open" ? "เปิดแล้ว" : "ปิดแล้ว"} {timeKey(t.doneAt)} น.
                      </span>
                    ) : (
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {late && <span className="text-xs font-medium text-red-700">เลยเวลาแล้ว</span>}
                        {soon && <span className="text-xs font-medium text-amber-700">ใกล้ถึงเวลา</span>}
                        <Button
                          size="sm"
                          variant={t.kind === "open" ? "success" : "default"}
                          onClick={() => complete(t)}
                          disabled={blockedClose}
                          title={blockedClose ? "ต้องบันทึกการเปิดห้องก่อน" : undefined}
                          className="no-print"
                        >
                          {t.kind === "open" ? "ยืนยันเปิดห้องแล้ว" : "ยืนยันปิดห้องเรียบร้อย"}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}
