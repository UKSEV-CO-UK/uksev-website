import { Suspense } from "react";
import { AdminEdit } from "@/components/admin/AdminHome";

/** /admin/edit/?slug=<slug> | ?draft=<id> | (nothing = new listing). Query, not a route: static export. */
export default function AdminEditPage() {
  return (
    <Suspense fallback={<div className="adm" />}>
      <AdminEdit />
    </Suspense>
  );
}
