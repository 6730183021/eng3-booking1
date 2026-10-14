"use client";
// The student booking flow:  ① choose date/time + room on the live floor plan
//                            ② room is LOCKED for N minutes while the form is filled
//                            ③ submit → document number + PDF
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays, CheckCircle2, Clock, Download, Layers, Lock, MapPin, Radio, RefreshCw, TriangleAlert, Users,
} from "lucide-react";
import { holdSlot, releaseHold, submitBooking } from "@/app/actions/bookings";
import { useServerClock } from "@/hooks/use-now";
import { useRoomAvailability } from "@/hooks/use-room-availability";
import { computeRoomStates, STATE_STYLE } from "@/lib/room-state";
import { endOptions, firstBookableDate, firstStartOn, startOptions, validateSelection } from "@/lib/rules";
import {
  addDays, dateKey, fmtCountdown, fmtDate, fmtDuration, fmtTimeRange, isoDow, minutesOf, timeKey, toInstant,
} from "@/lib/time";
import type { Booking, BookingSettings, BookingWithRoom, Floor, Profile, Room } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { FloorLegend, FloorPlan } from "@/components/floor-plan/floor-plan";
import { FacilityChips } from "@/components/floor-plan/facility-icon";
import { BookingForm } from "./booking-form";
import { DaySchedule } from "./day-schedule";
import { HoldCountdown } from "./hold-countdown";

type Step = "select" | "form" | "done";

interface Props {
  floors: Floor[];
  rooms: Room[];
  settings: BookingSettings;
  profile: Profile;
  activeHold: BookingWithRoom | null;
  /** Date.now() on the server at render time — used to correct the client clock */
  serverNow: number;
}

