import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "ข้อมูลส่วนตัว" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireUser();
  return <OnboardingForm profile={user} firstTime={!user.profileComplete} />;
}
