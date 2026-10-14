import { z } from "zod";
import { ACTIVITY_TYPES, DEPARTMENTS, EQUIPMENT } from "./constants";

const phone = z
  .string()
  .trim()
  .regex(/^0[0-9]{8,9}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง (ตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0)");

// รหัสนิสิต is NOT editable: it is derived from the verified Chula e-mail in the database.
export const studentProfileSchema = z.object({
  full_name: z.string().trim().min(3, "กรุณากรอกชื่อ–นามสกุล"),
  department: z.enum(DEPARTMENTS, { message: "กรุณาเลือกภาควิชา" }),
  year_of_study: z.coerce.number().int().min(1, "กรุณาเลือกชั้นปี").max(8),
  phone,
  accept_privacy: z.literal(true, { message: "กรุณารับทราบการเก็บและใช้ข้อมูลส่วนบุคคล" }),
});
export const staffProfileSchema = z.object({
  full_name: z.string().trim().min(3, "กรุณากรอกชื่อ–นามสกุล"),
  phone: phone.optional().or(z.literal("")),
});

export const bookingFormSchema = z.object({
  activity_name: z.string().trim().min(3, "กรุณากรอกชื่อกิจกรรม/โครงการ").max(200),
  activity_type: z.enum(Object.keys(ACTIVITY_TYPES) as [string, ...string[]], { message: "กรุณาเลือกประเภทกิจกรรม" }),
  purpose: z.string().trim().min(10, "กรุณาอธิบายวัตถุประสงค์อย่างน้อย 10 ตัวอักษร").max(1000),
  attendees: z.coerce.number().int().min(1, "จำนวนผู้เข้าร่วมอย่างน้อย 1 คน"),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  advisor_name: z.string().trim().max(200).optional().or(z.literal("")),
  contact_phone: phone,
  equipment: z.array(z.enum(Object.keys(EQUIPMENT) as [string, ...string[]])).default([]),
  extra_notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type BookingFormInput = z.infer<typeof bookingFormSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
