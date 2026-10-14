import { Suspense } from "react";
import type { Metadata } from "next";
import { requireCompleteProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_WITH_ROOM } from "@/lib/queries";
import type { BookingSettings, BookingWithRoom, Floor, Room } from "@/lib/types";
import { BookingWorkspace } from "@/components/booking/booking-workspace";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "จองห้อง" };

export default function BookPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookContent />
    </Suspense>
  );
}

async function BookContent() {
  const user = await requireCompleteProfile();
  const data = await loadBookingData(user.id);
  return <BookingWorkspace {...data} profile={user} />;
}

async function loadBookingData(userId: string) {
  const supabase = await createClient();
  const serverNow = Date.now();
  const [floors, rooms, settings, hold] = await Promise.all([
    supabase.from("floors").select("*").order("floor"),
    supabase.from("rooms").select("*").order("code"),
    supabase.from("booking_settings").select("*").single(),
    // resume an unfinished hold (e.g. the student refreshed the page)
    supabase
      .from("bookings")
      .select(BOOKING_WITH_ROOM)
      .eq("user_id", userId)
      .eq("status", "holding")
      .gt("hold_expires_at", new Date(serverNow).toISOString())
      .maybeSingle(),
  ]);
  return {
    floors: (floors.data ?? []) as Floor[],
    rooms: (rooms.data ?? []) as Room[],
    settings: settings.data as BookingSettings,
    activeHold: (hold.data as BookingWithRoom | null) ?? null,
    serverNow,
  };
}
