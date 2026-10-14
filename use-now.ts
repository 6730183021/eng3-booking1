"use client";
import { useCallback, useEffect, useState } from "react";

/** Ticking clock for countdowns and "expired hold" checks */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Like useNow, but corrected to the server's clock — a student's phone that is
 * a few minutes off must not show a wrong lock countdown or wrong lead-time errors.
 * `serverNow` comes from the page render; `calibrate()` refines it with a
 * timestamp returned by the database (e.g. a hold's created_at).
 */
export function useServerClock(serverNow: number, intervalMs = 1000) {
  const [skew, setSkew] = useState(() => serverNow - Date.now());
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  const calibrate = useCallback((serverIso: string) => setSkew(new Date(serverIso).getTime() - Date.now()), []);
  return { now: new Date(tick + skew), calibrate };
}
