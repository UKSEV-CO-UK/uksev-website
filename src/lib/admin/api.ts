/**
 * The ONLY place the admin pages import the publish layer from.
 * Switching to the real GitHub module is this one line: "./fake" → "./publish".
 * publish.ts must export these five functions with the signatures in types.ts (AdminApi).
 */
export { setToken, verifyToken, loadAll, publish, assetUrl } from "./fake";

export * from "./types";
