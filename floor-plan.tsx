"use client";
// Interactive 2-D floor plan (SVG, top-down). Rooms & non-bookable features are
// data from the `floors` / `rooms` tables, so layouts change without code changes.
import { useRef, useState } from "react";
import { Users } from "lucide-react";
import type { Floor, FloorFeature, Room } from "@/lib/types";
import { STATE_STYLE, type RoomStateInfo } from "@/lib/room-state";
import { fmtCountdown, fmtTimeRange } from "@/lib/time";
import { cn } from "@/lib/utils";
import { FacilityChips } from "./facility-icon";

export const PLAN_W = 1000;
export const PLAN_H = 560;

interface FloorPlanProps {
  floor: Floor;
  rooms: Room[];
  states: Record<string, RoomStateInfo>;
  now: Date;
  selectedRoomId?: string | null;
  onSelect?: (room: Room) => void;
  /** admin preview: draw this room (draft coordinates) highlighted */
  previewRoom?: Pick<Room, "code" | "map_x" | "map_y" | "map_w" | "map_h"> | null;
  className?: string;
}

export function FloorPlan({ floor, rooms, states, now, selectedRoomId, onSelect, previewRoom, className }: FloorPlanProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ room: Room; x: number; y: number; maxW: number } | null>(null);

  const track = (room: Room, e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setHover({ room, x: e.clientX - r.left, y: e.clientY - r.top, maxW: r.width });
  };

  return (
    <div ref={wrapRef} className={cn("relative w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
        className="h-auto w-full"
        role="group"
        aria-label={`แผนผัง ${floor.label} อาคาร 3`}
      >
        <defs>
          <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#cbd5e1" strokeWidth="3" />
          </pattern>
          <pattern id="stairs" width="12" height="12" patternUnits="userSpaceOnUse">
            <line x1="0" y1="6" x2="12" y2="6" stroke="#cbd5e1" strokeWidth="2" />
          </pattern>
        </defs>

        {/* building shell */}
        <rect x={20} y={30} width={960} height={500} rx={8} fill="#ffffff" stroke="#94a3b8" strokeWidth={2.5} />

        {floor.features.map((f, i) => (
          <Feature key={i} f={f} />
        ))}

        {rooms.map((room) => {
          const info = states[room.id] ?? { state: "available" as const };
          const st = STATE_STYLE[info.state];
          const selected = room.id === selectedRoomId;
          const greyed = info.state === "maintenance" || info.state === "blocked";
          const { map_x: x, map_y: y, map_w: w, map_h: h } = room;
          const pillW = st.label.length * 7.2 + 26;
          return (
            <g
              key={room.id}
              className={cn("room-shape", info.state === "held" && "room-held")}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-disabled={greyed}
              aria-label={`ห้อง ${room.code} ${room.name} ความจุ ${room.capacity} คน สถานะ ${st.label}`}
              onClick={() => onSelect?.(room)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(room);
                }
              }}
              onMouseMove={(e) => track(room, e)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
            >
              <rect
                className="room-body"
                x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={6}
                fill={st.fill}
                stroke={selected ? "#800000" : st.stroke}
                strokeWidth={selected ? 5 : 2}
              />
              {greyed && <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={6} fill="url(#hatch)" opacity={0.6} />}
              <text x={x + 14} y={y + 32} fontSize={w < 120 ? 17 : 21} fontWeight={700} fill={st.text}>
                {room.code}
              </text>
              {w >= 200 && (
                <text x={x + 14} y={y + 54} fontSize={13} fill="#475569">
                  {room.name.length > Math.floor(w / 8.5) ? `${room.name.slice(0, Math.floor(w / 8.5) - 1)}…` : room.name}
                </text>
              )}
              <text x={x + 14} y={y + (w >= 200 ? 76 : 54)} fontSize={13} fill="#64748b">
                {room.capacity} ที่นั่ง
              </text>
              {/* status pill */}
              <g transform={`translate(${x + 12}, ${y + h - 38})`}>
                <rect width={Math.min(pillW, w - 24)} height={24} rx={12} fill="#ffffff" stroke={st.stroke} strokeWidth={1.5} />
                <circle cx={12} cy={12} r={4.5} fill={st.stroke} />
                <text x={21} y={16.5} fontSize={12.5} fontWeight={600} fill={st.text}>
                  {w < 120 && st.label.length > 6 ? st.label.slice(0, 5) + "…" : st.label}
                </text>
              </g>
              {selected && w >= 140 && (
                <g transform={`translate(${x + w - 26}, ${y + 24})`}>
                  <circle r={13} fill="#800000" />
                  <path d="M-5 0 L-1.5 4 L5.5 -4" stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}

        {previewRoom && (
          <g pointerEvents="none">
            <rect
              x={previewRoom.map_x + 3} y={previewRoom.map_y + 3}
              width={Math.max(previewRoom.map_w - 6, 4)} height={Math.max(previewRoom.map_h - 6, 4)} rx={6}
              fill="#800000" fillOpacity={0.12} stroke="#800000" strokeWidth={4} strokeDasharray="10 6"
            />
            <text x={previewRoom.map_x + 14} y={previewRoom.map_y + 32} fontSize={20} fontWeight={700} fill="#800000">
              {previewRoom.code || "ห้องใหม่"}
            </text>
          </g>
        )}
      </svg>

      {hover && <RoomTooltip room={hover.room} info={states[hover.room.id]} now={now} x={hover.x} y={hover.y} containerWidth={hover.maxW} />}
    </div>
  );
}

function Feature({ f }: { f: FloorFeature }) {
  const style: Record<FloorFeature["type"], { fill: string; stroke?: string; dash?: string; text: string }> = {
    corridor: { fill: "#f8fafc", text: "#94a3b8" },
    stairs: { fill: "url(#stairs)", stroke: "#cbd5e1", text: "#64748b" },
    lift: { fill: "#e2e8f0", stroke: "#cbd5e1", text: "#475569" },
    restroom: { fill: "#f0f9ff", stroke: "#bae6fd", text: "#0369a1" },
    lobby: { fill: "#fafaf9", stroke: "#d6d3d1", dash: "6 5", text: "#78716c" },
    office: { fill: "url(#hatch)", stroke: "#cbd5e1", text: "#64748b" },
  };
  const s = style[f.type];
  return (
    <g aria-hidden>
      <rect x={f.x + (f.type === "corridor" ? 0 : 3)} y={f.y + (f.type === "corridor" ? 0 : 3)}
        width={f.w - (f.type === "corridor" ? 0 : 6)} height={f.h - (f.type === "corridor" ? 0 : 6)}
        rx={f.type === "corridor" ? 0 : 5} fill={s.fill} stroke={s.stroke} strokeDasharray={s.dash} />
      {f.label && (
        <text
          x={f.x + f.w / 2} y={f.y + f.h / 2 + 5} textAnchor="middle"
          fontSize={f.type === "corridor" ? 13 : 12} fill={s.text}
          style={{ paintOrder: "stroke" }} stroke="#ffffff" strokeWidth={4}
        >
          {f.label}
        </text>
      )}
    </g>
  );
}

function RoomTooltip({
  room, info, now, x, y, containerWidth,
}: { room: Room; info?: RoomStateInfo; now: Date; x: number; y: number; containerWidth: number }) {
  const st = STATE_STYLE[info?.state ?? "available"];
  const width = 280;
  const maxX = containerWidth - width - 8;
  const left = Math.max(8, Math.min(x + 16, maxX));
  const top = y + 16;

  let detail: string | null = null;
  if (info?.state === "held" && info.slot?.hold_expires_at)
    detail = `มีผู้ใช้อื่นกำลังกรอกแบบฟอร์ม · ปลดล็อกอัตโนมัติใน ${fmtCountdown(new Date(info.slot.hold_expires_at).getTime() - now.getTime())} หากไม่ยืนยัน`;
  else if (info?.state === "mine") detail = "คุณล็อกห้องนี้ไว้ กรุณากรอกแบบฟอร์มให้เสร็จ";
  else if (info?.state === "booked" && info.slot)
    detail = `${info.slot.state === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"} · ${fmtTimeRange(info.slot.starts_at, info.slot.ends_at)}`;
  else if (info?.state === "blocked") detail = `ปิดการจอง: ${info.block?.reason ?? ""}`;
  else if (info?.state === "maintenance") detail = room.status_note ?? "ปิดปรับปรุงชั่วคราว";

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-xl backdrop-blur"
      style={{ left, top, width }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">
          {room.code} · {room.name}
        </p>
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
        <Users className="h-3.5 w-3.5" /> ความจุ {room.capacity} คน · ชั้น {room.floor}
      </p>
      <FacilityChips facilities={room.facilities} className="mt-2" />
      <p className="mt-2 flex items-start gap-1.5 text-xs font-medium" style={{ color: st.text }}>
        <span className={cn("mt-1 inline-block h-2 w-2 shrink-0 rounded-full", st.dot)} />
        <span suppressHydrationWarning>{detail ?? st.label}</span>
      </p>
    </div>
  );
}

export function FloorLegend({ className }: { className?: string }) {
  const items = [
    { s: STATE_STYLE.available, label: "ว่าง – จองได้" },
    { s: STATE_STYLE.held, label: "มีคนกำลังทำรายการ (ล็อก)" },
    { s: STATE_STYLE.booked, label: "ไม่ว่าง / ถูกจองแล้ว" },
    { s: STATE_STYLE.maintenance, label: "ปิดปรับปรุง / ปิดการจอง" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded" style={{ background: it.s.fill, border: `2px solid ${it.s.stroke}` }} />
          {it.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded border-[3px] border-maroon-700" />
        ห้องที่เลือก
      </li>
    </ul>
  );
}
