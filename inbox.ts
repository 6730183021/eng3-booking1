import type { SupabaseClient } from "@supabase/supabase-js";
import { BOOKING_WITH_ROOM_AND_EVENTS } from "./queries";
import type { BookingWithRoom } from "./types";

/**
 * Approver inbox data: the WHOLE pending queue (FIFO, never truncated) plus the
 * most recent decisions. Two queries so old history can never push new requests
 * out of the result set.
 */
export async function fetchInbox(supabase: SupabaseClient, recentLimit = 150): Promise<BookingWithRoom[]> {
  const [queue, recent] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_WITH_ROOM_AND_EVENTS)
      .in("status", ["submitted", "in_review"])
      .order("submitted_at", { ascending: true }),
    supabase
      .from("bookings")
      .select(BOOKING_WITH_ROOM_AND_EVENTS)
      .in("status", ["approved", "rejected", "cancelled"])
      .order("updated_at", { ascending: false })
      .limit(recentLimit),
  ]);
  return [...((queue.data ?? []) as BookingWithRoom[]), ...((recent.data ?? []) as BookingWithRoom[])];
}
