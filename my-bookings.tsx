"use client";
// Student dashboard: my bookings + live status tracker (updates in real time)
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, ChevronRight, Clock, Download, History, MapPin, Pencil, Plus, Users, XCircle } from "lucide-react";
import { cancelBooking, updateBookingDetails } from "@/app/actions/bookings";
import { useNow } from "@/hooks/use-now";
import { useDebounced, useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_TYPES, EVENT_LABELS, STATUS_META } from "@/lib/constants";
import { BOOKING_WITH_ROOM_AND_EVENTS } from "@/lib/queries";
import { modifyWindow } from "@/lib/rules";
import { fmtDate, fmtDateTime, fmtTimeRange } from "@/lib/time";
import type { BookingSettings, BookingWithRoom, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status/status-badge";
import { StatusTracker } from "@/components/status/status-tracker";
import { LiveBadge } from "./booking-workspace";
import { BookingForm } from "./booking-form";

export function MyBookings({
  userId, profile, initial, settings,
}: { userId: string; profile: Profile; initial: BookingWithRoom[]; settings: BookingSettings }) {
  const supabase = useMemo(() => createClient(), []);
  const now = useNow(30_000);
  const [bookings, setBookings] = useState(initial);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [editing, setEditing] = useState<BookingWithRoom | null>(null);
  const [cancelling, setCancelling] = useState<BookingWithRoom | null>(null);
  const prevStatus = useRef(new Map(initial.map((b) => [b.id, b.status])));

  const reload = useDebounced(async () => {
    const { data } = await supabase
      .from("bookings")
      .select(BOOKING_WITH_ROOM_AND_EVENTS)
      .eq("user_id", userId)
      .neq("status", "holding")
      .order("starts_at", { ascending: false })
      .limit(100);
    if (!data) return;
    const next = data as BookingWithRoom[];
    // toast when a staff member changes the status
    for (const b of next) {
      const before = prevStatus.current.get(b.id);
      if (before && before !== b.status) {
        const m = STATUS_META[b.status];
        toast(`${m.icon} ${b.doc_no}: ${m.label}`, { description: b.review_note ?? undefined });
      }
      prevStatus.current.set(b.id, b.status);
    }
    setBookings(next);
  }, 150);

  const live = useRealtime(`my-bookings-${userId}`, [{ table: "bookings", filter: `user_id=eq.${userId}` }], reload);

  const isActive = (b: BookingWithRoom) =>
    ["submitted", "in_review", "approved"].includes(b.status) && new Date(b.ends_at) > now;
  const active = bookings.filter(isActive).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = bookings.filter((b) => !isActive(b));
  const list = tab === "active" ? active : history;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">การจองของฉัน</h1>
          <p className="text-sm text-slate-500">ติดตามสถานะเอกสารได้ทันที ไม่ต้องรอ 5–7 วันอีกต่อไป</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={live} />
          <Link href="/book" className={buttonClass("default")}><Plus className="h-4 w-4" /> จองห้องใหม่</Link>
        </div>
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "active", label: "กำลังดำเนินการ", count: active.length },
          { value: "history", label: "ประวัติ", count: history.length },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-slate-500">
            {tab === "active" ? "ยังไม่มีการจองที่กำลังดำเนินการ" : "ยังไม่มีประวัติการจอง"}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              win={modifyWindow(b, settings, now)}
              onEdit={() => setEditing(b)}
              onCancel={() => setCancelling(b)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={`แก้ไขคำร้อง ${editing.doc_no}`}
          description="การแก้ไขจะส่งคำร้องกลับไปให้เจ้าหน้าที่ตรวจสอบใหม่ · หากต้องการเปลี่ยนห้องหรือเวลา ให้ยกเลิกแล้วจองใหม่"
          className="w-[min(760px,calc(100vw-2rem))]">
          <BookingForm
            room={editing.room}
            profile={profile}
            showRequester={false}
            submitLabel="บันทึกการแก้ไข"
            initial={{
              activity_name: editing.activity_name ?? "",
              activity_type: editing.activity_type ?? "",
              purpose: editing.purpose ?? "",
              attendees: editing.attendees ?? 1,
              organization: editing.organization ?? "",
              advisor_name: editing.advisor_name ?? "",
              contact_phone: editing.contact_phone ?? "",
              equipment: editing.equipment,
              extra_notes: editing.extra_notes ?? "",
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              const res = await updateBookingDetails(editing.id, values);
              if (!res.ok) {
                toast.error(res.message);
                return { ok: false, fields: "fields" in res ? res.fields : undefined };
              }
              toast.success("บันทึกการแก้ไขแล้ว");
              setEditing(null);
              reload();
              return { ok: true };
            }}
          />
        </Dialog>
      )}

      {cancelling && <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} onDone={reload} />}
    </div>
  );
}

