import { Suspense } from "react";
import { AdminHome } from "@/components/admin/AdminHome";

/** /admin/ — sign-in, account, and the listings list. Client-only (static export). */
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="adm" />}>
      <AdminHome />
    </Suspense>
  );
}
