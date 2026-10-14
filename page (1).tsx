import { Suspense } from "react";
import type { Metadata } from "next";
import { requireApprover } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Floor, Room, RoomBlock } from "@/lib/types";
import { RoomManager } from "@/components/admin/room-manager";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "จัดการห้อง" };

export default function RoomsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireApprover();
  const supabase = await createClient();
  const [floors, rooms, blocks] = await Promise.all([
    supabase.from("floors").select("*").order("floor"),
    supabase.from("rooms").select("*").order("code"),
    supabase.from("room_blocks").select("*").gte("ends_at", new Date().toISOString()).order("starts_at"),
  ]);
  return (
    <RoomManager
      floors={(floors.data ?? []) as Floor[]}
      initialRooms={(rooms.data ?? []) as Room[]}
      initialBlocks={(blocks.data ?? []) as RoomBlock[]}
      canEditRooms={user.role === "super_admin"}
    />
  );
}
