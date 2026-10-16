"use client";
import Link from "next/link";
import { useState } from "react";
import { errorCode, verifyToken, type VerifyResult } from "@/lib/admin/api";
import { addDaysIso, clearToken, maskToken, saveToken, todayIso, type StoredToken } from "@/lib/admin/token";
import { AIcon } from "./AIcon";
import { REPO } from "./PublishSheet";
import { TopBar } from "./Chrome";

const HOW =
  "https://github.com/settings/personal-access-tokens/new?name=UKSEV%20pre-owned%20admin&description=Publish%20pre-owned%20listings%20from%20uksev.co.uk%2Fadmin&target_name=UKSEV-CO-UK&expires_in=90&contents=write";

type S =
  | { k: "idle" }
  | { k: "checking" }
  | { k: "ok"; r: VerifyResult }
  | { k: "err"; code: "expired" | "repo" | "perm" | "offline" | "empty"; login?: string };

export function SignIn({ onDone, replacing }: { onDone: () => void; replacing?: boolean }) {
  const [tok, setTok] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [s, setS] = useState<S>({ k: "idle" });
  const [expiry, setExpiry] = useState(addDaysIso(90));

  const check = async () => {
    if (s.k === "ok") {
      const r = s.r;
      const fromGitHub = r.expiresAt ? r.expiresAt.slice(0, 10) : undefined;
      saveToken({
        token: tok.trim(),
        login: r.login,
        remember,
        savedAt: todayIso(),
        expiresAt: fromGitHub ?? (expiry || undefined),
        expiryManual: !fromGitHub,
      });
      onDone();
      return;
    }
    if (!tok.trim()) return setS({ k: "err", code: "empty" });
    setS({ k: "checking" });
    try {
      const r = await verifyToken(tok.trim());
      setS(r.canWrite ? { k: "ok", r } : { k: "err", code: "perm", login: r.login });
    } catch (e) {
      const c = errorCode(e);
      setS({ k: "err", code: c === "unauthorized" ? "expired" : c === "offline" ? "offline" : "repo" });
    }
  };

  const bad = s.k === "err";
  const res =
    s.k === "checking" ? (
      <div className="callout grey">
        <span className="spin am" />
        <div>
          <b>Checking token…</b>Asking GitHub about access to <code style={{ whiteSpace: "nowrap" }}>{REPO}</code>
        </div>
      </div>
    ) : s.k === "ok" ? (
      <div className="okcard">
        <div className="h">
          <AIcon name="check" />
          Token works · @{s.r.login}
        </div>
        <dl>
          <div>
            <dt>Repository</dt>
            <dd>
              <code>{REPO}</code>
            </dd>
          </div>
          <div>
            <dt>Contents</dt>
            <dd>
              <AIcon name="check" />
              Can write
            </dd>
          </div>
          {s.r.expiresAt && (
            <div>
              <dt>Expires</dt>
              <dd>{s.r.expiresAt.slice(0, 10)}</dd>
            </div>
          )}
        </dl>
      </div>
    ) : s.k === "err" && s.code !== "empty" ? (
      <div className={`callout ${s.code === "offline" ? "grey" : "red"}`}>
        <AIcon name="alert" />
        {s.code === "repo" && (
          <div>
            <b>No access to the website repo</b>This token can’t see <code>{REPO}</code>. Edit the token on GitHub and add
            this repository under “Repository access”.
          </div>
        )}
        {s.code === "expired" && (
          <div>
            <b>Token expired, revoked or mistyped</b>GitHub doesn’t accept this token. Create a new one and paste it here.
          </div>
        )}
        {s.code === "perm" && (
          <div>
            <b>Read-only token: missing Contents write</b>Signed in as @{s.login}, but this token can’t write. Set Contents
            to “Read and write” on GitHub, then paste it again.
          </div>
        )}
        {s.code === "offline" && (
          <div>
            <b>No internet connection</b>Connect and try again.
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="adm pg-sign">
      <TopBar />
      <main className="wrap">
        <div className="eyebrow k">{replacing ? "Replace token" : "First time on this device"}</div>
        <h1>Sign in with a GitHub token</h1>
        <p className="lead">
          Saving a listing updates the website’s GitHub repo directly, so each admin uses their own token. It stays in
          this browser and is only ever sent to GitHub.
        </p>
        <dl className="req">
          <div>
            <dt>Type</dt>
            <dd>Fine-grained token</dd>
          </div>
          <div>
            <dt>Repository</dt>
            <dd>
              <code>{REPO}</code> only
            </dd>
          </div>
          <div>
            <dt>Permission</dt>
            <dd>Contents · Read and write</dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>90 days recommended</dd>
          </div>
        </dl>
        <a className="how" href={HOW} target="_blank" rel="noopener noreferrer">
          How to create a token
          <AIcon name="ext" />
        </a>
        <div className={`f${bad ? " bad" : s.k === "ok" ? " good" : ""}`}>
          <label htmlFor="tok">Token</label>
          <div className="in">
            <input
              id="tok"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste token (github_pat_…)"
              value={tok}
              aria-invalid={bad}
              onChange={(e) => {
                setTok(e.target.value);
                if (s.k !== "idle" && s.k !== "checking") setS({ k: "idle" });
              }}
              onKeyDown={(e) => e.key === "Enter" && check()}
            />
            <button type="button" className="eye" aria-label={show ? "Hide token" : "Show token"} onClick={() => setShow((v) => !v)}>
              <AIcon name="eye" />
            </button>
          </div>
          <div className="help">
            {s.k === "err" && s.code === "empty"
              ? "Paste a token first."
              : bad
                ? "Fix the token on GitHub, then paste it again."
                : "Paste the whole token. It won’t be shown again after you save."}
          </div>
        </div>
        <div className="res">{res}</div>
        {s.k === "ok" && !s.r.expiresAt && (
          <div className="f exp">
            <label htmlFor="exp">Token expiry date</label>
            <div className="in">
              <input id="exp" type="date" value={expiry} min={todayIso()} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div className="help">GitHub didn’t tell us the date. Enter the one you chose, and we’ll remind you 7 days before.</div>
          </div>
        )}
        <div className="rem">
          <div>
            <b>Remember on this phone</b>
            <small>Off = forget when tab closes</small>
          </div>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={remember}
            aria-label="Remember on this phone"
            onClick={() => setRemember((v) => !v)}
          >
            <i />
          </button>
        </div>
        <button className="btn pub go" disabled={s.k === "checking"} onClick={check}>
          {s.k === "checking" ? (
            <>
              <span className="spin" style={{ borderColor: "rgba(20,16,11,.25)", borderTopColor: "#14100b" }} />
              Checking…
            </>
          ) : s.k === "ok" ? (
            "Save and continue"
          ) : (
            "Check token"
          )}
        </button>
        {replacing && (
          <Link className="btn go" href="/admin/" style={{ marginTop: 8 }}>
            Cancel
          </Link>
        )}
        <p className="store">
          <AIcon name="lock" />
          <span>Only sent to GitHub. On a shared computer, turn “Remember” off or sign out when you’re done.</span>
        </p>
      </main>
    </div>
  );
}

const initials = (s: string) => s.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";

export function Account({ auth, onReplace }: { auth: StoredToken; onReplace: () => void }) {
  return (
    <div className="adm pg-sign">
      <TopBar />
      <main className="wrap">
        <div className="eyebrow k">Account</div>
        <h1>Signed in on this device</h1>
        <div className="signed">
          <div className="t">
            <span className="av">{initials(auth.login)}</span>
            <div>
              <b>@{auth.login}</b>
              <small>Can publish to {REPO}</small>
            </div>
          </div>
          <dl>
            <div>
              <dt>Token</dt>
              <dd>
                <code>{maskToken(auth.token)}</code>
              </dd>
            </div>
            <div>
              <dt>Permission</dt>
              <dd>Contents · Read and write</dd>
            </div>
            <div>
              <dt>Remembered</dt>
              <dd>{auth.remember ? "On this phone" : "Until this tab closes"}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd>{auth.savedAt}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{auth.expiresAt ? `${auth.expiresAt.slice(0, 10)}${auth.expiryManual ? " (entered)" : ""}` : "Unknown"}</dd>
            </div>
          </dl>
        </div>
        <div className="acts">
          <Link className="btn pub" href="/admin/">
            Go to listings
          </Link>
          <button className="btn" onClick={onReplace}>
            Replace token
          </button>
          <button
            className="btn signout"
            onClick={() => {
              clearToken();
            }}
          >
            Sign out and clear token
          </button>
        </div>
        <p className="store">
          <AIcon name="lock" />
          <span>The token can’t be viewed again. To change it, replace it with a new one.</span>
        </p>
      </main>
    </div>
  );
}
