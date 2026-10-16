/**
 * The ONLY place the admin pages import the publish layer from.
 * Real: worker.ts → same-origin /admin-api/* (Cloudflare Worker behind Access, holds the GitHub token).
 * Fake: fake.ts, in-memory, when the tab opened an admin URL with ?fake[=flags]
 *       (or always under `next dev`, unless ?fake=off).
 */
import * as fake from "./fake";
import type { PublishFile, PublishOptions } from "./types";
import * as worker from "./worker";

const impl = () => (fake.fakeEnabled() || (process.env.NODE_ENV === "development" && !isOff()) ? fake : worker);
const isOff = () => typeof window !== "undefined" && new URLSearchParams(location.search).get("fake") === "off";

export const status = () => impl().status();
export const loadAll = () => impl().loadAll();
export const publish = (files: PublishFile[], message: string, opts: PublishOptions) => impl().publish(files, message, opts);
export const assetUrl = (src: string) => impl().assetUrl(src);
export const usingFake = () => impl() === fake;

export * from "./types";
