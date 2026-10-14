// Data Access Layer for the current user. Call these from Server Components
// rendered inside a <Suspense> boundary (Cache Components reads cookies at request time).
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isApproverRole, isStaffRole } from "./constants";
import type { Profile, UserRole } from "./types";

export interface CurrentUser extends Profile {
  profileComplete: boolean;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single<Profile>();
  if (!profile) return null;

  const complete =
    profile.role === "student"
      ? !!(profile.full_name && profile.student_id && profile.department && profile.year_of_study && profile.phone && profile.privacy_accepted_at)
      : !!profile.full_name;
  return { ...profile, profileComplete: complete };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Students must finish onboarding before they can book */
export async function requireCompleteProfile(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.profileComplete) redirect("/onboarding");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(isStaffRole(user.role) ? "/admin" : "/book");
  return user;
}

export const requireStaff = () => requireRole(["staff", "approver", "super_admin"]);
export const requireApprover = () => requireRole(["approver", "super_admin"]);
export const requireSuperAdmin = () => requireRole(["super_admin"]);

export function homeFor(user: CurrentUser): string {
  if (isApproverRole(user.role)) return "/admin/approvals";
  if (isStaffRole(user.role)) return "/admin/tasks";
  return user.profileComplete ? "/book" : "/onboarding";
}
