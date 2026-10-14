"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { dayBounds } from "@/lib/time";
import type { Room, RoomBlock, RoomSlot } from "@/lib/types";
import { useDebounced, useRealtime } from "./use-realtime";

async function fetchDay(supabase: SupabaseClient, date: string) {
  const { start, end } = dayBounds(date);
  const [s, b, r] = await Promise.all([
    supabase.from("room_slots").select("*").lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
    supabase.from("room_blocks").select("*").lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
    supabase.from("rooms").select("*").order("code"),
  ]);
  return {
    date,
    slots: (s.data ?? null) as RoomSlot[] | null,
    blocks: (b.data ?? null) as RoomBlock[] | null,
    rooms: (r.data ?? null) as Room[] | null,
  };
}

/**
 * Live occupancy for one day: anonymous slots (held / pending / approved),
 * closures, and room status. Re-fetches whenever anything changes in the DB.
 */
export function useRoomAvailability(date: string, initialRooms: Room[]) {
  const supabase = useMemo(() => createClient(), []);
  const [slots, setSlots] = useState<RoomSlot[]>([]);
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentDate = useRef(date);
  useEffect(() => {
    currentDate.current = date;
  }, [date]);

  // ignore responses for a date the user has already navigated away from
  const apply = useCallback((res: Awaited<ReturnType<typeof fetchDay>>) => {
    if (res.date !== currentDate.current) return;
    if (res.slots) setSlots(res.slots);
    if (res.blocks) setBlocks(res.blocks);
    if (res.rooms) setRooms(res.rooms);
    setLoadedFor(res.date);
  }, []);

  useEffect(() => {
    fetchDay(supabase, date).then(apply);
  }, [supabase, date, apply]);

  const refetch = useDebounced(() => {
    fetchDay(supabase, currentDate.current).then(apply);
  }, 120);
  const live = useRealtime(
    `availability-${date}`,
    [{ table: "room_slots" }, { table: "room_blocks" }, { table: "rooms" }],
    refetch,
  );

  return { slots, blocks, rooms, loading: loadedFor !== date, live };
}
