/**
 * One-off, re-runnable migration of the scraped new-bike catalogue
 * (`src/data/products.ts`, sourced from markshop.co.uk with authorised image
 * use) into the Markdown content system: one `content/new/<slug>.md` per
 * product plus its cover photo under `public/uploads/new/<slug>/`.
 *
 * `src/data/products.ts` is deleted by the same change, so the script reads it
 * from git at a fixed ref (default: 85f1312, the last main commit that has it).
 * The output depends only on that file, so re-running it rewrites the same
 * Markdown byte for byte. Photos that already exist are not downloaded again.
 *
 * Usage:
 *   npx tsx scripts/migrate-scraped-new-bikes.ts            # write files
 *   npx tsx scripts/migrate-scraped-new-bikes.ts --check    # verify only
 *   npx tsx scripts/migrate-scraped-new-bikes.ts --ref <sha>
 *
 * Mapping rules (no data is invented):
 * - slug: `code` lower-cased, leading "uk-" and trailing "-" removed.
 * - brand, model (from `name`), code, price copied as-is; `was` becomes
 *   `wasPrice`. `priceLabel` is not copied: a "From £…" label becomes
 *   `priceFrom: true` (see scripts/migrate-price-from.ts); a label that is not
 *   `money(price)` or "From " + `money(price)` stops the script.
 * - order: rank by `featured`, ties kept in the original array order (1..n).
 * - colours: left empty (products.ts has no colour names); the cover goes in
 *   the top-level `photos` list instead.
 * - spec: split on "·" into spec rows. Motor / Battery / Wheel size rows are
 *   recognised by shape; every other token goes into one "Features" row.
 *   `motorW` is set only for a plain "<n>W" token (not "peak", "dual", "×2").
 * - type: "e-scooter" when the name says scooter, "accessory" for brand
 *   "Accessory" or a battery / light / rack with no motor, otherwise "e-bike".
 * - `stock` is not migrated (the site has no availability any more) and every
 *   listing is published (`hidden` omitted).
 *
 * `--check` re-derives every listing from the source and fails if a file is
 * missing, a price / wasPrice / priceFrom / code / order differs, or a photo
 * is missing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { priceFromFor } from "./migrate-price-from";

const DEFAULT_REF = "85f1312";
const SOURCE_PATH = "src/data/products.ts";
const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content", "new");
const UPLOAD_DIR = path.join(ROOT, "public", "uploads", "new");

type SourceProduct = {
  brand: string;
  code: string;
  name: string;
  spec: string;
  price: number | null;
  priceLabel: string;
  was?: number;
  stock: boolean;
  featured: number;
  img: string;
};

type SpecRow = { label: string; value: string };

export type Listing = {
  slug: string;
  imgUrl: string;
  stock: boolean;
  data: Record<string, unknown>;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function loadSource(ref: string): Promise<SourceProduct[]> {
  const src = execFileSync("git", ["show", `${ref}:${SOURCE_PATH}`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uksev-products-"));
  const file = path.join(dir, "products.ts");
  fs.writeFileSync(file, src);
  try {
    const mod = (await import(pathToFileURL(file).href)) as { products: SourceProduct[] };
    return mod.products;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function slugFor(code: string): string {
  return code
    .toLowerCase()
    .replace(/^uk-/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+$/, "");
}

/**
 * File extension from the image bytes. The CDN may re-encode (a ".png" URL can
 * come back as JPEG), so the URL's extension is not trusted.
 */
export function sniffExt(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buf.subarray(4, 12).toString("latin1").startsWith("ftypavi")) return "avif";
  throw new Error("downloaded file is not a supported image");
}

const COVER_RE = /^cover\.(jpg|png|webp|gif|avif)$/;

/** Existing cover photo file name in public/uploads/new/<slug>/, if any. */
function existingCover(slug: string): string | undefined {
  const dir = path.join(UPLOAD_DIR, slug);
  if (!fs.existsSync(dir)) return undefined;
  return fs.readdirSync(dir).filter((f) => COVER_RE.test(f)).sort()[0];
}

export function specRows(spec: string): { rows: SpecRow[]; motorW?: number; battery?: string } {
  const tokens = spec
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);
  const rows: SpecRow[] = [];
  const features: string[] = [];
  let motorW: number | undefined;
  let battery: string | undefined;
  for (const t of tokens) {
    if (/^\d+(\.\d+)?W\b/.test(t)) {
      rows.push({ label: "Motor", value: t });
      const plain = t.match(/^(\d+)W$/);
      if (plain && motorW == null) motorW = Number(plain[1]);
    } else if (/^\d+(\.\d+)?V\/\d+(\.\d+)?Ah$/.test(t)) {
      rows.push({ label: "Battery", value: t });
      battery ??= t;
    } else if (/^\d+(\.\d+)?Ah$/.test(t)) {
      rows.push({ label: "Battery", value: t });
      battery ??= t;
    } else if (/^\d+(\.\d+)?″$/.test(t)) {
      rows.push({ label: "Wheel size", value: t });
    } else {
      features.push(t);
    }
  }
  if (features.length) rows.push({ label: "Features", value: features.join(" · ") });
  return { rows, motorW, battery };
}

