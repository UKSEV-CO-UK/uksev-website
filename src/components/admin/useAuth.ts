"use client";
import { useEffect, useSyncExternalStore } from "react";
import { setToken } from "@/lib/admin/api";
import { readToken, type StoredToken } from "@/lib/admin/token";

const subscribe = (cb: () => void) => {
  window.addEventListener("uksev-admin-token", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("uksev-admin-token", cb);
    window.removeEventListener("storage", cb);
  };
};
let cacheRaw: string | null = null;
let cacheVal: StoredToken | null = null;
const snapshot = () => {
  const v = readToken();
  const raw = v ? JSON.stringify(v) : null;
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheVal = v;
  }
  return cacheVal;
};

/** undefined = not read yet (server render / first paint), null = signed out. */
export function useAuth(): StoredToken | null | undefined {
  const t = useSyncExternalStore(subscribe, snapshot, () => undefined);
  useEffect(() => {
    if (t !== undefined) setToken(t?.token ?? null);
  }, [t]);
  if (t) setToken(t.token); // available synchronously for the first loadAll()
  return t;
}
