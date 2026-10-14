import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_WITH_ROOM_AND_EVENTS } from "@/lib/queries";
import type { BookingSettings, BookingWithRoom } from "@/lib/types";
import { MyBookings } from "@/components/booking/my-bookings";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "การจองของฉัน" };

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireUser();
  const supabase = await createClient();
  const [bookings, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_WITH_ROOM_AND_EVENTS)
      .eq("user_id", user.id)
      .neq("status", "holding")
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase.from("booking_settings").select("*").single(),
  ]);
  return (
    <MyBookings
      userId={user.id}
      profile={user}
      initial={(bookings.data ?? []) as BookingWithRoom[]}
      settings={settings.data as BookingSettings}
    />
  );
}
