// Client-side mirror of public.assert_booking_rules() for instant feedback.
// The database remains the source of truth — these checks only improve UX.
import type { Booking, BookingSettings } from "./types";
import { addDays, isoDow, minutesOf, toInstant, dateKey, timeSlots, fmtDuration } from "./time";

export const hm = (t: string) => t.slice(0, 5);

export function startOptions(s: BookingSettings): string[] {
  const all = timeSlots(hm(s.open_time), hm(s.close_time), s.slot_minutes);
  return all.slice(0, -1);
}

export function endOptions(s: BookingSettings, start: string): string[] {
  const max = Math.min(minutesOf(start) + s.max_duration_minutes, minutesOf(hm(s.close_time)));
  return timeSlots(hm(s.open_time), hm(s.close_time), s.slot_minutes).filter(
    (t) => minutesOf(t) > minutesOf(start) && minutesOf(t) <= max,
  );
}

/** First date (Bangkok) that has at least one start time satisfying the lead-time rule */
export function firstBookableDate(s: BookingSettings, now: Date): string {
  const earliest = new Date(now.getTime() + s.min_lead_hours * 3600_000);
  let key = dateKey(earliest);
  for (let i = 0; i < 14; i++) {
    const lastStart = toInstant(key, startOptions(s).at(-1) ?? "08:00");
    if (s.open_days.includes(isoDow(key)) && lastStart >= earliest) return key;
    key = addDays(key, 1);
  }
  return key;
}

/** First start time on `date` that satisfies the lead-time rule */
export function firstStartOn(s: BookingSettings, date: string, now: Date): string {
  const earliest = new Date(now.getTime() + s.min_lead_hours * 3600_000);
  return startOptions(s).find((t) => toInstant(date, t) >= earliest) ?? startOptions(s)[0];
}

export function validateSelection(
  s: BookingSettings, date: string, start: string, end: string, now: Date,
): string | null {
  if (!date || !start || !end) return "กรุณาเลือกวันและเวลา";
  const startAt = toInstant(date, start);
  const endAt = toInstant(date, end);
  if (endAt <= startAt) return "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  if (!s.open_days.includes(isoDow(date))) return "วันที่เลือกอาคารไม่เปิดให้จอง";
  if (minutesOf(start) < minutesOf(hm(s.open_time)) || minutesOf(end) > minutesOf(hm(s.close_time)))
    return `อาคารเปิดให้จอง ${hm(s.open_time)}–${hm(s.close_time)} น.`;
  if ((endAt.getTime() - startAt.getTime()) / 60000 > s.max_duration_minutes)
    return `จองได้สูงสุดครั้งละ ${fmtDuration(s.max_duration_minutes)}`;
  if (startAt.getTime() < now.getTime() + s.min_lead_hours * 3600_000)
    return `ต้องจองล่วงหน้าอย่างน้อย ${s.min_lead_hours} ชั่วโมง`;
  if (startAt.getTime() > now.getTime() + s.max_advance_days * 86400_000)
    return `จองล่วงหน้าได้ไม่เกิน ${s.max_advance_days} วัน`;
  return null;
}

/**
 * Mirrors cancel_booking / update_booking_details:
 *  - edit: any live request, up to `cancel_before_hours` before the start
 *  - cancel: not-yet-approved → any time before the start; approved → same window as edit
 */
export function modifyWindow(b: Pick<Booking, "status" | "starts_at">, s: BookingSettings, now: Date) {
  const start = new Date(b.starts_at);
  const deadline = new Date(start.getTime() - s.cancel_before_hours * 3600_000);
  const live = b.status === "submitted" || b.status === "in_review" || b.status === "approved";
  const canEdit = live && now < deadline;
  const canCancel = live && now < start && (b.status !== "approved" || now < deadline);
  return { canEdit, canCancel, deadline, live };
}

