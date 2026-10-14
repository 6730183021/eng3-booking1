import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[460px]" />
        <Skeleton className="h-[460px]" />
      </div>
    </div>
  );
}
