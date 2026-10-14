import { Suspense } from "react";
import type { Metadata } from "next";
import { requireApprover } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchInbox } from "@/lib/inbox";
import { ApprovalInbox } from "@/components/admin/approval-inbox";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "คำร้องรออนุมัติ" };

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireApprover();
  const supabase = await createClient();
  return <ApprovalInbox initial={await fetchInbox(supabase)} />;
}
