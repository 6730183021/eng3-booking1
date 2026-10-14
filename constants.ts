import type { BookingStatus, UserRole } from "./types";

export const APP_NAME = "ระบบจองห้อง อาคาร 3";
export const FACULTY_NAME = "คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย";

export const DEPARTMENTS = [
  "วิศวกรรมโยธา",
  "วิศวกรรมไฟฟ้า",
  "วิศวกรรมเครื่องกล",
  "วิศวกรรมอุตสาหการ",
  "วิศวกรรมเคมี",
  "วิศวกรรมเหมืองแร่และปิโตรเลียม",
  "วิศวกรรมสิ่งแวดล้อม",
  "วิศวกรรมสำรวจ",
  "วิศวกรรมโลหการและวัสดุ",
  "วิศวกรรมคอมพิวเตอร์",
  "วิศวกรรมนิวเคลียร์",
  "วิศวกรรมแหล่งน้ำ",
  "หลักสูตรนานาชาติ (ISE)",
  "อื่น ๆ",
] as const;

/** Room facilities (stored as keys in rooms.facilities) */
export const FACILITIES: Record<string, string> = {
  projector: "โปรเจกเตอร์",
  smart_board: "กระดานอัจฉริยะ",
  whiteboard: "ไวท์บอร์ด",
  tv: "จอทีวี",
  mic: "ไมโครโฟน/เครื่องเสียง",
  computers: "เครื่องคอมพิวเตอร์",
  video_conf: "ระบบประชุมออนไลน์",
  power_outlets: "ปลั๊กไฟทุกโต๊ะ",
  aircon: "เครื่องปรับอากาศ",
};

/** Equipment a student can request on the form */
export const EQUIPMENT: Record<string, string> = {
  projector: "โปรเจกเตอร์ + สาย HDMI",
  mic: "ไมโครโฟน",
  speaker: "ลำโพง",
  extension: "ปลั๊กพ่วง",
  video_conf: "กล้อง/ระบบประชุมออนไลน์",
  extra_chairs: "เก้าอี้เพิ่ม",
};

export const ACTIVITY_TYPES: Record<string, string> = {
  study: "การเรียน / ติวหนังสือ",
  club: "กิจกรรมชมรม / สโมสรนิสิต",
  project: "โครงการ / ค่าย",
  meeting: "ประชุม",
  seminar: "สัมมนา / อบรม",
  other: "อื่น ๆ",
};

export const STATUS_META: Record<
  BookingStatus,
  { label: string; short: string; icon: string; badge: string }
> = {
  holding:   { label: "กำลังทำรายการ",            short: "ล็อกไว้",      icon: "🔒", badge: "bg-amber-100 text-amber-800 ring-amber-300" },
  submitted: { label: "ส่งเรื่องแล้ว",             short: "ส่งแล้ว",      icon: "📝", badge: "bg-sky-100 text-sky-800 ring-sky-300" },
  in_review: { label: "เจ้าหน้าที่กำลังตรวจสอบ",   short: "กำลังตรวจสอบ", icon: "⏳", badge: "bg-violet-100 text-violet-800 ring-violet-300" },
  approved:  { label: "อนุมัติแล้ว – พร้อมใช้งาน", short: "อนุมัติแล้ว",  icon: "✅", badge: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  rejected:  { label: "ไม่อนุมัติ",                short: "ไม่อนุมัติ",   icon: "❌", badge: "bg-red-100 text-red-800 ring-red-300" },
  cancelled: { label: "ยกเลิกแล้ว",                short: "ยกเลิก",       icon: "⊘", badge: "bg-slate-100 text-slate-600 ring-slate-300" },
};

export const EVENT_LABELS: Record<string, string> = {
  submitted: "ส่งคำร้อง",
  edited: "แก้ไขข้อมูลคำร้อง",
  review_started: "เจ้าหน้าที่รับเรื่อง/เริ่มตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  revoked: "เพิกถอนการอนุมัติ",
  cancelled: "ยกเลิกโดยผู้จอง",
  room_opened: "เจ้าหน้าที่เปิดห้องแล้ว",
  room_closed: "เจ้าหน้าที่ปิดห้องเรียบร้อย",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "นิสิต",
  staff: "เจ้าหน้าที่ (เปิด–ปิดห้อง)",
  approver: "ผู้อนุมัติเอกสาร",
  super_admin: "ผู้ดูแลระบบ",
};

export const REJECT_REASONS = [
  "ข้อมูลในคำร้องไม่ครบถ้วน",
  "ห้องไม่เหมาะกับลักษณะกิจกรรม",
  "มีกิจกรรมของคณะในช่วงเวลาดังกล่าว",
  "จำนวนผู้เข้าร่วมเกินความจุห้อง",
];

export const STAFF_ROLES: UserRole[] = ["staff", "approver", "super_admin"];
export const isStaffRole = (r?: UserRole | null) => !!r && STAFF_ROLES.includes(r);
export const isApproverRole = (r?: UserRole | null) => r === "approver" || r === "super_admin";
