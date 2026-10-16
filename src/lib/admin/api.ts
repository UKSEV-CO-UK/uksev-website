/**
 * The ONLY place the admin pages import the publish layer from.
 * Real GitHub module by default; NEXT_PUBLIC_ADMIN_FAKE=1 swaps in the in-memory fake for local work.
 */
import * as fake from "./fake";
import * as real from "./publish";
import type { AdminApi } from "./types";

const impl: AdminApi = process.env.NEXT_PUBLIC_ADMIN_FAKE === "1" ? fake : real;

export const setToken: AdminApi["setToken"] = (t) => impl.setToken(t);
export const verifyToken: AdminApi["verifyToken"] = (t) => impl.verifyToken(t);
export const loadAll: AdminApi["loadAll"] = () => impl.loadAll();
export const publish: AdminApi["publish"] = (f, m, o) => impl.publish(f, m, o);
export const assetUrl: AdminApi["assetUrl"] = (s) => impl.assetUrl(s);

export * from "./types";
