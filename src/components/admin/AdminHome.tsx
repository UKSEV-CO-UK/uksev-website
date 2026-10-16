"use client";
import { EditView } from "./EditView";
import { ListView } from "./ListView";

/** /admin/ opens straight on the list: who may open it is Cloudflare Access's job, commits are the Worker's. */
export function AdminHome() {
  return <ListView />;
}

export function AdminEdit() {
  return <EditView />;
}
