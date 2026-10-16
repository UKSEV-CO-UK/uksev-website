"use client";
import { useEffect, useState } from "react";
import { errorCode, status, type AdminErrorCode, type WorkerStatus } from "@/lib/admin/api";

export type StatusState =
  | { k: "loading" }
  | { k: "ok"; s: WorkerStatus }
  | { k: "error"; code: AdminErrorCode | "unknown" };

/** One /admin-api/status per page load, shared by every component that asks. */
let pending: Promise<StatusState> | null = null;
const fetchStatus = () =>
  (pending ??= status().then(
    (s): StatusState => ({ k: "ok", s }),
    (e): StatusState => ({ k: "error", code: errorCode(e) }),
  ));

export function useWorkerStatus(): StatusState {
  const [st, setSt] = useState<StatusState>({ k: "loading" });
  useEffect(() => {
    let live = true;
    fetchStatus().then((s) => live && setSt(s));
    return () => {
      live = false;
    };
  }, []);
  return st;
}

/** Days until expiry (negative = expired), or null if unknown. */
export function daysLeft(expiresAt: string | null | undefined, now = new Date()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt.length === 10 ? `${expiresAt}T23:59:59` : expiresAt);
  if (Number.isNaN(end)) return null;
  return Math.floor((end - now.getTime()) / 86_400_000);
}
