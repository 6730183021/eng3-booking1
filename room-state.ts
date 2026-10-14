// Pure function: what colour is each room for the selected time range?
import type { Room, RoomBlock, RoomSlot } from "./types";
import { overlaps } from "./time";

export type RoomState = "available" | "held" | "mine" | "booked" | "maintenance" | "blocked";

export interface RoomStateInfo {
  state: RoomState;
  slot?: RoomSlot;
  block?: RoomBlock;
}

export const STATE_STYLE: Record<
  RoomState,
  { fill: string; stroke: string; text: string; label: string; dot: string }
> = {
  available:   { fill: "#ecfdf5", stroke: "#10b981", text: "#065f46", label: "ว่าง",             dot: "bg-emerald-500" },
  held:        { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e", label: "กำลังมีคนจอง",     dot: "bg-amber-400" },
  mine:        { fill: "#fef3c7", stroke: "#800000", text: "#800000", label: "คุณล็อกไว้",       dot: "bg-amber-400" },
  booked:      { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b", label: "ไม่ว่าง",          dot: "bg-red-500" },
  maintenance: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569", label: "ปิดปรับปรุง",      dot: "bg-slate-400" },
  blocked:     { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569", label: "ปิดการจอง",        dot: "bg-slate-400" },
};

/** Expired holds are treated as free immediately (pg_cron deletes them within a minute) */
export function isLiveSlot(slot: RoomSlot, now: Date) {
  return slot.state !== "held" || (slot.hold_expires_at !== null && new Date(slot.hold_expires_at) > now);
}

export function computeRoomStates(
  rooms: Room[],
  slots: RoomSlot[],
  blocks: RoomBlock[],
  range: { start: Date; end: Date } | null,
  now: Date,
  myHoldId?: string | null,
): Record<string, RoomStateInfo> {
  const result: Record<string, RoomStateInfo> = {};
  for (const room of rooms) {
    if (room.status === "maintenance") {
      result[room.id] = { state: "maintenance" };
      continue;
    }
    if (!range) {
      result[room.id] = { state: "available" };
      continue;
    }
    const block = blocks.find(
      (b) => (b.room_id === room.id || b.room_id === null) && overlaps(b.starts_at, b.ends_at, range.start, range.end),
    );
    if (block) {
      result[room.id] = { state: "blocked", block };
      continue;
    }
    const hits = slots.filter(
      (s) => s.room_id === room.id && isLiveSlot(s, now) && overlaps(s.starts_at, s.ends_at, range.start, range.end),
    );
    const booked = hits.find((s) => s.state !== "held");
    const mine = hits.find((s) => s.booking_id === myHoldId);
    const held = hits.find((s) => s.state === "held" && s.booking_id !== myHoldId);
    if (booked) result[room.id] = { state: "booked", slot: booked };
    else if (mine) result[room.id] = { state: "mine", slot: mine };
    else if (held) result[room.id] = { state: "held", slot: held };
    else result[room.id] = { state: "available" };
  }
  return result;
}
