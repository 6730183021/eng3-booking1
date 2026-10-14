// Reminds the staff LINE group ~30 minutes before each room must be opened.
// Call every 5–15 min with:  Authorization: Bearer $CRON_SECRET
//   • Vercel Cron (see vercel.json), or
//   • Supabase pg_cron + pg_net (see README)
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { pushLine } from "@/lib/notify";
import { BOOKING_WITH_ROOM } from "@/lib/queries";
import { timeKey } from "@/lib/time";
import type { BookingWithRoom } from "@/lib/types";

const LOOKAHEAD_MIN = 45;

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  const now = new Date();
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_WITH_ROOM)
    .eq("status", "approved")
    .is("reminder_sent_at", null)
    .is("opened_at", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + LOOKAHEAD_MIN * 60_000).toISOString())
    .order("starts_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as BookingWithRoom[];
  if (due.length) {
    await pushLine(
      [`⏰ ห้องที่ต้องเปิดเร็ว ๆ นี้ (${due.length})`, ...due.map((b) => `• ${timeKey(b.starts_at)} น. ห้อง ${b.room.code} (ชั้น ${b.room.floor}) — ${b.activity_name}, ${b.attendees} คน`)].join("\n"),
    );
    await db.from("bookings").update({ reminder_sent_at: now.toISOString() }).in("id", due.map((b) => b.id));
  }
  return Response.json({ reminded: due.length });
}
