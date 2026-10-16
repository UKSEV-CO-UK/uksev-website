/**
 * In-memory stand-in for publish.ts so the admin can be built and tested
 * before the real GitHub module lands. Nothing leaves the browser.
 *
 * Simulate failures with ?fake=<flags> on any admin URL (comma-separated, kept
 * for the tab; each error fires once on the next publish):
 *   retry      main moved → automatic retry, then success
 *   conflict   the same listing was changed by @example-colleague
 *   exhausted  retries ran out
 *   offline    network error
 *   expired    401 on publish (and on verifyToken)
 *   readonly   verifyToken → canWrite false; publish → 403
 *   expiry     verifyToken returns expiresAt 5 days from now
 *   slow       5× slower
 *   empty      start with no listings
 *   reset      clear the fake repo state
 */
import { fromMarkdown } from "./serialize";
import {
  AdminApiError,
  type LoadAllResult,
  type PublishFile,
  type PublishOptions,
  type RepoBike,
  type VerifyResult,
} from "./types";

const FLAG_KEY = "uksev-fake-flags";
const STATE_KEY = "uksev-fake-repo";
type State = { headSha: string; cars: RepoBike[]; touched: Record<string, string> };

let token: string | null = null;
const blobUrls = new Map<string, string>();

function flags(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const q = new URLSearchParams(location.search).get("fake");
  if (q != null) sessionStorage.setItem(FLAG_KEY, q);
  return new Set((sessionStorage.getItem(FLAG_KEY) || "").split(",").filter(Boolean));
}
function consume(flag: string): boolean {
  const f = flags();
  if (!f.has(flag)) return false;
  f.delete(flag);
  sessionStorage.setItem(FLAG_KEY, [...f].join(","));
  return true;
}
const speed = () => (flags().has("slow") ? 5 : 1);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms * speed()));
const sha = () => Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const P = "/uploads/pre-owned/";
const seed = (): RepoBike[] =>
  (
    [
      ["fake-himo-c26-max", { type: "e-bike", brand: "HIMO", model: "C26 Max", year: 2023, mileage: 960, price: 745, batteryHealth: 94, grade: "A", status: "reserved", date: "2026-10-15" }],
      ["fake-ado-air-20-pro", { type: "e-bike", brand: "ADO", model: "Air 20 Pro", year: 2024, mileage: 410, price: 1095, batteryHealth: 97, grade: "A", status: "available", date: "2026-10-14" }],
      ["fake-duotts-t10", { type: "e-scooter", brand: "DUOTTS", model: "T10 Scooter", year: 2023, mileage: 640, price: 449, chargeCycles: 180, grade: "B", status: "available", date: "2026-10-13" }],
      ["fake-eleglide-m2", { type: "e-bike", brand: "Eleglide", model: "M2 Trekking", year: 2022, mileage: 2400, price: 469, grade: "B", status: "available", date: "2026-10-11" }],
      ["fake-duotts-c29", { type: "e-bike", brand: "DUOTTS", model: "C29 Mountain", year: 2023, mileage: 1980, price: 899, batteryHealth: 88, grade: "B", status: "sold", soldDate: "2026-10-12", date: "2026-10-01" }],
    ] as const
  ).map(([slug, d]) => ({
    slug,
    path: `content/pre-owned/${slug}.md`,
    data: {
      ...d,
      batteryWh: 504,
      motorW: 250,
      wheelSize: "26″",
      photos: [{ src: `${P}example-side.svg` }, { src: `${P}example-battery.svg` }, { src: `${P}example-wheel.svg` }],
      inspection: [
        { item: "Brakes", result: "pass" },
        { item: "Chain", result: "replaced", text: "New chain fitted, gears indexed" },
      ],
      included: [{ item: "Charger", included: true }, { item: "Original box", included: false }],
    },
    body: "One previous owner, short commute, stored indoors. Charged and road-tested.",
    updatedAt: `${d.date}T10:00:00Z`,
  }));

function load(): State {
  const f = flags();
  if (f.has("reset")) {
    sessionStorage.removeItem(STATE_KEY);
    consume("reset");
  }
  const raw = sessionStorage.getItem(STATE_KEY);
  if (raw) return JSON.parse(raw) as State;
  const s: State = { headSha: sha(), cars: f.has("empty") ? [] : seed(), touched: {} };
  save(s);
  return s;
}
const save = (s: State) => sessionStorage.setItem(STATE_KEY, JSON.stringify(s));

