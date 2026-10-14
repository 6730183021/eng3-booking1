import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { HeaderSkeleton } from "@/components/layout/app-header";

export default function Home() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <RedirectByRole />
    </Suspense>
  );
}

async function RedirectByRole() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homeFor(user));
  return null;
}
