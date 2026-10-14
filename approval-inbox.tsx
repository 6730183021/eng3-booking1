"use client";
// Approver dashboard: FIFO queue + instant document preview + one-click approve / reject
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarDays, CheckCircle2, Clock, Eye, FileText, Inbox, MapPin, Phone, Search, Users, XCircle } from "lucide-react";
import { reviewBooking } from "@/app/actions/admin";
import { useNow } from "@/hooks/use-now";
import { useDebounced, useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_TYPES, EQUIPMENT, EVENT_LABELS, REJECT_REASONS } from "@/lib/constants";
import { fetchInbox } from "@/lib/inbox";
import { fmtDate, fmtDateTime, fmtRelative, fmtTimeRange } from "@/lib/time";
import type { BookingStatus, BookingWithRoom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status/status-badge";
import { LiveBadge } from "@/components/booking/booking-workspace";

type Filter = "queue" | "approved" | "rejected" | "all";
const QUEUE: BookingStatus[] = ["submitted", "in_review"];

export function ApprovalInbox({ initial }: { initial: BookingWithRoom[] }) {
  const supabase = useMemo(() => createClient(), []);
  const now = useNow(60_000);
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("queue");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initial.find((b) => QUEUE.includes(b.status))?.id ?? null);
  const known = useRef(new Set(initial.map((b) => b.id)));

  const reload = useDebounced(async () => {
    const next = await fetchInbox(supabase);
    const fresh = next.filter((b) => !known.current.has(b.id) && b.status === "submitted");
    if (fresh.length) toast.info(`📥 มีคำร้องใหม่ ${fresh.length} รายการ`, { description: fresh.map((b) => b.doc_no).join(", ") });
    next.forEach((b) => known.current.add(b.id));
    setItems(next);
  }, 200);
  const live = useRealtime("approvals", [{ table: "bookings" }], reload);

  const counts = {
    queue: items.filter((b) => QUEUE.includes(b.status)).length,
    approved: items.filter((b) => b.status === "approved").length, // within the recent window
    rejected: items.filter((b) => b.status === "rejected").length,
    all: items.length,
  };
  const list = items
    .filter((b) =>
      filter === "queue" ? QUEUE.includes(b.status) : filter === "all" ? true : b.status === filter,
    )
    .filter((b) => {
      if (!q.trim()) return true;
      const hay = `${b.doc_no} ${b.activity_name} ${b.room.code} ${b.requester?.full_name} ${b.requester?.student_id}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  // FIFO for the queue; newest decision first everywhere else
  const ts = (b: BookingWithRoom) => b.reviewed_at ?? b.cancelled_at ?? b.updated_at ?? b.submitted_at ?? "";
  list.sort((a, b) =>
    filter === "queue" ? (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") : ts(b).localeCompare(ts(a)),
  );
  const selected = items.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">คำร้องขอใช้ห้อง</h1>
          <p className="text-sm text-slate-500">เรียงตามเวลาที่ส่ง (มาก่อน–ได้ก่อน) · คลิกรายการเพื่อดูเอกสารและอนุมัติ</p>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onChange={setFilter} items={[
          { value: "queue", label: "รอดำเนินการ", count: counts.queue },
          { value: "approved", label: "อนุมัติแล้ว", count: counts.approved },
          { value: "rejected", label: "ไม่อนุมัติ", count: counts.rejected },
          { value: "all", label: "ทั้งหมด", count: counts.all },
        ]} />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่/ชื่อ/ห้อง" className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="max-h-[calc(100vh-240px)] overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-slate-500">
              <Inbox className="mb-2 h-10 w-10 text-slate-300" />
              {filter === "queue" ? "ไม่มีคำร้องค้าง 🎉" : "ไม่มีรายการ"}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((b, i) => {
                const urgent = QUEUE.includes(b.status) && new Date(b.starts_at).getTime() - now.getTime() < 48 * 3600_000;
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => setSelectedId(b.id)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                        b.id === selectedId && "bg-maroon-50/70 hover:bg-maroon-50",
                      )}
                    >
                      {filter === "queue" && (
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {i + 1}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-500">{b.doc_no}</span>
                          <StatusBadge status={b.status} />
                        </span>
                        <span className="mt-0.5 block truncate font-medium text-slate-900">{b.activity_name}</span>
                        <span className="block text-xs text-slate-600">
                          {b.room.code} · {fmtDate(b.starts_at, "short")} {fmtTimeRange(b.starts_at, b.ends_at)}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-slate-400">
                          {b.requester?.full_name} · ส่ง{b.submitted_at ? fmtRelative(b.submitted_at, now) : "-"}
                        </span>
                        {urgent && (
                          <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-red-700">
                            ใช้ห้องภายใน 48 ชม.
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected ? (
          <ReviewPanel key={selected.id} booking={selected} onChanged={reload} />
        ) : (
          <Card className="flex items-center justify-center py-24 text-slate-400">เลือกคำร้องจากรายการ</Card>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ booking: b, onChanged }: { booking: BookingWithRoom; onChanged: () => void }) {
  const [view, setView] = useState<"detail" | "pdf">("detail");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const r = b.requester;

  async function act(action: "start_review" | "approve" | "reject" | "revoke") {
    if ((action === "reject" || action === "revoke") && !note.trim()) {
      toast.error("กรุณาระบุเหตุผล");
      return;
    }
    setBusy(action);
    const res = await reviewBooking(b.id, action, note);
    setBusy(null);
    if (!res.ok) return toast.error(res.message);
    toast.success(
      { start_review: "รับเรื่องแล้ว", approve: "อนุมัติแล้ว · แจ้งนิสิตทางอีเมล", reject: "ปฏิเสธแล้ว · แจ้งนิสิตทางอีเมล", revoke: "เพิกถอนแล้ว" }[action],
    );
    setNote("");
    onChanged();
  }

  const events = [...(b.events ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const pending = b.status === "submitted" || b.status === "in_review";

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="font-mono text-sm text-slate-500">{b.doc_no}</p>
          <h2 className="text-lg font-semibold text-slate-900">{b.activity_name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.status} />
          <Tabs value={view} onChange={setView} items={[
            { value: "detail", label: <><Eye className="h-4 w-4" /> รายละเอียด</> },
            { value: "pdf", label: <><FileText className="h-4 w-4" /> เอกสาร</> },
          ]} />
        </div>
      </div>

      {view === "pdf" ? (
        <iframe title={`เอกสาร ${b.doc_no}`} src={`/api/bookings/${b.id}/pdf`} className="h-[640px] w-full" />
      ) : (
        <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
          <section className="space-y-1.5 text-sm">
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-maroon-800 uppercase">การใช้ห้อง</h3>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><b>{b.room.code}</b> {b.room.name} (ชั้น {b.room.floor})</p>
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{fmtDate(b.starts_at)}</p>
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />{fmtTimeRange(b.starts_at, b.ends_at)}</p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />{b.attendees} คน
              <span className={cn("text-xs", (b.attendees ?? 0) > b.room.capacity ? "text-red-600" : "text-slate-400")}>(ความจุ {b.room.capacity})</span>
            </p>
          </section>
          <section className="space-y-1.5 text-sm">
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-maroon-800 uppercase">ผู้ยื่นคำร้อง</h3>
            <p><b>{r?.full_name}</b> · {r?.student_id}</p>
            <p className="text-slate-600">{r?.department} · ปี {r?.year_of_study}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><a className="text-maroon-700 hover:underline" href={`tel:${b.contact_phone}`}>{b.contact_phone}</a></p>
            <p className="text-slate-600">{r?.email}</p>
          </section>
          <section className="space-y-2 text-sm lg:col-span-2">
            <h3 className="text-xs font-semibold tracking-wide text-maroon-800 uppercase">รายละเอียดกิจกรรม</h3>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Item k="ประเภท" v={ACTIVITY_TYPES[b.activity_type ?? ""]} />
              <Item k="หน่วยงาน/ชมรม" v={b.organization} />
              <Item k="อาจารย์ที่ปรึกษา" v={b.advisor_name} />
              <Item k="อุปกรณ์ที่ขอ" v={b.equipment.map((e) => EQUIPMENT[e] ?? e).join(", ")} />
              <Item k="วัตถุประสงค์" v={b.purpose} wide />
              <Item k="หมายเหตุ" v={b.extra_notes} wide />
            </dl>
          </section>
          <section className="text-sm lg:col-span-2">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-maroon-800 uppercase">ประวัติ</h3>
            <ol className="space-y-1 text-slate-600">
              {events.map((e) => (
                <li key={e.id}>{fmtDateTime(e.created_at)} · {EVENT_LABELS[e.action] ?? e.action}{e.note ? ` — ${e.note}` : ""}</li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {(pending || b.status === "approved") && (
        <div className="mt-auto space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={pending ? "หมายเหตุถึงนิสิต (จำเป็นเมื่อไม่อนุมัติ)" : "เหตุผลในการเพิกถอน"}
            className="min-h-16 bg-white"
          />
          {pending && (
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((t) => (
                <button key={t} onClick={() => setNote(t)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-maroon-300">
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {b.status === "submitted" && (
              <Button variant="outline" onClick={() => act("start_review")} loading={busy === "start_review"}>รับเรื่อง / เริ่มตรวจสอบ</Button>
            )}
            {pending && (
              <>
                <Button variant="destructive" onClick={() => act("reject")} loading={busy === "reject"}><XCircle className="h-4 w-4" /> ไม่อนุมัติ</Button>
                <Button variant="success" onClick={() => act("approve")} loading={busy === "approve"}><CheckCircle2 className="h-4 w-4" /> อนุมัติ</Button>
              </>
            )}
            {b.status === "approved" && (
              <Button variant="outline" className="text-red-700" onClick={() => act("revoke")} loading={busy === "revoke"}><Ban className="h-4 w-4" /> เพิกถอนการอนุมัติ</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Item({ k, v, wide }: { k: string; v?: string | null; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="whitespace-pre-line text-slate-800">{v || "-"}</dd>
    </div>
  );
}
