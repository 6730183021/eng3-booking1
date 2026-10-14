import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homeFor, requireStaff } from "@/lib/auth";

export default function AdminIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  );
}

async function Go() {
  const user = await requireStaff();
  redirect(homeFor(user));
  return null;
}
