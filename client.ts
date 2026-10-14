import { createBrowserClient } from "@supabase/ssr";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client (Client Components): realtime subscriptions + reads under RLS */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
