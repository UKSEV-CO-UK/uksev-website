/** Verifies the Cloudflare Access JWT (Cf-Access-Jwt-Assertion) with the team's public keys. RS256 only. */

export type AccessConfig = { teamDomain: string; aud: string };
type Jwk = JsonWebKey & { kid?: string };
type Claims = { aud?: string | string[]; exp?: number; nbf?: number; iss?: string; email?: string };

const CERTS_TTL_MS = 10 * 60_000;
let certs: { url: string; at: number; keys: Jwk[] } | null = null;

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = <T>(s: string): T => JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as T;

export const issuer = (teamDomain: string) => `https://${teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

async function keys(teamDomain: string, fetcher: typeof fetch, force = false): Promise<Jwk[]> {
  const url = `${issuer(teamDomain)}/cdn-cgi/access/certs`;
  if (!force && certs && certs.url === url && Date.now() - certs.at < CERTS_TTL_MS) return certs.keys;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Access certs ${res.status}`);
  const { keys: k } = (await res.json()) as { keys: Jwk[] };
  certs = { url, at: Date.now(), keys: k };
  return k;
}

/** Returns the claims if valid, otherwise null. Fails closed when config is missing. */
export async function verifyAccessJwt(
  jwt: string | null,
  cfg: AccessConfig,
  { now = Date.now(), fetcher = fetch }: { now?: number; fetcher?: typeof fetch } = {},
): Promise<Claims | null> {
  if (!jwt || !cfg.teamDomain || !cfg.aud) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = b64urlJson<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== "RS256") return null;
    let jwk = (await keys(cfg.teamDomain, fetcher)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await keys(cfg.teamDomain, fetcher, true)).find((k) => k.kid === header.kid); // key rotation
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const c = b64urlJson<Claims>(parts[1]);
    const t = now / 1000;
    const auds = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!auds.includes(cfg.aud)) return null;
    if (typeof c.exp !== "number" || c.exp < t) return null;
    if (typeof c.nbf === "number" && c.nbf > t + 60) return null;
    if (c.iss !== issuer(cfg.teamDomain)) return null;
    return c;
  } catch {
    return null;
  }
}

/** Test hook. */
export const resetCertCache = () => {
  certs = null;
};
