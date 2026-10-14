"use client";
// Room management (ข้อ 2.4): add / edit / maintenance toggle + temporary closures (block dates)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { createBlock, deleteBlock, deleteRoom, saveRoom } from "@/app/actions/admin";
import { FACILITIES } from "@/lib/constants";
import { computeRoomStates } from "@/lib/room-state";
import { dateKey, fmtDate, fmtTimeRange, toInstant } from "@/lib/time";
import type { Floor, Room, RoomBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { FloorPlan } from "@/components/floor-plan/floor-plan";

type Draft = Omit<Room, "id"> & { id?: string };

export function RoomManager({
  floors, initialRooms, initialBlocks, canEditRooms,
}: { floors: Floor[]; initialRooms: Room[]; initialBlocks: RoomBlock[]; canEditRooms: boolean }) {
  const router = useRouter();
  const [floorNo, setFloorNo] = useState(floors[0]?.floor ?? 1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const rooms = initialRooms;
  const blocks = initialBlocks;
  const floorRooms = rooms.filter((r) => r.floor === floorNo);
  const floor = floors.find((f) => f.floor === floorNo);

  const refresh = () => router.refresh();

  async function toggleMaintenance(room: Room) {
    // closing a room needs a reason → open the editor pre-set to maintenance
    if (room.status === "active") return setDraft({ ...room, status: "maintenance" });
    const res = await saveRoom({ ...room, status: "active", status_note: null });
    if (!res.ok) return toast.error(res.message);
    toast.success(`เปิดใช้งาน ${room.code} แล้ว`);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการห้อง</h1>
          <p className="text-sm text-slate-500">ข้อมูลห้องและตำแหน่งบนแผนผังเก็บในฐานข้อมูล แก้ไขได้โดยไม่ต้องแก้โค้ด</p>
        </div>
        {canEditRooms && (
          <Button onClick={() => setDraft({
            code: "", name: "", floor: floorNo, capacity: 30, facilities: ["projector", "aircon"], status: "active",
            status_note: null, map_x: 120, map_y: 40, map_w: 200, map_h: 200,
          })}>
            <Plus className="h-4 w-4" /> เพิ่มห้อง
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Tabs value={String(floorNo)} onChange={(v) => setFloorNo(Number(v))}
            items={floors.map((f) => ({ value: String(f.floor), label: f.label, count: rooms.filter((r) => r.floor === f.floor).length }))} />
        </CardHeader>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
          {floor && (
            <FloorPlan floor={floor} rooms={floorRooms} now={new Date()}
              states={computeRoomStates(floorRooms, [], [], null, new Date())}
              onSelect={(r) => canEditRooms && setDraft(r)} />
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">ห้อง</th>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">ความจุ</th>
                  <th className="py-2 pr-3 font-medium">อุปกรณ์</th>
                  <th className="py-2 pr-3 font-medium">สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {floorRooms.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3"><b>{r.code}</b><span className="block text-xs text-slate-500">{r.name}</span></td>
                    <td className="py-2 pr-3 tabular-nums">{r.capacity}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{r.facilities.map((f) => FACILITIES[f] ?? f).join(", ")}</td>
                    <td className="py-2 pr-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", r.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
                        {r.status === "active" ? "เปิดใช้งาน" : "ปิดปรับปรุง"}
                      </span>
                      {r.status_note && <span className="block text-xs text-slate-500">{r.status_note}</span>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {canEditRooms && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => toggleMaintenance(r)} title="สลับสถานะปิดปรับปรุง"><Wrench className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDraft(r)} title="แก้ไข"><Pencil className="h-4 w-4" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!canEditRooms && <p className="mt-3 text-xs text-slate-500">แก้ไขข้อมูลห้องได้เฉพาะผู้ดูแลระบบ (Super Admin)</p>}
          </div>
        </CardContent>
      </Card>

      <BlockManager rooms={rooms} blocks={blocks} onChanged={refresh} />

      {draft && floor && (
        <RoomDialog
          draft={draft}
          floors={floors}
          rooms={rooms}
          onClose={() => setDraft(null)}
          onSaved={() => { setDraft(null); refresh(); }}
        />
      )}
    </div>
  );
}

function RoomDialog({
  draft: initial, floors, rooms, onClose, onSaved,
}: { draft: Draft; floors: Floor[]; rooms: Room[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const floor = floors.find((f) => f.floor === Number(d.floor)) ?? floors[0];
  const others = rooms.filter((r) => r.floor === Number(d.floor) && r.id !== d.id);

  async function save() {
    setBusy(true);
    const res = await saveRoom(d);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("บันทึกข้อมูลห้องแล้ว");
    onSaved();
  }
  async function remove() {
    if (!d.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    const res = await deleteRoom(d.id);
    if (!res.ok) return toast.error(res.message);
    toast.success("ลบห้องแล้ว");
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title={d.id ? `แก้ไขห้อง ${initial.code}` : "เพิ่มห้องใหม่"} className="w-[min(920px,calc(100vw-2rem))]"
      footer={
        <>
          {d.id && (
            <Button variant={confirmDelete ? "destructive" : "ghost"} className={cn("mr-auto", !confirmDelete && "text-red-700")} onClick={remove}>
              <Trash2 className="h-4 w-4" /> {confirmDelete ? "ยืนยันลบ (เฉพาะห้องที่ไม่เคยมีการจอง)" : "ลบห้อง"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} loading={busy}>บันทึก</Button>
        </>
      }>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="รหัสห้อง" required><Input value={d.code} onChange={(e) => set("code", e.target.value)} placeholder="3-201" /></Field>
          <Field label="ชั้น" required>
            <Select value={d.floor} onChange={(e) => set("floor", Number(e.target.value))}>
              {floors.map((f) => <option key={f.floor} value={f.floor}>{f.label}</option>)}
            </Select>
          </Field>
          <Field label="ชื่อห้อง" required className="col-span-2"><Input value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="ความจุ (คน)" required><Input type="number" min={1} value={d.capacity} onChange={(e) => set("capacity", Number(e.target.value))} /></Field>
          <Field label="สถานะ">
            <Select value={d.status} onChange={(e) => set("status", e.target.value as Room["status"])}>
              <option value="active">เปิดใช้งาน</option>
              <option value="maintenance">ปิดปรับปรุง</option>
            </Select>
          </Field>
          {d.status === "maintenance" && (
            <Field label="สาเหตุที่ปิดปรับปรุง" className="col-span-2" hint="แสดงให้นิสิตเห็นบนแผนผัง">
              <Input autoFocus value={d.status_note ?? ""} onChange={(e) => set("status_note", e.target.value)} placeholder="เช่น ซ่อมเครื่องปรับอากาศ" />
            </Field>
          )}
          <fieldset className="col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">สิ่งอำนวยความสะดวก</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(FACILITIES).map(([k, label]) => (
                <Checkbox key={k} label={label} checked={d.facilities.includes(k)}
                  onChange={(e) => set("facilities", e.target.checked ? [...d.facilities, k] : d.facilities.filter((x) => x !== k))} />
              ))}
            </div>
          </fieldset>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">ตำแหน่งบนแผนผัง (หน่วย: พิกัด SVG 1000 × 560)</p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {(["map_x", "map_y", "map_w", "map_h"] as const).map((k) => (
              <Field key={k} label={{ map_x: "X", map_y: "Y", map_w: "กว้าง", map_h: "สูง" }[k]}>
                <Input type="number" step={5} value={d[k]} onChange={(e) => set(k, Number(e.target.value))} />
              </Field>
            ))}
          </div>
          {floor && (
            <div className="rounded-lg border border-slate-200 p-2">
              <FloorPlan floor={floor} rooms={others} now={new Date()}
                states={computeRoomStates(others, [], [], null, new Date())} previewRoom={d} />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">กรอบเส้นประสีเลือดหมูคือตำแหน่งของห้องนี้</p>
        </div>
      </div>
    </Dialog>
  );
}

function BlockManager({ rooms, blocks, onChanged }: { rooms: Room[]; blocks: RoomBlock[]; onChanged: () => void }) {
  const today = dateKey(new Date());
  const [f, setF] = useState({ room_id: "", date: today, start: "08:00", end_date: today, end: "20:00", reason: "" });
  const [busy, setBusy] = useState(false);
  const roomLabel = (id: string | null) => (id ? rooms.find((r) => r.id === id)?.code ?? "?" : "ทั้งอาคาร");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createBlock({
      room_id: f.room_id || null,
      starts_at: toInstant(f.date, f.start).toISOString(),
      ends_at: toInstant(f.end_date, f.end).toISOString(),
      reason: f.reason,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("ปิดการจองแล้ว — แผนผังของนิสิตอัปเดตทันที");
    setF((p) => ({ ...p, reason: "" }));
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarX className="h-5 w-5 text-maroon-700" /> ปิดการจองชั่วคราว (Block dates)</CardTitle>
        <p className="text-sm text-slate-500">เช่น ช่วงสอบ ห้องเสีย หรือกิจกรรมของคณะ · ไม่กระทบการจองที่อนุมัติไปแล้ว (เพิกถอนได้ที่หน้าคำร้อง)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:items-end">
          <Field label="ห้อง" className="lg:col-span-1">
            <Select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}>
              <option value="">ทั้งอาคาร</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </Select>
          </Field>
          <Field label="ตั้งแต่วันที่"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, end_date: e.target.value > f.end_date ? e.target.value : f.end_date })} /></Field>
          <Field label="เวลา"><Input type="time" step={1800} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="ถึงวันที่"><Input type="date" value={f.end_date} min={f.date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
          <Field label="เวลา"><Input type="time" step={1800} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="เหตุผล" required><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="สอบปลายภาค" /></Field>
          <Button type="submit" loading={busy}><Plus className="h-4 w-4" /> เพิ่ม</Button>
        </form>

        {blocks.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีการปิดการจองที่กำลังจะมาถึง</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-20 font-semibold">{roomLabel(b.room_id)}</span>
                <span className="flex-1 text-slate-600">
                  {dateKey(b.starts_at) === dateKey(b.ends_at)
                    ? `${fmtDate(b.starts_at, "medium")} ${fmtTimeRange(b.starts_at, b.ends_at)}`
                    : `${fmtDate(b.starts_at, "short")} – ${fmtDate(b.ends_at, "short")}`}
                  <span className="ml-2 text-slate-800">· {b.reason}</span>
                </span>
                <Button size="icon" variant="ghost" title="ยกเลิกการปิด"
                  onClick={async () => {
                    const res = await deleteBlock(b.id);
                    if (!res.ok) return toast.error(res.message);
                    toast.success("ยกเลิกการปิดการจองแล้ว");
                    onChanged();
                  }}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
