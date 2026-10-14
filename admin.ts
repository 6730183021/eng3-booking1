"use server";
// Staff-side mutations. Authorization is enforced by Postgres (RLS + role checks in RPCs).
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toActionError } from "@/lib/errors";
import { notifyStatusChanged } from "@/lib/notify";
import { BOOKING_WITH_ROOM } from "@/lib/queries";
import { FACILITIES } from "@/lib/constants";
import type { ActionResult, BookingWithRoom, Room } from "@/lib/types";

type ReviewAction = "start_review" | "approve" | "reject" | "revoke";

/** Approver workflow: start_review | approve | reject | revoke */
export async function reviewBooking(
  bookingId: string,
  action: ReviewAction,
  note?: string,
): Promise<ActionResult<BookingWithRoom>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_booking", {
    p_booking_id: bookingId,
    p_action: action,
    p_note: note ?? null,
  });
  if (error) return toActionError(error);

  const { data } = await supabase.from("bookings").select(BOOKING_WITH_ROOM).eq("id", bookingId).single();
  const booking = data as BookingWithRoom;
  after(() => notifyStatusChanged(booking, booking.status));
  return { ok: true, data: booking };
}

/** Staff confirms the room was opened / closed */
export async function markRoomTask(bookingId: string, action: "open" | "close"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_room_task", { p_booking_id: bookingId, p_action: action });
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------- rooms (super_admin)
const roomSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1, "กรุณาระบุรหัสห้อง").max(20),
  name: z.string().trim().min(1, "กรุณาระบุชื่อห้อง").max(100),
  floor: z.coerce.number().int().min(1).max(20),
  capacity: z.coerce.number().int().min(1, "ความจุต้องมากกว่า 0"),
  facilities: z.array(z.enum(Object.keys(FACILITIES) as [string, ...string[]])),
  status: z.enum(["active", "maintenance"]),
  status_note: z.string().trim().max(200).nullable().optional(),
  map_x: z.coerce.number().int().min(0).max(1000),
  map_y: z.coerce.number().int().min(0).max(560),
  map_w: z.coerce.number().int().min(20).max(1000),
  map_h: z.coerce.number().int().min(20).max(560),
});

export async function saveRoom(input: unknown): Promise<ActionResult<Room>> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const query = id
    ? supabase.from("rooms").update(values).eq("id", id).select().single()
    : supabase.from("rooms").insert(values).select().single();
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") return { ok: false, code: "DUPLICATE", message: "รหัสห้องนี้มีอยู่แล้ว" };
    if (error.code === "23503") return { ok: false, code: "NO_FLOOR", message: "ยังไม่มีชั้นนี้ในระบบ" };
    return toActionError(error);
  }
  return { ok: true, data: data as Room };
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("rooms").delete({ count: "exact" }).eq("id", id);
  if (error) return toActionError(error);
  if (!count) return { ok: false, code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ลบห้องนี้" };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------- blocks (approver+)
const blockSchema = z
  .object({
    room_id: z.string().uuid().nullable(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(2, "กรุณาระบุเหตุผล").max(200),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" });

export async function createBlock(input: unknown): Promise<ActionResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("room_blocks").insert({ ...parsed.data, created_by: auth.user?.id });
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("room_blocks").delete().eq("id", id);
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------- settings (super_admin)
const settingsSchema = z
  .object({
    min_lead_hours: z.coerce.number().int().min(0).max(24 * 14),
    max_duration_minutes: z.coerce.number().int().min(15).max(24 * 60),
    slot_minutes: z.coerce.number().pipe(z.union([z.literal(15), z.literal(30), z.literal(60)])),
    open_time: z.string().regex(/^\d{2}:\d{2}$/),
    close_time: z.string().regex(/^\d{2}:\d{2}$/),
    open_days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "ต้องเปิดอย่างน้อย 1 วัน"),
    hold_minutes: z.coerce.number().int().min(1).max(30),
    cancel_before_hours: z.coerce.number().int().min(0).max(24 * 14),
    max_advance_days: z.coerce.number().int().min(1).max(365),
    max_active_bookings: z.coerce.number().int().min(1).max(50),
  })
  .refine((v) => v.open_time < v.close_time, { message: "เวลาเปิดต้องก่อนเวลาปิด" });

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("booking_settings")
    .update(parsed.data, { count: "exact" })
    .eq("id", true);
  if (error) return toActionError(error);
  if (!count) return { ok: false, code: "FORBIDDEN", message: "เฉพาะผู้ดูแลระบบเท่านั้น" };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------- staff allow-list (super_admin)
export async function addStaffMember(email: string, role: string): Promise<ActionResult> {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
      role: z.enum(["staff", "approver", "super_admin"]),
    })
    .safeParse({ email, role });
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").upsert(parsed.data);
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}

export async function removeStaffMember(email: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.email?.toLowerCase() === email.toLowerCase()) {
    return { ok: false, code: "SELF", message: "ไม่สามารถลบสิทธิ์ของตัวเองได้" };
  }
  const { error } = await supabase.from("staff_members").delete().eq("email", email);
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}
