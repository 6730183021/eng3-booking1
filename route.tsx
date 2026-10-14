// GET /api/bookings/:id/pdf           → inline preview (admin iframe / new tab)
// GET /api/bookings/:id/pdf?download=1 → download
// Access is enforced by RLS: owners and staff only.
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_WITH_ROOM } from "@/lib/queries";
import { BookingDocument } from "@/lib/pdf/booking-document";
import type { BookingWithRoom } from "@/lib/types";
import { siteUrl } from "@/lib/utils";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/bookings/[id]/pdf">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabase.from("bookings").select(BOOKING_WITH_ROOM).eq("id", id).maybeSingle();
  const booking = data as BookingWithRoom | null;
  if (!booking || booking.status === "holding") return new Response("Not found", { status: 404 });

  const pdf = await renderToBuffer(<BookingDocument booking={booking} siteUrl={siteUrl()} generatedAt={new Date()} />);
  const filename = `${booking.doc_no ?? "booking"}.pdf`;
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