export function BookingWorkspace({ floors, rooms: initialRooms, settings, profile, activeHold, serverNow }: Props) {
  const { now, calibrate } = useServerClock(serverNow, 1000);
  const [step, setStep] = useState<Step>(activeHold ? "form" : "select");
  const [hold, setHold] = useState<Booking | null>(activeHold);
  const [submitted, setSubmitted] = useState<BookingWithRoom | null>(null);
  const [conflict, setConflict] = useState<{ code: string; message: string; until?: string } | null>(null);
  const [locking, startLocking] = useTransition();

  // ---------------------------------------------------------------- selection
  const [sel, setSel] = useState(() => {
    if (activeHold) return { date: dateKey(activeHold.starts_at), start: timeKey(activeHold.starts_at), end: timeKey(activeHold.ends_at) };
    const d = firstBookableDate(settings, new Date(serverNow));
    const s = firstStartOn(settings, d, new Date(serverNow));
    return { date: d, start: s, end: endOptions(settings, s)[1] ?? endOptions(settings, s)[0] };
  });
  const [floorNo, setFloorNo] = useState(activeHold?.room.floor ?? floors[0]?.floor ?? 1);
  const [selectedId, setSelectedId] = useState<string | null>(activeHold?.room_id ?? null);

  const changeSelection = (patch: Partial<typeof sel>) => {
    setConflict(null);
    setSel((prev) => {
      const next = { ...prev, ...patch };
      if (patch.date && !patch.start) {
        const minStart = firstStartOn(settings, next.date, now);
        if (minutesOf(next.start) < minutesOf(minStart) && next.date === firstBookableDate(settings, now)) next.start = minStart;
      }
      const ends = endOptions(settings, next.start);
      if (!ends.includes(next.end)) {
        const keep = minutesOf(prev.end) - minutesOf(prev.start);
        next.end = ends.find((t) => minutesOf(t) - minutesOf(next.start) >= keep) ?? ends.at(-1) ?? next.end;
      }
      return next;
    });
  };

  const range = useMemo(() => ({ start: toInstant(sel.date, sel.start), end: toInstant(sel.date, sel.end) }), [sel]);
  const ruleError = step === "select" ? validateSelection(settings, sel.date, sel.start, sel.end, now) : null;

  // ---------------------------------------------------------------- live data
  const { slots, blocks, rooms, live, loading } = useRoomAvailability(sel.date, initialRooms);
  const states = useMemo(
    () => computeRoomStates(rooms, slots, blocks, range, now, hold?.id),
    [rooms, slots, blocks, range, now, hold?.id],
  );
  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null;
  const floor = floors.find((f) => f.floor === floorNo) ?? floors[0];
  const floorRooms = rooms.filter((r) => r.floor === floor?.floor);
  const availableByFloor = (f: number) =>
    rooms.filter((r) => r.floor === f && states[r.id]?.state === "available").length;

  // the 7 next bookable days as quick chips
  const firstDay = firstBookableDate(settings, now);
  const dayChips = useMemo(() => {
    const out: string[] = [];
    let d = firstDay;
    while (out.length < 7) {
      if (settings.open_days.includes(isoDow(d))) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [settings, firstDay]);

  // hold lost (expired / released in another tab)?
  const holdExpired = !!hold?.hold_expires_at && new Date(hold.hold_expires_at) <= now;

  useEffect(() => {
    if (step !== "form") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  // ---------------------------------------------------------------- actions
  function lockRoom() {
    if (!selectedRoom) return;
    setConflict(null);
    startLocking(async () => {
      const res = await holdSlot(selectedRoom.id, range.start.toISOString(), range.end.toISOString());
      if (!res.ok) {
        setConflict({ code: res.code, message: res.message, until: res.code === "SLOT_LOCKED" ? res.detail : undefined });
        toast.error(res.message);
        return;
      }
      calibrate(res.data.created_at);
      setHold(res.data);
      setStep("form");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success(`ล็อกห้อง ${selectedRoom.code} ไว้ให้คุณ ${settings.hold_minutes} นาที`);
    });
  }

  async function cancelHold() {
    if (hold) await releaseHold(hold.id);
    setHold(null);
    setStep("select");
    toast("ปลดล็อกห้องแล้ว");
  }

  function relock() {
    setHold(null);
    setStep("select");
    lockRoom();
  }

  // ---------------------------------------------------------------- render
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จองห้อง อาคาร 3</h1>
          <p className="text-sm text-slate-500">เลือกวัน–เวลา แล้วเลือกห้องจากแผนผัง สถานะห้องอัปเดตแบบเรียลไทม์</p>
        </div>
        <Stepper step={step} />
      </div>

      {step === "select" && (
        <>
          {/* ---------- date & time ---------- */}
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <CalendarDays className="h-4 w-4 text-maroon-700" /> วันที่
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {dayChips.map((d) => (
                    <button
                      key={d}
                      onClick={() => changeSelection({ date: d })}
                      className={cn(
                        "flex min-w-14 flex-col items-center rounded-lg border px-2 py-1 text-xs transition-colors",
                        sel.date === d ? "border-maroon-700 bg-maroon-700 text-white" : "border-slate-200 bg-white hover:border-maroon-300",
                      )}
                    >
                      <span className="opacity-80">{fmtDate(d, "medium").split(" ")[0]}</span>
                      <span className="text-base leading-tight font-semibold">{Number(d.slice(8))}</span>
                    </button>
                  ))}
                  <Input
                    type="date"
                    aria-label="เลือกวันที่อื่น"
                    className="w-40"
                    value={sel.date}
                    min={dayChips[0]}
                    max={dateKey(new Date(now.getTime() + settings.max_advance_days * 86400_000))}
                    onChange={(e) => e.target.value && changeSelection({ date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-maroon-700" /> เริ่ม</span>
                  <Select value={sel.start} onChange={(e) => changeSelection({ start: e.target.value })} className="w-28">
                    {startOptions(settings).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </label>
                <span className="pb-2.5 text-slate-400">–</span>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  สิ้นสุด
                  <Select value={sel.end} onChange={(e) => changeSelection({ end: e.target.value })} className="w-28">
                    {endOptions(settings, sel.start).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </label>
              </div>
            </CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-2.5 text-sm">
              <span className="font-medium text-slate-800">
                {fmtDate(sel.date)} · {sel.start}–{sel.end} น. ({fmtDuration(minutesOf(sel.end) - minutesOf(sel.start))})
              </span>
              {ruleError ? (
                <span className="flex items-center gap-1 text-red-600"><TriangleAlert className="h-4 w-4" /> {ruleError}</span>
              ) : (
                <span className="text-xs text-slate-500">
                  จองล่วงหน้า ≥ {settings.min_lead_hours} ชม. · ครั้งละไม่เกิน {fmtDuration(settings.max_duration_minutes)}
                </span>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* ---------- floor plan ---------- */}
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Layers className="hidden h-4 w-4 shrink-0 text-maroon-700 sm:block" />
                  <div role="tablist" aria-label="เลือกชั้น" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-1">
                    {floors.map((f) => (
                      <button
                        key={f.floor}
                        role="tab"
                        aria-selected={f.floor === floorNo}
                        onClick={() => setFloorNo(f.floor)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                          f.floor === floorNo ? "bg-white text-maroon-800 shadow-sm" : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {f.label}
                        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 text-xs text-emerald-700">{availableByFloor(f.floor)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <LiveBadge live={live} />
              </CardHeader>
              <CardContent className="space-y-3">
                {floor && (
                  // On phones the plan keeps a readable size and scrolls sideways
                  <div className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
                    <FloorPlan
                      floor={floor}
                      rooms={floorRooms}
                      states={states}
                      now={now}
                      selectedRoomId={selectedId}
                      onSelect={(r) => {
                        setSelectedId(r.id);
                        setConflict(null);
                        // phones: bring the room panel into view after a tap
                        if (window.matchMedia("(max-width: 1023px)").matches)
                          setTimeout(() => document.getElementById("room-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                      }}
                      className={cn("min-w-[680px]", loading && "opacity-60")}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-400 sm:hidden">← เลื่อนซ้าย–ขวาเพื่อดูทั้งชั้น →</p>
                <FloorLegend />
              </CardContent>
            </Card>

            {/* ---------- room panel ---------- */}
            <Card id="room-panel" className="h-fit scroll-mt-20 lg:sticky lg:top-20">
              {!selectedRoom ? (
                <CardContent className="flex flex-col items-center py-14 text-center text-slate-500">
                  <MapPin className="mb-3 h-10 w-10 text-maroon-200" />
                  <p className="font-medium text-slate-700">เลือกห้องจากแผนผัง</p>
                  <p className="mt-1 text-sm">แตะหรือคลิกที่ห้องเพื่อดูความจุ อุปกรณ์ และตารางว่างของวันนั้น</p>
                </CardContent>
              ) : (
                <>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{selectedRoom.code}</CardTitle>
                        <p className="text-sm text-slate-600">{selectedRoom.name}</p>
                      </div>
                      <RoomStateChip state={states[selectedRoom.id]?.state ?? "available"} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Users className="h-4 w-4" /> ความจุ {selectedRoom.capacity} คน · ชั้น {selectedRoom.floor}
                    </p>
                    <FacilityChips facilities={selectedRoom.facilities} />
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">ตารางห้องวันนี้ (คลิกเพื่อเลือกเวลาเริ่ม)</p>
                      <DaySchedule
                        roomId={selectedRoom.id} slots={slots} blocks={blocks} settings={settings}
                        selection={range} now={now} myHoldId={hold?.id}
                        onPick={(t) => changeSelection({ start: t })}
                      />
                    </div>

                    <RoomAction
                      info={states[selectedRoom.id]}
                      room={selectedRoom}
                      ruleError={ruleError}
                      conflict={conflict}
                      now={now}
                      locking={locking}
                      holdMinutes={settings.hold_minutes}
                      onLock={lockRoom}
                    />
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {step === "form" && hold && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="h-fit space-y-4 lg:sticky lg:top-20">
            {holdExpired ? (
              <Card className="border-red-200">
                <CardContent className="space-y-3">
                  <p className="flex items-center gap-2 font-semibold text-red-700"><TriangleAlert className="h-5 w-5" /> หมดเวลาล็อกห้อง</p>
                  <p className="text-sm text-slate-600">ห้องถูกปล่อยให้ผู้อื่นจองได้แล้ว กดล็อกใหม่หากช่วงเวลายังว่างอยู่</p>
                  <Button onClick={relock} loading={locking} className="w-full"><RefreshCw className="h-4 w-4" /> ล็อกห้องอีกครั้ง</Button>
                  <Button variant="ghost" onClick={() => { setHold(null); setStep("select"); }} className="w-full">เลือกห้องใหม่</Button>
                </CardContent>
              </Card>
            ) : (
              <HoldCountdown expiresAt={hold.hold_expires_at!} now={now} totalMinutes={settings.hold_minutes} />
            )}
            <Card>
              <CardHeader><CardTitle>สรุปการจอง</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(() => {
                  const r = rooms.find((x) => x.id === hold.room_id) ?? activeHold?.room;
                  return (
                    <>
                      <p className="text-lg font-semibold text-maroon-800">{r?.code} <span className="text-base font-normal text-slate-600">{r?.name}</span></p>
                      <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-400" /> {fmtDate(hold.starts_at)}</p>
                      <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {fmtTimeRange(hold.starts_at, hold.ends_at)}</p>
                      <p className="flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" /> ความจุ {r?.capacity} คน · ชั้น {r?.floor}</p>
                    </>
                  );
                })()}
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={cancelHold}>ยกเลิกและเลือกห้องใหม่</Button>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>แบบคำร้องขอใช้ห้อง</CardTitle>
              <p className="text-sm text-slate-500">ข้อมูลนี้จะถูกสร้างเป็นเอกสาร PDF ตามแบบฟอร์มของคณะโดยอัตโนมัติ</p>
            </CardHeader>
            <CardContent>
              <BookingForm
                room={rooms.find((x) => x.id === hold.room_id) ?? activeHold!.room}
                profile={profile}
                disabled={holdExpired}
                onCancel={cancelHold}
                onSubmit={async (values) => {
                  const res = await submitBooking(hold.id, values);
                  if (!res.ok) {
                    toast.error(res.message);
                    return { ok: false, message: res.message, fields: "fields" in res ? res.fields : undefined };
                  }
                  setSubmitted(res.data);
                  setHold(null);
                  setStep("done");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  return { ok: true };
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {step === "done" && submitted && (
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-3 h-14 w-14 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-900">ส่งคำร้องเรียบร้อยแล้ว</h2>
            <p className="mt-1 text-slate-600">
              เลขที่คำร้อง <span className="font-mono font-semibold text-maroon-800">{submitted.doc_no}</span>
            </p>
            <div className="mt-4 w-full rounded-xl bg-slate-50 p-4 text-left text-sm">
              <p><b>{submitted.room.code}</b> {submitted.room.name}</p>
              <p>{fmtDate(submitted.starts_at)} · {fmtTimeRange(submitted.starts_at, submitted.ends_at)}</p>
              <p className="text-slate-600">{submitted.activity_name} · {submitted.attendees} คน</p>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              ระบบส่งอีเมลยืนยันให้แล้ว และจะแจ้งเตือนทันทีเมื่อเจ้าหน้าที่อนุมัติ ติดตามสถานะได้ที่หน้า “การจองของฉัน”
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <a href={`/api/bookings/${submitted.id}/pdf?download=1`} className={buttonClass("outline")}>
                <Download className="h-4 w-4" /> ดาวน์โหลดเอกสาร PDF
              </a>
              <Link href="/my-bookings" className={buttonClass("default")}>ติดตามสถานะ</Link>
              <Button variant="ghost" onClick={() => { setSubmitted(null); setSelectedId(null); setStep("select"); }}>
                จองห้องอื่น
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- sub-components
function Stepper({ step }: { step: Step }) {
  const steps: [Step, string][] = [["select", "เลือกห้องและเวลา"], ["form", "กรอกแบบฟอร์ม"], ["done", "ส่งคำร้อง"]];
  const idx = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex items-center gap-2 text-xs sm:text-sm">
      {steps.map(([s, label], i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
            i < idx ? "bg-emerald-500 text-white" : i === idx ? "bg-maroon-700 text-white" : "bg-slate-200 text-slate-500",
          )}>{i < idx ? "✓" : i + 1}</span>
          <span className={cn(i === idx ? "font-semibold text-slate-900" : "hidden text-slate-500 sm:inline")}>{label}</span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-slate-300" />}
        </li>
      ))}
    </ol>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
      <Radio className={cn("h-3.5 w-3.5", live && "animate-pulse")} />
      {live ? "เรียลไทม์" : "กำลังเชื่อมต่อ…"}
    </span>
  );
}

function RoomStateChip({ state }: { state: keyof typeof STATE_STYLE }) {
  const s = STATE_STYLE[state];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ borderColor: s.stroke, color: s.text, background: s.fill }}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} /> {s.label}
    </span>
  );
}

function RoomAction({
  info, room, ruleError, conflict, now, locking, holdMinutes, onLock,
}: {
  info?: ReturnType<typeof computeRoomStates>[string];
  room: Room; ruleError: string | null;
  conflict: { code: string; message: string; until?: string } | null;
  now: Date; locking: boolean; holdMinutes: number; onLock: () => void;
}) {
  const state = info?.state ?? "available";
  let blocked: string | null = ruleError;
  if (!blocked) {
    if (state === "maintenance") blocked = `ปิดปรับปรุง${room.status_note ? `: ${room.status_note}` : ""}`;
    else if (state === "blocked") blocked = `ปิดการจองช่วงนี้: ${info?.block?.reason ?? ""}`;
    else if (state === "booked") blocked = "ช่วงเวลานี้ถูกจองแล้ว ลองเลือกเวลาอื่นจากตารางด้านบน";
    else if (state === "held" && info?.slot?.hold_expires_at)
      blocked = `มีผู้ใช้อื่นกำลังทำรายการอยู่ · จะว่างอีกครั้งใน ${fmtCountdown(new Date(info.slot.hold_expires_at).getTime() - now.getTime())} หากเขาไม่ยืนยัน`;
  }
  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      {conflict && !blocked && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{conflict.message}</p>
      )}
      {blocked ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600" role="status" suppressHydrationWarning>{blocked}</p>
      ) : (
        <p className="text-xs text-slate-500">
          เมื่อกดปุ่ม ระบบจะล็อกห้องนี้ไว้ให้คุณ {holdMinutes} นาที (ขึ้นสีเหลืองบนจอของทุกคน) เพื่อกรอกแบบฟอร์ม
        </p>
      )}
      <Button size="lg" className="w-full" onClick={onLock} loading={locking} disabled={!!blocked}>
        <Lock className="h-4 w-4" /> ล็อกห้องนี้และกรอกแบบฟอร์ม
      </Button>
    </div>
  );
}
