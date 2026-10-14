// Preview the PDF template without a database — see README ("ดูหน้าตาเอกสาร PDF")
import { renderToFile } from "@react-pdf/renderer";
import { BookingDocument } from "../src/lib/pdf/booking-document";
import type { BookingWithRoom } from "../src/lib/types";

const booking = {
  id: "153e80ba-e0b3-4ff6-930c-b57d0ee2798f", doc_no: "ENG3-2569-00001", room_id: "r", user_id: "u",
  starts_at: "2026-10-16T03:00:00Z", ends_at: "2026-10-16T05:00:00Z", status: "approved", hold_expires_at: null,
  activity_name: "ติวสอบกลางภาควิชาการวิจัยดำเนินงาน (Operations Research) สำหรับนิสิตชั้นปีที่ 3",
  activity_type: "study",
  purpose: "จัดกลุ่มติวทบทวนเนื้อหาก่อนสอบกลางภาค โดยรุ่นพี่ชั้นปีที่ 4 เป็นผู้สอน ครอบคลุมหัวข้อกำหนดการเชิงเส้น วิธีซิมเพล็กซ์ และปัญหาการขนส่ง พร้อมแจกเอกสารประกอบการติวให้ผู้เข้าร่วมทุกคน",
  attendees: 18, organization: "ชมรม IE Club", advisor_name: "ผศ.ดร.สมศักดิ์ ตั้งใจสอน", contact_phone: "0812345678",
  equipment: ["projector", "mic", "extension"], extra_notes: "ขอเปิดห้องก่อนเวลา 15 นาทีเพื่อเตรียมอุปกรณ์",
  requester: { full_name: "นางสาวต้นข้าว ใจดี", student_id: "6530000021", department: "วิศวกรรมอุตสาหการ", year_of_study: 3, phone: "0812345678", email: "6530000021@student.chula.ac.th" },
  submitted_at: "2026-10-14T06:58:01Z", review_started_at: "2026-10-14T07:10:00Z", reviewed_by: "x", reviewer_name: "นายสมชาย เจ้าหน้าที่",
  reviewed_at: "2026-10-14T07:15:00Z", review_note: "อนุมัติ กรุณาคืนห้องในสภาพเรียบร้อย", cancelled_at: null, cancel_reason: null,
  opened_at: null, opened_by: null, closed_at: null, closed_by: null, created_at: "", updated_at: "",
  room: { id: "r", code: "3-208", name: "ห้องติวกลุ่ม 208", floor: 2, capacity: 20 },
} as unknown as BookingWithRoom;
renderToFile(<BookingDocument booking={booking} siteUrl="https://eng3-booking.example.com" generatedAt={new Date()} />, (process.argv[2] ?? "sample.pdf")).then(() => console.log("written", (process.argv[2] ?? "sample.pdf")));
