"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assetUrl, errorCode, loadAll, type RepoBike } from "@/lib/admin/api";
import { deleteDraft, getDraft, listDrafts, newDraftId, putDraft, type DraftPhoto, type LocalDraft } from "@/lib/admin/drafts";
import {
  INCLUDED_PRESETS,
  buildDelete,
  buildPublish,
  emptyForm,
  formFromRepo,
  formToData,
  uniqueSlug,
  type FormState,
  type IncludedRow,
} from "@/lib/admin/form";
import { ImageError, MAX_PHOTOS, mb, processImage } from "@/lib/admin/images";
import { validateBike, type FieldError } from "@/lib/preowned-schema";
import { GRADES, GRADE_WORD, STATUS_LABEL, STATUSES, TYPES, TYPE_LABEL, money, type Status } from "@/lib/preowned-types";
import { AIcon } from "./AIcon";
import { ACCESS_EXPIRED as ACCESS, AccessExpired, DeployBanner, StatusNotice, TopBar, useToast } from "./Chrome";
import { blobUrl } from "./draftSummary";
import { humanError } from "./fieldLabels";
import { PublishSheet } from "./PublishSheet";
import { usePublish } from "./usePublish";

type EPhoto = DraftPhoto & { id: string };
type Busy = { id: string; name: string; origSize: number };

const BRANDS = ["ADO", "BEZIOR", "COSWHEEL", "DUOTTS", "DYU", "Eleglide", "ENGWE", "FIIDO", "HIMO", "LANKELEISI", "SAMEBIKE"];
const FRAMES = ["One size", "S", "M", "L", "XL"];
const WHEELS = ["8.5″", "10″", "16″", "20″", "24″", "26″", "27.5″", "29″"];
const SOURCES = ["BMS app", "Battery tester", "Display", "Seller's figure"];
const SHOTS = ["Full side · cover", "Front", "Battery", "Motor", "Display / odometer", "All defects close-up"];
/** DOM order of fields, for "scroll to the first problem". */
const FIELD_ORDER = ["photos", "type", "brand", "model", "year", "mileage", "price", "batteryHealth", "chargeCycles", "batteryWh", "motorW", "grade", "frameSize", "wheelSize", "status"];
const STATUS_HELP: Record<Status, string> = {
  available: "Shown on the site with its guide price.",
  reserved: "Shown with a Reserved tag. Stays reserved until you change it.",
  sold: "Price hidden on the site. Drops off the list after 30 days.",
};
const uid = () => Math.random().toString(36).slice(2, 10);
const withId = (p: DraftPhoto): EPhoto => ({ ...p, id: uid() });
const strip = (ps: EPhoto[]): DraftPhoto[] => ps.map(({ id: _id, ...p }) => (void _id, p as DraftPhoto));
const opts = (list: string[], cur: string) => (cur && !list.includes(cur) ? [cur, ...list] : list);
const thisYear = new Date().getFullYear();

function Sel({ id, value, onChange, options, placeholder }: { id?: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div className="in">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <AIcon name="chev" className="chev" />
    </div>
  );
}

