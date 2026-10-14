import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AppHeader, Footer, HeaderSkeleton } from "@/components/layout/app-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="no-print lg:w-56 lg:shrink-0">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <Nav />
          </Suspense>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}

async function Header() {
  const user = await requireStaff();
  // staff need a name: it is printed on documents they approve
  if (!user.profileComplete) redirect("/onboarding");
  return <AppHeader user={user} mode="admin" />;
}

async function Nav() {
  const user = await requireStaff();
  return <AdminNav role={user.role} />;
}
