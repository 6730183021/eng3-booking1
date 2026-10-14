import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { AppHeader, Footer, HeaderSkeleton } from "@/components/layout/app-header";

export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

async function Header() {
  const user = await requireUser();
  return <AppHeader user={user} />;
}
