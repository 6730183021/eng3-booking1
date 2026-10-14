// Notifications (ข้อ 3.2). Both channels are optional: if the env vars are not set,
// messages are written to the server log so the MVP still runs end-to-end.
import { ACTIVITY_TYPES, APP_NAME, STATUS_META } from "./constants";
import type { BookingStatus, BookingWithRoom } from "./types";
import { fmtDate, fmtTimeRange } from "./time";
import { siteUrl } from "./utils";

// ---------------------------------------------------------------- e-mail (Resend)
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dry-run] to=${to} subject="${subject}"`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) console.error("[email] failed", res.status, await res.text());
}

// ---------------------------------------------------------------- LINE Messaging API
// (LINE Notify ended on 31 Mar 2025 — push to a staff group via a LINE Official Account)
export async function pushLine(text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_STAFF_TARGET_ID;
  if (!token || !to) {
    console.info(`[line:dry-run] ${text.replace(/\n/g, " | ")}`);
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) console.error("[line] failed", res.status, await res.text());
}

// ---------------------------------------------------------------- templates
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function emailLayout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Tahoma,'Sarabun',sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <tr><td style="background:#800000;color:#fff;padding:18px 24px;font-size:16px;font-weight:bold">${esc(APP_NAME)} · คณะวิศวกรรมศาสตร์ จุฬาฯ</td></tr>
    <tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px;color:#800000">${esc(title)}</h2>${body}</td></tr>
    <tr><td style="padding:14px 24px;background:#fafafa;color:#6b7280;font-size:12px">อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ</td></tr>
  </table></td></tr></table></body></html>`;
}

function bookingTable(b: BookingWithRoom) {
  const rows: [string, string][] = [
    ["เลขที่คำร้อง", b.doc_no ?? "-"],
    ["ห้อง", `${b.room.code} ${b.room.name} (ชั้น ${b.room.floor})`],
    ["วันที่", fmtDate(b.starts_at)],
    ["เวลา", fmtTimeRange(b.starts_at, b.ends_at)],
    ["กิจกรรม", `${b.activity_name ?? "-"} (${ACTIVITY_TYPES[b.activity_type ?? ""] ?? "-"})`],
    ["ผู้เข้าร่วม", `${b.attendees ?? "-"} คน`],
  ];
  return `<table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">${rows
    .map(([k, v]) => `<tr><td style="color:#6b7280;width:110px;border-bottom:1px solid #f3f4f6">${esc(k)}</td><td style="border-bottom:1px solid #f3f4f6">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0 0"><a href="${href}" style="background:#800000;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;

/** After a student submits */
export async function notifySubmitted(b: BookingWithRoom) {
  const email = b.requester?.email;
  if (email) {
    await sendEmail(
      email,
      `[${b.doc_no}] ได้รับคำร้องขอใช้ห้อง ${b.room.code} แล้ว`,
      emailLayout(
        "ระบบได้รับคำร้องของคุณแล้ว",
        `<p>คำร้องของคุณอยู่ในสถานะ <b>📝 ส่งเรื่องแล้ว</b> และจะเข้าสู่การตรวจสอบตามลำดับ (มาก่อน–ได้ก่อน)</p>${bookingTable(b)}${button(`${siteUrl()}/my-bookings`, "ติดตามสถานะ")}`,
      ),
    );
  }
  await pushLine(
    `📥 คำร้องใหม่ ${b.doc_no}\nห้อง ${b.room.code} · ${fmtDate(b.starts_at, "medium")} ${fmtTimeRange(b.starts_at, b.ends_at)}\nกิจกรรม: ${b.activity_name} (${b.attendees} คน)\nผู้จอง: ${b.requester?.full_name ?? "-"}\n${siteUrl()}/admin/approvals`,
  );
}

/** After an approver changes the status */
export async function notifyStatusChanged(b: BookingWithRoom, status: BookingStatus) {
  const email = b.requester?.email;
  if (!email || !["in_review", "approved", "rejected", "cancelled"].includes(status)) return;
  const meta = STATUS_META[status];
  const note = b.review_note ?? b.cancel_reason;
  await sendEmail(
    email,
    `[${b.doc_no}] สถานะคำร้อง: ${meta.short}`,
    emailLayout(
      `${meta.icon} ${meta.label}`,
      `${note ? `<p style="background:#fef2f2;border-left:4px solid #800000;padding:10px 12px;margin:0 0 14px"><b>หมายเหตุจากเจ้าหน้าที่:</b> ${esc(note)}</p>` : ""}${bookingTable(b)}${
        status === "approved"
          ? `<p style="margin-top:14px">เจ้าหน้าที่จะเปิดห้องให้ก่อนเวลาเริ่มใช้งาน สามารถดาวน์โหลดเอกสารคำร้องได้จากระบบ</p>`
          : ""
      }${button(`${siteUrl()}/my-bookings`, "ดูรายละเอียด")}`,
    ),
  );
}