function guard() {
  if (!token) throw new AdminApiError("unauthorized", "Not signed in");
}

export function setToken(t: string | null) {
  token = t;
}

export async function verifyToken(t: string): Promise<VerifyResult> {
  await wait(900);
  const f = flags();
  if (f.has("offline")) throw new AdminApiError("offline");
  if (f.has("expired") || !/^(github_pat_|ghp_)\w{10,}/.test(t.trim())) throw new AdminApiError("unauthorized", "Bad credentials");
  const expiresAt = f.has("expiry") ? new Date(Date.now() + 5 * 86_400_000).toISOString() : undefined;
  return { login: "example-admin", canWrite: !f.has("readonly"), expiresAt };
}

export async function loadAll(): Promise<LoadAllResult> {
  guard();
  await wait(500);
  const s = load();
  return { headSha: s.headSha, cars: structuredClone(s.cars) };
}

export async function publish(
  files: PublishFile[],
  message: string,
  { baseSha, onProgress }: PublishOptions,
): Promise<{ commitSha: string }> {
  guard();
  void message;
  const s = load();
  if (consume("offline")) {
    await wait(400);
    throw new AdminApiError("offline", "Failed to fetch");
  }
  if (consume("expired")) {
    await wait(400);
    throw new AdminApiError("unauthorized", "Bad credentials");
  }
  if (flags().has("readonly")) {
    await wait(400);
    throw new AdminApiError("forbidden", "Resource not accessible by personal access token");
  }
  const writes = files.filter((f) => f.content !== null);
  const total = writes.length;
  onProgress?.({ stage: "blobs", done: 0, total });
  for (let i = 0; i < total; i++) {
    await wait(writes[i].content instanceof Blob ? 350 : 150);
    onProgress?.({ stage: "blobs", done: i + 1, total });
  }
  onProgress?.({ stage: "commit", done: 0, total: 1 });
  await wait(700);

  // Conflict: a file we write was changed after baseSha by someone else.
  const mdPaths = files.filter((f) => f.path.endsWith(".md")).map((f) => f.path);
  const changed = mdPaths.filter((p) => s.touched[p] && s.touched[p] !== baseSha && baseSha !== s.headSha);
  if (consume("conflict") && mdPaths.some((p) => s.cars.some((c) => c.path === p))) {
    const p = mdPaths.find((x) => s.cars.some((c) => c.path === x))!;
    const car = s.cars.find((c) => c.path === p)!;
    car.data = { ...car.data, price: Number(car.data.price ?? 0) - 20 };
    car.updatedAt = new Date().toISOString();
    s.headSha = sha();
    s.touched[p] = s.headSha;
    save(s);
    throw new AdminApiError("conflict", "Changed on main", { paths: [p], by: "example-colleague", at: car.updatedAt });
  }
  if (changed.length) throw new AdminApiError("conflict", "Changed on main", { paths: changed });
  if (consume("exhausted")) {
    for (let i = 0; i < 3; i++) {
      onProgress?.({ stage: "retry", done: i + 1, total: 3 });
      await wait(700);
    }
    throw new AdminApiError("retry_exhausted", "main kept moving");
  }
  if (consume("retry")) {
    onProgress?.({ stage: "retry", done: 1, total: 3 });
    await wait(1400);
    onProgress?.({ stage: "commit", done: 0, total: 1 });
    await wait(500);
  }

  const commitSha = sha();
  for (const f of files) {
    if (f.path.startsWith("public/")) {
      const src = f.path.slice("public".length);
      if (f.content instanceof Blob) blobUrls.set(src, URL.createObjectURL(f.content));
      else if (f.content === null) blobUrls.delete(src);
      continue;
    }
    if (!f.path.startsWith("content/pre-owned/")) continue;
    const slug = f.path.replace(/^.*\//, "").replace(/\.md$/, "");
    s.cars = s.cars.filter((c) => c.path !== f.path);
    if (typeof f.content === "string") {
      const { data, body } = fromMarkdown(f.content);
      s.cars.push({ slug, path: f.path, data, body, updatedAt: new Date().toISOString() });
    }
    s.touched[f.path] = commitSha;
  }
  s.headSha = commitSha;
  save(s);
  onProgress?.({ stage: "done", done: 1, total: 1 });
  return { commitSha };
}

export function assetUrl(src: string): string {
  return blobUrls.get(src) ?? src;
}