export function typeFor(p: SourceProduct): string {
  if (/scooter/i.test(p.name)) return "e-scooter";
  const hasMotor = p.spec.split("·").some((t) => /^\d+(\.\d+)?W\b/.test(t.trim()));
  if (p.brand === "Accessory") return "accessory";
  if (!hasMotor && /battery|light|rack/i.test(`${p.name} ${p.spec}`)) return "accessory";
  return "e-bike";
}

export function buildListings(products: SourceProduct[]): Listing[] {
  const ranked = products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.featured - b.p.featured || a.i - b.i);
  const orderOf = new Map(ranked.map(({ p }, rank) => [p.code, rank + 1]));
  const slugs = new Set<string>();
  return products.map((p) => {
    const slug = slugFor(p.code);
    if (slugs.has(slug)) throw new Error(`duplicate slug ${slug} (${p.code})`);
    slugs.add(slug);
    if (p.price == null) throw new Error(`${p.code}: price is null`);
    const priceFrom = priceFromFor(p.priceLabel, p.price);
    if (priceFrom === null) throw new Error(`${p.code}: priceLabel ${JSON.stringify(p.priceLabel)} does not match price ${p.price}`);
    const { rows, motorW, battery } = specRows(p.spec);
    const data: Record<string, unknown> = {
      type: typeFor(p),
      brand: p.brand,
      model: p.name,
      code: p.code,
      order: orderOf.get(p.code),
      price: p.price,
      ...(priceFrom ? { priceFrom: true } : {}),
      ...(p.was != null ? { wasPrice: p.was } : {}),
      photos: [] as { src: string }[], // filled in once the cover file is known
      ...(battery ? { battery } : {}),
      ...(motorW != null ? { motorW } : {}),
      ...(rows.length ? { specs: rows } : {}),
    };
    return { slug, imgUrl: p.img, stock: p.stock, data };
  });
}

const HEADER =
  "# Migrated from src/data/products.ts by scripts/migrate-scraped-new-bikes.ts.\n" +
  "# Source catalogue: markshop.co.uk (authorised image use). Guide prices.\n";

export function withCover(l: Listing, file: string): Listing {
  return { ...l, data: { ...l.data, photos: [{ src: `/uploads/new/${l.slug}/${file}` }] } };
}

export function renderMarkdown(l: Listing): string {
  const fm = matter.stringify("", l.data).replace(/^---\n/, `---\n${HEADER}`);
  return fm.endsWith("\n") ? fm : `${fm}\n`;
}

/** Download the cover into public/uploads/new/<slug>/cover.<ext>; returns the file name. */
async function download(l: Listing): Promise<string> {
  const res = await fetch(l.imgUrl);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${l.imgUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `cover.${sniffExt(buf)}`;
  const dir = path.join(UPLOAD_DIR, l.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), buf);
  return file;
}

function check(listings: Listing[]): string[] {
  const problems: string[] = [];
  for (const l of listings) {
    const file = path.join(CONTENT_DIR, `${l.slug}.md`);
    if (!fs.existsSync(file)) {
      problems.push(`${l.slug}: content file missing`);
      continue;
    }
    const { data } = matter(fs.readFileSync(file, "utf8"));
    for (const k of ["price", "wasPrice", "priceFrom", "code", "order", "brand", "model"]) {
      if (data[k] !== l.data[k]) {
        problems.push(`${l.slug}: ${k} is ${JSON.stringify(data[k])}, source says ${JSON.stringify(l.data[k])}`);
      }
    }
    const cover = existingCover(l.slug);
    const photos = Array.isArray(data.photos) ? data.photos : [];
    const src = photos[0] && typeof photos[0] === "object" ? (photos[0] as { src?: unknown }).src : undefined;
    if (!cover) problems.push(`${l.slug}: photo missing`);
    else if (src !== `/uploads/new/${l.slug}/${cover}`) problems.push(`${l.slug}: photos[0] is ${JSON.stringify(src)}`);
  }
  return problems;
}

async function main() {
  const ref = arg("--ref") ?? DEFAULT_REF;
  const products = await loadSource(ref);
  const listings = buildListings(products);

  if (process.argv.includes("--check")) {
    const problems = check(listings);
    for (const p of problems) console.error(p);
    console.log(`checked ${listings.length} listings from ${SOURCE_PATH}@${ref}: ${problems.length} problem(s)`);
    process.exit(problems.length ? 1 : 0);
  }

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  let downloaded = 0;
  for (const l of listings) {
    let cover = existingCover(l.slug);
    if (!cover) {
      cover = await download(l);
      downloaded++;
    }
    fs.writeFileSync(path.join(CONTENT_DIR, `${l.slug}.md`), renderMarkdown(withCover(l, cover)));
  }
  const noStock = listings.filter((l) => !l.stock).map((l) => l.data.code);
  console.log(`wrote ${listings.length} listings, downloaded ${downloaded} photo(s)`);
  console.log(`stock:false in source (published, stock not migrated): ${noStock.join(", ") || "none"}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
