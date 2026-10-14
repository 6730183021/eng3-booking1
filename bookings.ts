"use server";
// Student-side mutations. Each one calls a Postgres RPC as the signed-in user,
// so the database enforces locking, rules and ownership.
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toActionError } from "@/lib/errors";
import { bookingFormSchema, fieldErrors } from "@/lib/validation";
import { notifySubmitted, pushLine } from "@/lib/notify";
import { fmtDate, fmtTimeRange } from "@/lib/time";
import type { ActionResult, Booking, BookingWithRoom } from "@/lib/types";
import { BOOKING_WITH_ROOM } from "@/lib/queries";


type Supabase = Awaited<ReturnType<typeof createClient>>;
async function loadBooking(supabase: Supabase, id: string) {
  const { data } = await supabase.from("bookings").select(BOOKING_WITH_ROOM).eq("id", id).single();
  return data as BookingWithRoom | null;
}

/** ① Lock a room/time for `hold_minutes` (pessimistic lock) */
export async function holdSlot(roomId: string, startsAt: string, endsAt: string): Promise<ActionResult<Booking>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_slot", {
    p_room_id: roomId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (error) return toActionError(error);
  return { ok: true, data: data as Booking };
}

/** Give the lock back (student closed the form / picked another room) */
export async function releaseHold(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_hold", { p_booking_id: bookingId });
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}

/** ② Submit the form → status "submitted", document number assigned */
export async function submitBooking(
  bookingId: string,
  input: unknown,
): Promise<ActionResult<BookingWithRoom> & { fields?: Record<string, string> }> {
  const parsed = bookingFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "FORM_INCOMPLETE", message: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม", fields: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_booking", { p_booking_id: bookingId, p_form: parsed.data });
  if (error) return toActionError(error);

  const booking = await loadBooking(supabase, bookingId);
  if (!booking) return { ok: false, code: "BOOKING_NOT_FOUND", message: "ไม่พบรายการจอง" };
  after(() => notifySubmitted(booking));
  return { ok: true, data: booking };
}

/** Edit form details (≥ 24 h before) — goes back to "submitted" for re-review */
export async function updateBookingDetails(
  bookingId: string,
  input: unknown,
): Promise<ActionResult<BookingWithRoom> & { fields?: Record<string, string> }> {
  const parsed = bookingFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "FORM_INCOMPLETE", message: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม", fields: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_booking_details", { p_booking_id: bookingId, p_form: parsed.data });
  if (error) return toActionError(error);
  const booking = await loadBooking(supabase, bookingId);
  if (!booking) return { ok: false, code: "BOOKING_NOT_FOUND", message: "ไม่พบรายการจอง" };
  after(() => pushLine(`✏️ แก้ไขคำร้อง ${booking.doc_no} (รอตรวจสอบใหม่)\nห้อง ${booking.room.code} · ${fmtDate(booking.starts_at, "medium")}`));
  return { ok: true, data: booking };
}

/** Cancel (≥ 24 h before) */
export async function cancelBooking(bookingId: string, reason: string): Promise<ActionResult<BookingWithRoom>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId, p_reason: reason });
  if (error) return toActionError(error);
  const booking = await loadBooking(supabase, bookingId);
  if (!booking) return { ok: false, code: "BOOKING_NOT_FOUND", message: "ไม่พบรายการจอง" };
  after(() =>
    pushLine(
      `⊘ ผู้จองยกเลิก ${booking.doc_no}\nห้อง ${booking.room.code} · ${fmtDate(booking.starts_at, "medium")} ${fmtTimeRange(booking.starts_at, booking.ends_at)}`,
    ),
  );
  return { ok: true, data: booking };
}
