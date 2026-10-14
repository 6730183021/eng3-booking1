"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * Subscribes to Postgres changes on one or more tables (RLS-aware) and calls
 * `onChange` for every event. Returns whether the socket is live.
 */
export function useRealtime(
  channelName: string,
  tables: { table: string; filter?: string }[],
  onChange: (payload: Payload) => void,
  enabled = true,
) {
  const supabase = useMemo(() => createClient(), []);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const [live, setLive] = useState(false);
  const key = JSON.stringify(tables);

  useEffect(() => {
    if (!enabled) return;
    const specs = JSON.parse(key) as { table: string; filter?: string }[];
    const channel = supabase.channel(`${channelName}:${Math.random().toString(36).slice(2, 8)}`);
    for (const t of specs) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
        (payload: Payload) => cb.current(payload),
      );
    }
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [supabase, channelName, key, enabled]);

  return live;
}

/** Calls `fn` at most once per `ms` burst (realtime events often arrive in bursts) */
export function useDebounced(fn: () => void, ms = 150) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useMemo(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => ref.current(), ms);
    },
    [ms],
  );
}
