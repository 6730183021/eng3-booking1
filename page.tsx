import { Suspense } from "react";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { TaskBoard } from "@/components/admin/task-board";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "ตารางงานเปิด–ปิดห้อง" };

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireStaff();
  return <TaskBoard />;
}
