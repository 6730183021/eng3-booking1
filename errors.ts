import type { ActionResult } from "./types";

/** Fallback Thai messages; the DB usually sends its own text in `hint` */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "กรุณาเข้าสู่ระบบ",
  PROFILE_INCOMPLETE: "กรุณากรอกข้อมูลส่วนตัวให้ครบก่อนจอง",
  SLOT_LOCKED: "มีผู้ใช้อื่นกำลังทำรายการจองช่วงเวลานี้อยู่",
  SLOT_TAKEN: "ช่วงเวลานี้ถูกจองแล้ว",
  HOLD_EXPIRED: "หมดเวลาทำรายการ กรุณาเลือกห้องใหม่อีกครั้ง",
  HOLD_COOLDOWN: "คุณล็อกช่วงเวลานี้ซ้ำหลายครั้งโดยไม่ได้ส่งคำร้อง กรุณารอสักครู่",
  TOO_MANY_HOLDS: "ล็อกห้องบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  ROOM_BLOCKED: "ช่วงเวลานี้ปิดการจอง",
  ROOM_MAINTENANCE: "ห้องนี้ปิดปรับปรุง",
  LEAD_TIME_TOO_SHORT: "ต้องจองล่วงหน้ามากกว่านี้",
  DURATION_TOO_LONG: "ระยะเวลาการจองยาวเกินกำหนด",
  OUTSIDE_OPEN_HOURS: "อยู่นอกเวลาเปิดอาคาร",
  FORM_INCOMPLETE: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน",
  OVER_CAPACITY: "จำนวนผู้เข้าร่วมเกินความจุห้อง",
  CANCEL_WINDOW_PASSED: "เลยกำหนดเวลายกเลิกแล้ว",
  EDIT_WINDOW_PASSED: "เลยกำหนดเวลาแก้ไขแล้ว",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOTE_REQUIRED: "กรุณาระบุเหตุผล",
  EMAIL_DOMAIN_NOT_ALLOWED: "ระบบรองรับเฉพาะอีเมลนิสิต @student.chula.ac.th เท่านั้น",
};

type PgError = { message: string; hint?: string | null; details?: string | null; code?: string };

export function toActionError(error: PgError | Error | unknown): Extract<ActionResult, { ok: false }> {
  const e = error as PgError;
  if (/row-level security|permission denied/i.test(e?.message ?? "")) {
    return { ok: false, code: "FORBIDDEN", message: MESSAGES.FORBIDDEN };
  }
  if (e?.code === "23503") {
    return { ok: false, code: "IN_USE", message: "ข้อมูลนี้ถูกใช้งานอยู่ (มีประวัติการจอง) จึงลบไม่ได้" };
  }
  const code = (e?.message ?? "UNKNOWN").trim();
  const known = /^[A-Z_]+$/.test(code);
  return {
    ok: false,
    code: known ? code : "UNKNOWN",
    message: e?.hint || MESSAGES[code] || (known ? code : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"),
    detail: e?.details ?? undefined,
  };
}

/** Errors that come back from Supabase Auth (sign-up blocked by our trigger, etc.) */
export function authErrorMessage(raw?: string | null): string | null {
  if (!raw) return null;
  if (/database error saving new user|EMAIL_DOMAIN_NOT_ALLOWED/i.test(raw)) return MESSAGES.EMAIL_DOMAIN_NOT_ALLOWED;
  if (/rate limit/i.test(raw)) return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (/expired|invalid/i.test(raw)) return "ลิงก์เข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่";
  return raw;
}
