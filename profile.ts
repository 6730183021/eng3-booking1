"use server";
import { createClient } from "@/lib/supabase/server";
import { toActionError } from "@/lib/errors";
import { fieldErrors, staffProfileSchema, studentProfileSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function saveProfile(
  input: unknown,
): Promise<ActionResult & { fields?: Record<string, string> }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, code: "NOT_AUTHENTICATED", message: "กรุณาเข้าสู่ระบบ" };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, privacy_accepted_at")
    .eq("id", auth.user.id)
    .single();

  let values: Record<string, unknown>;
  if (me?.role === "student") {
    const parsed = studentProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, code: "INVALID", message: "กรุณาตรวจสอบข้อมูล", fields: fieldErrors(parsed.error) };
    }
    const { full_name, department, year_of_study, phone } = parsed.data;
    values = {
      full_name, department, year_of_study, phone,
      privacy_accepted_at: me.privacy_accepted_at ?? new Date().toISOString(),
    };
  } else {
    const parsed = staffProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, code: "INVALID", message: "กรุณาตรวจสอบข้อมูล", fields: fieldErrors(parsed.error) };
    }
    values = { full_name: parsed.data.full_name, phone: parsed.data.phone || null };
  }

  const { error } = await supabase.from("profiles").update(values).eq("id", auth.user.id);
  if (error) return toActionError(error);
  return { ok: true, data: undefined };
}