function BookingCard({
  booking: b, win: w, onEdit, onCancel,
}: {
  booking: BookingWithRoom;
  win: ReturnType<typeof modifyWindow>;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const events = [...(b.events ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at));
  return (
    <li>
      <Card className={cn(b.status === "rejected" && "border-red-200", b.status === "approved" && "border-emerald-200")}>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{b.doc_no}</span>
                <StatusBadge status={b.status} />
              </div>
              <h3 className="mt-1 truncate text-base font-semibold text-slate-900">{b.activity_name}</h3>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" />{b.room.code} {b.room.name}</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-slate-400" />{fmtDate(b.starts_at, "medium")}</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-slate-400" />{fmtTimeRange(b.starts_at, b.ends_at)}</span>
                <span className="flex items-center gap-1"><Users className="h-4 w-4 text-slate-400" />{b.attendees} คน · {ACTIVITY_TYPES[b.activity_type ?? ""] ?? ""}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/bookings/${b.id}/pdf`} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
                <Download className="h-4 w-4" /> PDF
              </a>
              {w.live && (
                <>
                  <Button size="sm" variant="outline" onClick={onEdit} disabled={!w.canEdit} title={w.canEdit ? undefined : "เลยกำหนดเวลาแก้ไข"}>
                    <Pencil className="h-4 w-4" /> แก้ไข
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCancel} disabled={!w.canCancel} className="text-red-700" title={w.canCancel ? undefined : "เลยกำหนดเวลายกเลิก"}>
                    <XCircle className="h-4 w-4" /> ยกเลิก
                  </Button>
                </>
              )}
            </div>
          </div>

          <StatusTracker booking={b} className="max-w-xl" />

          {b.status === "rejected" && b.review_note && (
            <p className="rounded-lg border-l-4 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-800">
              <b>เหตุผลที่ไม่อนุมัติ:</b> {b.review_note}
            </p>
          )}
          {b.status === "approved" && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {b.opened_at ? `🔓 เจ้าหน้าที่เปิดห้องแล้วเมื่อ ${fmtDateTime(b.opened_at)}` : "เจ้าหน้าที่จะเปิดห้องให้ก่อนเวลาเริ่มใช้งาน"}
              {b.review_note && <span className="block text-emerald-700">หมายเหตุ: {b.review_note}</span>}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            {w.live && (
              <span>
                {w.canEdit
                  ? `แก้ไขได้ถึง ${fmtDateTime(w.deadline)}${b.status === "approved" ? " · ยกเลิกได้ถึงเวลาเดียวกัน" : " · ยกเลิกได้จนถึงเวลาเริ่มใช้ห้อง"}`
                  : w.canCancel
                    ? "เลยกำหนดแก้ไขแล้ว · ยังยกเลิกได้จนถึงเวลาเริ่มใช้ห้อง"
                    : "เลยกำหนดแก้ไข/ยกเลิกแล้ว กรุณาติดต่อเจ้าหน้าที่"}
              </span>
            )}
            <button className="ml-auto flex items-center gap-1 hover:text-slate-800" onClick={() => setShowHistory((s) => !s)}>
              <History className="h-3.5 w-3.5" /> ประวัติสถานะ ({events.length})
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-90")} />
            </button>
          </div>
          {showHistory && (
            <ol className="space-y-1.5 border-l-2 border-slate-200 pl-4 text-sm">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-2 -left-[21px] h-2 w-2 rounded-full bg-maroon-700" />
                  <span className="text-slate-500">{fmtDateTime(e.created_at)}</span> · {EVENT_LABELS[e.action] ?? e.action}
                  {e.note && <span className="text-slate-500"> — {e.note}</span>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function CancelDialog({ booking, onClose, onDone }: { booking: BookingWithRoom; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onClose={onClose}
      title="ยืนยันการยกเลิกการจอง"
      description={`${booking.doc_no} · ${booking.room.code} · ${fmtDate(booking.starts_at, "medium")} ${fmtTimeRange(booking.starts_at, booking.ends_at)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>ไม่ยกเลิก</Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await cancelBooking(booking.id, reason);
              setBusy(false);
              if (!res.ok) return toast.error(res.message);
              toast.success("ยกเลิกการจองแล้ว ห้องถูกปล่อยให้ผู้อื่นจองได้");
              onClose();
              onDone();
            }}
          >
            ยืนยันยกเลิก
          </Button>
        </>
      }
    >
      <Field label="เหตุผล (ไม่บังคับ)" htmlFor="cancel_reason">
        <Textarea id="cancel_reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" />
      </Field>
    </Dialog>
  );
}