export function EditView() {
  const sp = useSearchParams();
  const router = useRouter();
  const qSlug = sp.get("slug");
  const qDraft = sp.get("draft");

  const [all, setAll] = useState<RepoBike[]>([]);
  const [baseSha, setBaseSha] = useState("");
  const [original, setOriginal] = useState<RepoBike | undefined>();
  const [slug, setSlug] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(() => qDraft ?? newDraftId(qSlug ? "edit" : "new"));
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photos, setPhotos] = useState<EPhoto[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [restored, setRestored] = useState<LocalDraft | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const [otherBrand, setOtherBrand] = useState(false);
  const [toast, say] = useToast();
  const pub = usePublish();
  const lastAction = useRef<"publish" | "delete">("publish");
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !slug;

  /* ---------- load ---------- */
  const loadFromRepo = useCallback(
    async (opts: { ignoreLocal?: boolean } = {}) => {
      setLoading(true);
      setLoadErr(null);
      try {
        const r = await loadAll();
        setAll(r.cars);
        let draft: LocalDraft | undefined;
        if (qDraft && !opts.ignoreLocal) draft = await getDraft(qDraft);
        const s = draft?.slug ?? qSlug;
        const car = s ? r.cars.find((c) => c.slug === s) : undefined;
        if (s && !car && !draft) throw new Error(`No listing called “${s}” on main. It may have been deleted.`);
        if (!draft && car && !opts.ignoreLocal) {
          draft = (await listDrafts()).find((d) => d.slug === car.slug && d.origin !== "conflict");
          if (draft) setRestored(draft);
        }
        setOriginal(car);
        setSlug(car ? car.slug : null);
        if (draft) {
          setDraftId(draft.id);
          setForm({ ...emptyForm(), ...(draft.form as Partial<FormState>) });
          setPhotos(draft.photos.map(withId));
          setBaseSha(draft.baseSha ?? r.headSha);
          setSavedAt(draft.savedAt);
          setOtherBrand(false);
        } else if (car) {
          const f = formFromRepo(car);
          setForm(f.form);
          setPhotos(f.photos.map(withId));
          setBaseSha(r.headSha);
          setSavedAt(null);
        } else {
          setBaseSha(r.headSha);
        }
        setDirty(false);
      } catch (e) {
        const c = errorCode(e);
        setLoadErr(
          c === "access_expired"
            ? ACCESS
            : c === "offline"
              ? "You’re offline. Connect and reload."
              : c === "credential_invalid"
                ? "后台写入凭证失效，请联系管理员"
                : (e as Error).message || "Couldn’t load the listing.",
        );
      } finally {
        setLoading(false);
      }
    },
    [qDraft, qSlug],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadFromRepo();
  }, [loadFromRepo]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  /* ---------- validation (same rules as the build) ---------- */
  const data = useMemo(
    () => formToData(form, photos.map((p, i) => ({ src: p.kind === "repo" ? p.src : `/uploads/pre-owned/new-${i}.webp` })), original?.data),
    [form, photos, original],
  );
  const v = useMemo(() => validateBike(data, { requireType: isNew }), [data, isNew]);
  const errs = useMemo(() => {
    const m: Record<string, FieldError> = {};
    for (const e of v.errors) if (!m[e.field]) m[e.field] = e;
    return m;
  }, [v]);
  const err = (f: string) => (tried ? errs[f] : undefined);
  const battWarn = v.warnings.some((w) => w.field === "batteryHealth");

  const focusFirst = () => {
    const first = firstField;
    const el = document.getElementById(`f-${first}`) ?? document.querySelector(".ttl");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el?.querySelector("input, select, button") as HTMLElement | null)?.focus({ preventScroll: true });
    setShake(first ?? null);
    setTimeout(() => setShake(null), 400);
  };

  /* ---------- photos ---------- */
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length - busy.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) say(`Max ${MAX_PHOTOS} photos per listing`);
    const jobs = list.map((f) => ({ id: uid(), name: f.name, origSize: f.size, file: f }));
    setBusy((b) => [...b, ...jobs.map(({ file: _f, ...j }) => (void _f, j))]);
    for (const j of jobs) {
      try {
        const out = await processImage(j.file);
        setPhotos((ps) => [...ps, { id: j.id, kind: "new", blob: out.blob, ext: out.ext, origSize: out.origSize }]);
        setDirty(true);
      } catch (e) {
        say(e instanceof ImageError ? e.message : `Couldn’t read ${j.name}`);
      } finally {
        setBusy((b) => b.filter((x) => x.id !== j.id));
      }
    }
  };
  const drag = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const onGripDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = id;
    setDragId(id);
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-pid]");
    const to = over?.dataset.pid;
    if (!to || to === drag.current) return;
    setPhotos((ps) => {
      const from = ps.findIndex((p) => p.id === drag.current);
      const at = ps.findIndex((p) => p.id === to);
      if (from < 0 || at < 0) return ps;
      const next = [...ps];
      const [m] = next.splice(from, 1);
      next.splice(at, 0, m);
      return next;
    });
    setDirty(true);
  };
  const onGripUp = () => {
    drag.current = null;
    setDragId(null);
  };
  const move = (id: string, d: number) =>
    setPhotos((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const src = (p: EPhoto) => (p.kind === "repo" ? assetUrl(p.src) : blobUrl(p.blob));

  /* ---------- save / publish ---------- */
  const saveLocal = async (origin: LocalDraft["origin"] = "manual", id = draftId) => {
    const d: LocalDraft = {
      id,
      slug,
      baseSha: baseSha || null,
      form: form as unknown as Record<string, unknown>,
      photos: strip(photos),
      savedAt: new Date().toISOString(),
      origin,
    };
    await putDraft(d);
    return d;
  };
  const onSaveDraft = async () => {
    try {
      const d = await saveLocal();
      setSavedAt(d.savedAt);
      setDirty(false);
      say("Saved on this device only");
    } catch {
      say("Couldn’t save on this device (storage full or private mode?)");
    }
  };

  const onPublish = async () => {
    lastAction.current = "publish";
    setTried(true);
    if (busy.length) return say("Wait for photos to finish optimising");
    if (!v.ok) return focusFirst();
    const s = slug ?? uniqueSlug(form, new Set(all.map((c) => c.slug)));
    const { files, data: out, newPhotoPaths } = buildPublish({ slug: s, form, photos: strip(photos), original, all });
    const name = `${out.brand} ${out.model}`;
    const sha = await pub.run(files, `pre-owned: ${original ? "update" : "add"} ${name}`, baseSha, `/pre-owned/${s}/`);
    if (!sha) return;
    await deleteDraft(draftId).catch(() => {});
    let k = 0;
    const next = photos.map((p) => (p.kind === "new" ? { id: p.id, kind: "repo" as const, src: newPhotoPaths[k++], caption: p.caption } : p));
    const body = form.body;
    const car: RepoBike = { slug: s, path: `content/pre-owned/${s}.md`, data: out, body, updatedAt: new Date().toISOString() };
    setPhotos(next);
    setOriginal(car);
    setAll((cs) => [...cs.filter((c) => c.slug !== s), car]);
    setSlug(s);
    setBaseSha(sha);
    setDraftId(newDraftId("edit"));
    setRestored(null);
    setSavedAt(null);
    setDirty(false);
    setTried(false);
    window.history.replaceState(null, "", `/admin/edit/?slug=${encodeURIComponent(s)}`);
  };

  const onDelete = async () => {
    if (!original) {
      await deleteDraft(draftId).catch(() => {});
      setDirty(false);
      router.push("/admin/");
      return;
    }
    lastAction.current = "delete";
    if (!window.confirm(`Delete ${original.data.brand} ${original.data.model} from the website? Its photos are deleted too.`)) return;
    const sha = await pub.run(buildDelete(original, all), `pre-owned: delete ${original.data.brand} ${original.data.model}`, baseSha);
    if (sha) {
      await deleteDraft(draftId).catch(() => {});
      setDirty(false);
      router.push("/admin/");
    }
  };

  const onSaveMine = async () => {
    try {
      await saveLocal("conflict", newDraftId("copy"));
      setDirty(false);
      pub.setState(null);
      router.push("/admin/");
    } catch {
      say("Couldn’t save on this device");
    }
  };
  const onLoadTheirs = async () => {
    pub.setState(null);
    await loadFromRepo({ ignoreLocal: true });
    say("Loaded the latest version from the repo");
  };

  /* ---------- render ---------- */
  const brandOpts = useMemo(
    () => Array.from(new Set([...BRANDS, ...all.map((c) => String(c.data.brand ?? "")).filter(Boolean)])).sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const showOther = otherBrand || (!!form.brand && !brandOpts.includes(form.brand));
  const title = `${form.brand} ${form.model}`.trim() || (isNew ? "New listing" : "Listing");
  const cls = (f: string, extra = "") => `f${err(f) ? " err" : ""}${shake === f ? " shake" : ""}${extra ? " " + extra : ""}`;
  const help = (f: string, hint?: string) =>
    err(f) ? (
      <div className="help">
        <AIcon name="alert" />
        {/^missing required /.test(err(f)!.message) ? "Required to publish" : humanError(err(f)!)}
      </div>
    ) : hint ? (
      <div className="help">{hint}</div>
    ) : null;
  const firstField = [...FIELD_ORDER, ...v.errors.map((e) => e.field)].find((f) => errs[f]);
  const first = tried && firstField ? errs[firstField] : undefined;
  const firstLabel = first
    ? first.field === "price"
      ? "Guide price missing"
      : first.field === "photos"
        ? "Add at least 1 photo"
        : first.field === "type"
          ? "Choose e-bike or e-scooter"
          : humanError(first)
    : null;

  if (loadErr)
    return (
      <div className="adm pg-edit">
        <TopBar back />
        <main className="layout">
          <div className="form">
            {loadErr === ACCESS ? (
              <AccessExpired style={{ marginTop: 24 }} />
            ) : (
            <div className="callout red" style={{ marginTop: 24 }}>
              <AIcon name="alert" />
              <div>
                <b>{loadErr}</b>
                <button className="linkbtn" onClick={() => loadFromRepo()}>
                  Try again
                </button>{" "}
                ·{" "}
                <Link className="linkbtn" href="/admin/">
                  Back to listings
                </Link>
              </div>
            </div>
            )}
          </div>
        </main>
      </div>
    );

  const cover = photos[0];
  const n = photos.length + busy.length;
  return (
    <div className="adm pg-edit">
      <TopBar back />
      <DeployBanner />
      <StatusNotice />
      <main className="layout">
        <div className="form" aria-busy={loading || undefined}>
          {/* Inputs stay locked until the bike has loaded, so loading never wipes what someone typed. */}
          <fieldset disabled={loading} className="contents">
          <div className="ttl">
            <div className="eyebrow">
              {loading && qSlug ? (
                <>
                  Editing · <span className="slug">/pre-owned/{qSlug}/</span>
                </>
              ) : isNew ? (
                "New listing · not published"
              ) : (
                <>
                  Editing · <span className="slug">/pre-owned/{slug}/</span>
                </>
              )}
            </div>
            <h1>{loading ? "Loading…" : title}</h1>
            <p>
              <i />
              {loading
                ? "Fetching the latest version…"
                : savedAt
                ? `Saved on this device ${new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${isNew ? "not on the site yet" : "changes not published"}`
                : isNew
                  ? "Not on the site yet"
                  : "Same as the live listing"}
            </p>
          </div>
          {restored && (
            <div className="callout amber">
              <AIcon name="alert" />
              <div>
                <b>Restored your unpublished changes from this device</b>
                Saved {new Date(restored.savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.{" "}
                <button
                  className="linkbtn"
                  onClick={async () => {
                    await deleteDraft(restored.id).catch(() => {});
                    setRestored(null);
                    loadFromRepo({ ignoreLocal: true });
                  }}
                >
                  Discard and load the live version
                </button>
              </div>
            </div>
          )}

          <section className="sec" id="f-photos">
            <div className="sh">
              <h2>Photos</h2>
              <small>
                {n} of {MAX_PHOTOS} · first is the cover
              </small>
            </div>
            <p className="hint">Drag ⠿ to reorder. Suggested shots:</p>
            <div className="shots">
              {SHOTS.map((s, k) => (
                <span key={s} className={k < photos.length ? "got" : ""}>
                  {k < photos.length ? <AIcon name="check" /> : <i>{k + 1}</i>}
                  {s}
                </span>
              ))}
            </div>
            <div className={`photos${err("photos") ? " err" : ""}${shake === "photos" ? " shake" : ""}`}>
              {photos.map((p, i) => (
                <div key={p.id} data-pid={p.id} className={`tile${i === 0 ? " cover" : ""}${dragId === p.id ? " dragging" : ""}`}>
                  <div className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src(p)} alt={`Photo ${i + 1}`} draggable={false} />
                  </div>
                  <span className="cv">Cover</span>
                  <span className="n">{i + 1}</span>
                  <button type="button" className="rm" aria-label={`Remove photo ${i + 1}`} onClick={() => (setPhotos((ps) => ps.filter((x) => x.id !== p.id)), setDirty(true))}>
                    <span>
                      <AIcon name="x" />
                    </span>
                  </button>
                  <span
                    className="gr"
                    role="button"
                    tabIndex={0}
                    aria-label={`Move photo ${i + 1} (arrow keys)`}
                    onPointerDown={(e) => onGripDown(e, p.id)}
                    onPointerMove={onGripMove}
                    onPointerUp={onGripUp}
                    onPointerCancel={onGripUp}
                    onKeyDown={(e) => {
                      const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
                      if (d) {
                        e.preventDefault();
                        move(p.id, d);
                      }
                    }}
                  >
                    <AIcon name="grip" />
                  </span>
                </div>
              ))}
              {busy.map((b) => (
                <div key={b.id} className="tile up">
                  <div className="ph" />
                  <span className="opt">
                    Optimising<small>{mb(b.origSize)} → ≤ 1 MB</small>
                  </span>
                  <span className="bar">
                    <i className="indet" />
                  </span>
                </div>
              ))}
              {n < MAX_PHOTOS && (
                <button type="button" className="add" onClick={() => fileRef.current?.click()}>
                  <b>+</b>Add photos<small>Camera or library</small>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {err("photos") && (
              <p className="privacy bad">
                <AIcon name="alert" />
                {errs.photos.field === "photos" && photos.length === 0 ? "Add at least 1 photo to publish." : errs.photos.message}
              </p>
            )}
            <p className="privacy">
              <AIcon name="check" />
              Photos are converted to WebP under 1 MB on this device. Location and camera data are removed before upload.
            </p>
          </section>

          <section className="sec">
            <div className="sh">
              <h2>Essentials</h2>
              <small>Required to publish</small>
            </div>
            <div className={cls("type")} id="f-type">
              <div className="lab">Type</div>
              <div className="mseg tseg" role="group" aria-label="Type">
                {TYPES.map((t) => (
                  <button type="button" key={t} aria-pressed={form.type === t} onClick={() => set("type", t)}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              {help("type")}
            </div>
            <div className="grid2">
              <div className={cls("brand")} id="f-brand">
                <label htmlFor="brand">Brand</label>
                <Sel
                  id="brand"
                  value={showOther ? "__other" : form.brand}
                  placeholder="Choose…"
                  options={[...brandOpts, "__other"]}
                  onChange={(x) => {
                    if (x === "__other") {
                      setOtherBrand(true);
                      set("brand", "");
                    } else {
                      setOtherBrand(false);
                      set("brand", x);
                    }
                  }}
                />
                {showOther && (
                  <div className="in" style={{ marginTop: 8 }}>
                    <input aria-label="Brand name" placeholder="Brand name" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                  </div>
                )}
                {help("brand")}
              </div>
              <div className={cls("model")} id="f-model">
                <label htmlFor="model">Model</label>
                <div className="in">
                  <input id="model" value={form.model} onChange={(e) => set("model", e.target.value)} />
                </div>
                {help("model")}
              </div>
            </div>
            <div className="grid2">
              <div className={cls("year")} id="f-year">
                <label htmlFor="year">Year</label>
                <Sel
                  id="year"
                  value={form.year}
                  placeholder="Choose…"
                  onChange={(x) => set("year", x)}
                  options={opts(Array.from({ length: 12 }, (_, k) => String(thisYear - k)), form.year)}
                />
                {help("year")}
              </div>
              <div className={cls("mileage")} id="f-mileage">
                <label htmlFor="mileage">Odometer</label>
                <div className="in">
                  <input id="mileage" inputMode="numeric" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} />
                  <span className="suf">mi</span>
                </div>
                {help("mileage")}
              </div>
            </div>
            <div className={cls("price")} id="f-price">
              <label htmlFor="price">Guide price</label>
              <div className="in">
                <span className="pre">£</span>
                <input id="price" inputMode="numeric" placeholder="0" value={form.price} aria-invalid={!!err("price")} onChange={(e) => set("price", e.target.value)} />
              </div>
              {err("price") ? (
                <div className="help">
                  <AIcon name="alert" />
                  {errs.price.message.startsWith("missing") ? "Add a guide price to publish. You can still save a draft." : errs.price.message}
                </div>
              ) : null}
            </div>
          </section>

          <section className="sec">
            <div className="sh">
              <h2>Battery</h2>
              <small>Strongly recommended</small>
            </div>
            <div className={`f${battWarn ? " warn" : ""}${err("batteryHealth") || err("chargeCycles") ? " err" : ""}`} id={form.batteryMode === "health" ? "f-batteryHealth" : "f-chargeCycles"}>
              <div className="mseg">
                <button type="button" aria-pressed={form.batteryMode === "health"} onClick={() => set("batteryMode", "health")}>
                  Health %
                </button>
                <button type="button" aria-pressed={form.batteryMode === "cycles"} onClick={() => set("batteryMode", "cycles")}>
                  Charge cycles
                </button>
              </div>
              <div className="grid2">
                <div>
                  <label htmlFor="batt" className="sublab">
                    {form.batteryMode === "health" ? "Battery health" : "Charge cycles"}
                  </label>
                  <div className="in">
                    {form.batteryMode === "health" ? (
                      <input id="batt" inputMode="numeric" placeholder="e.g. 92" value={form.batteryHealth} onChange={(e) => set("batteryHealth", e.target.value)} />
                    ) : (
                      <input id="batt" inputMode="numeric" placeholder="e.g. 140" value={form.chargeCycles} onChange={(e) => set("chargeCycles", e.target.value)} />
                    )}
                    <span className="suf">{form.batteryMode === "health" ? "%" : "cycles"}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="bsrc" className="sublab">
                    Reading from
                  </label>
                  <Sel id="bsrc" value={form.batterySource} placeholder="Choose…" onChange={(x) => set("batterySource", x)} options={opts(SOURCES, form.batterySource)} />
                </div>
              </div>
              {err("batteryHealth") || err("chargeCycles") ? (
                <div className="help">
                  <AIcon name="alert" />
                  {(err("batteryHealth") ?? err("chargeCycles"))!.message}
                </div>
              ) : battWarn ? (
                <div className="help">
                  <AIcon name="alert" />
                  Buyers check this first. Publishing without it is allowed.
                </div>
              ) : null}
            </div>
            <div className="grid2">
              <div className={cls("batteryWh")} id="f-batteryWh">
                <label htmlFor="wh">
                  Capacity<small>Optional</small>
                </label>
                <div className="in">
                  <input id="wh" inputMode="numeric" value={form.batteryWh} onChange={(e) => set("batteryWh", e.target.value)} />
                  <span className="suf">Wh</span>
                </div>
                {help("batteryWh")}
              </div>
              <div className={cls("motorW")} id="f-motorW">
                <label htmlFor="mw">
                  Motor<small>Optional</small>
                </label>
                <div className="in">
                  <input id="mw" inputMode="numeric" value={form.motorW} onChange={(e) => set("motorW", e.target.value)} />
                  <span className="suf">W</span>
                </div>
                {help("motorW")}
              </div>
            </div>
          </section>

          <section className="sec">
            <div className="sh">
              <h2>Condition &amp; specs</h2>
              <small>Optional</small>
            </div>
            <div className="f" id="f-grade">
              <div className="lab">Condition grade</div>
              <div className="grade">
                {GRADES.map((g) => (
                  <button type="button" key={g} aria-pressed={form.grade === g} onClick={() => set("grade", form.grade === g ? "" : g)}>
                    <b>{g}</b>
                    <span>{GRADE_WORD[g]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <div className="f" id="f-frameSize">
                <label htmlFor="frame">Frame size</label>
                <Sel id="frame" value={form.frameSize} placeholder="—" onChange={(x) => set("frameSize", x)} options={opts(FRAMES, form.frameSize)} />
              </div>
              <div className="f" id="f-wheelSize">
                <label htmlFor="wheel">Wheel size</label>
                <Sel id="wheel" value={form.wheelSize} placeholder="—" onChange={(x) => set("wheelSize", x)} options={opts(WHEELS, form.wheelSize)} />
              </div>
            </div>
            <div className="f">
              <div className="lab">
                Inspection<small>Pass · Replaced · Note</small>
              </div>
              <div className="notes">
                {form.inspection.map((r, i) => {
                  const need = r.result !== "pass" && !r.text.trim();
                  const upd = (patch: Partial<typeof r>) => set("inspection", form.inspection.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                  return (
                    <div className="note" key={i}>
                      <div className="in item">
                        <input aria-label="Item" value={r.item} placeholder="Item, e.g. Tyres" onChange={(e) => upd({ item: e.target.value })} />
                      </div>
                      <div className="seg">
                        {(["pass", "replaced", "note"] as const).map((x) => (
                          <button type="button" key={x} data-v={x} aria-pressed={r.result === x} onClick={() => upd({ result: x })}>
                            {x === "pass" ? "Pass" : x === "replaced" ? "Replaced" : "Note"}
                          </button>
                        ))}
                      </div>
                      <div className={`txt${need ? " need" : ""}`}>
                        <div className="in">
                          <input
                            aria-label="Detail"
                            value={r.text}
                            placeholder={r.result === "pass" ? "Detail (optional)" : "What was done or found"}
                            onChange={(e) => upd({ text: e.target.value })}
                          />
                        </div>
                        {need && <small>Add a detail for Replaced or Note</small>}
                      </div>
                      <button type="button" className="del" aria-label="Remove check" onClick={() => set("inspection", form.inspection.filter((_, k) => k !== i))}>
                        <AIcon name="x" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="addrow" onClick={() => set("inspection", [...form.inspection, { item: "", result: "pass", text: "" }])}>
                + Add check
              </button>
            </div>
            <div className="f">
              <div className="lab">
                What&apos;s included<small>Tap: included → not included → off</small>
              </div>
              <div className="chips">
                {form.included.map((c, i) => (
                  <button
                    type="button"
                    key={`${c.item}-${i}`}
                    aria-pressed={c.state === "yes"}
                    className={c.state === "no" ? "no" : ""}
                    title={c.state === "yes" ? "Included" : c.state === "no" ? "Shown as not included" : "Not shown"}
                    onClick={() => {
                      const nextState: IncludedRow["state"] = c.state === "off" ? "yes" : c.state === "yes" ? "no" : "off";
                      if (nextState === "off" && !INCLUDED_PRESETS.includes(c.item)) set("included", form.included.filter((_, k) => k !== i));
                      else set("included", form.included.map((x, k) => (k === i ? { ...x, state: nextState } : x)));
                    }}
                  >
                    {c.state === "yes" ? <AIcon name="check" /> : c.state === "no" ? <AIcon name="x" className="show" /> : null}
                    {c.item}
                  </button>
                ))}
                <button
                  type="button"
                  className="addc"
                  onClick={() => {
                    const item = window.prompt("Item name, e.g. Phone holder")?.trim();
                    if (item) set("included", [...form.included, { item, state: "yes" }]);
                  }}
                >
                  + Other item
                </button>
              </div>
            </div>
            <div className="f">
              <label htmlFor="desc">
                Description<small className={form.body.length > 600 ? "over" : ""}>{form.body.length} / 600</small>
              </label>
              <div className="in ta">
                <textarea id="desc" value={form.body} onChange={(e) => set("body", e.target.value)} />
              </div>
              <div className="help">Markdown allowed (**bold**, lists). Don’t include frame numbers or personal details: the repo is public.</div>
            </div>
          </section>

          <section className="sec" id="f-status">
            <div className="sh">
              <h2>Status</h2>
            </div>
            <div className="seg stseg">
              {STATUSES.map((s) => (
                <button type="button" key={s} data-v={s} aria-pressed={form.status === s} onClick={() => set("status", s)}>
                  <i />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="hint">{STATUS_HELP[form.status]} Drafts are kept on this device only, never in the repo.</p>
            <button type="button" className="danger" onClick={onDelete}>
              {original ? "Delete listing from the website" : "Discard this draft"}
            </button>
          </section>
          </fieldset>
        </div>

        <aside className="prev">
          <div className="eyebrow">Preview on site</div>
          <div className="pc">
            <div className="ph">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover && <img src={src(cover)} alt="" />}
            </div>
            <div className="b">
              <div className="eyebrow e">
                {form.type ? `${TYPE_LABEL[form.type]} · ` : ""}
                {form.brand || "Brand"} · {form.year || "Year"}
              </div>
              <h3>{form.model || "Model"}</h3>
              <div className="s">
                <span>{form.mileage ? `${Number(form.mileage).toLocaleString("en-GB")} mi` : "— mi"}</span>
                <span className={battWarn ? "warn" : ""}>
                  {form.batteryHealth ? `Battery ${form.batteryHealth}%` : form.chargeCycles ? `${form.chargeCycles} cycles` : "Battery —"}
                </span>
                <span>{form.grade ? `Grade ${form.grade}` : "Grade —"}</span>
              </div>
              {form.status === "sold" ? (
                <span className="noprice" style={{ color: "var(--ink-2)" }}>
                  Sold · price hidden
                </span>
              ) : Number(form.price) > 0 ? (
                <strong>{money(Number(form.price))}</strong>
              ) : (
                <span className="noprice">Guide price missing</span>
              )}
            </div>
          </div>
          <p className="help">Updates as you type.</p>
        </aside>

        <div className="save">
          <div className="in2">
            <div>
              <div className="msg">
                {!loading && firstLabel ? (
                  <a
                    className="e"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      focusFirst();
                    }}
                  >
                    <AIcon name="alert" />
                    {firstLabel}
                    {v.errors.length > 1 ? ` (+${v.errors.length - 1})` : ""}
                  </a>
                ) : (
                  <span />
                )}
                {!loading && battWarn && (
                  <span className="w">
                    <AIcon name="info" />
                    Battery recommended
                  </span>
                )}
              </div>
              <div className="note2">
                Publish updates the website · <span className="nw">live in ~1–2 min.</span> Drafts stay on this device.
              </div>
            </div>
            <div className="btns">
              <button type="button" className="btn" onClick={onSaveDraft} disabled={loading}>
                Save draft
              </button>
              <button type="button" className="btn pub" onClick={onPublish} disabled={loading}>
                Publish
              </button>
            </div>
          </div>
        </div>
      </main>
      {toast}
      <PublishSheet
        state={pub.state}
        onClose={() => pub.setState(null)}
        onRetry={() => {
          pub.setState(null);
          if (lastAction.current === "delete") onDelete();
          else onPublish();
        }}
        onLoadTheirs={onLoadTheirs}
        onSaveMine={onSaveMine}
        onSaveDraft={() => {
          pub.setState(null);
          onSaveDraft();
        }}
      />
    </div>
  );
}
