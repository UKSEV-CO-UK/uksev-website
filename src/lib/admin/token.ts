/** Where the admin keeps the GitHub token: localStorage ("Remember on this phone") or sessionStorage. Never sent anywhere but GitHub. */
export type StoredToken = {
  token: string;
  login: string;
  remember: boolean;
  /** YYYY-MM-DD the token was saved */
  savedAt: string;
  /** YYYY-MM-DD; from GitHub when available, else what the admin picked at sign-in */
  expiresAt?: string;
  /** true when expiresAt was entered by hand */
  expiryManual?: boolean;
};

const KEY = "uksev-admin-token";

export function readToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  for (const s of [localStorage, sessionStorage]) {
    try {
      const raw = s.getItem(KEY);
      if (raw) return JSON.parse(raw) as StoredToken;
    } catch {
      /* ignore broken entry */
    }
  }
  return null;
}

export function saveToken(t: StoredToken) {
  clearToken();
  (t.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(t));
  window.dispatchEvent(new Event("uksev-admin-token"));
}

export function clearToken() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("uksev-admin-token"));
}

export const maskToken = (t: string) => `${t.slice(0, 11)}••••••••${t.slice(-4)}`;

/** Days until expiry (negative = expired), or null if unknown. */
export function daysLeft(expiresAt: string | undefined, now = new Date()): number | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt.length === 10 ? `${expiresAt}T23:59:59` : expiresAt);
  if (Number.isNaN(end)) return null;
  return Math.floor((end - now.getTime()) / 86_400_000);
}

export function todayIso(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysIso(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}
