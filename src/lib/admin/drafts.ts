/**
 * Admin drafts live ONLY in this browser (IndexedDB). They are never committed:
 * the repo is public, so a committed draft would expose prices and notes.
 */
export type DraftPhoto =
  | { kind: "repo"; src: string; caption?: string }
  | { kind: "new"; blob: Blob; ext: string; caption?: string; origSize?: number };

export type DraftForm = Record<string, unknown>;

export type LocalDraft = {
  id: string;
  /** Slug of the repo listing this edits (null = new listing). */
  slug: string | null;
  /** headSha the edit started from. */
  baseSha: string | null;
  form: DraftForm;
  photos: DraftPhoto[];
  savedAt: string;
  /** "conflict" = saved from the conflict sheet ("Save mine as draft"). */
  origin?: "manual" | "conflict" | "auto";
};

const DB = "uksev-admin";
const STORE = "drafts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => reject(t.error);
  });
}

export const listDrafts = () => tx<LocalDraft[]>("readonly", (s) => s.getAll() as IDBRequest<LocalDraft[]>);
export const getDraft = (id: string) => tx<LocalDraft | undefined>("readonly", (s) => s.get(id) as IDBRequest<LocalDraft | undefined>);
export const putDraft = (d: LocalDraft) => tx("readwrite", (s) => s.put(d));
export const deleteDraft = (id: string) => tx("readwrite", (s) => s.delete(id));

export const newDraftId = (prefix = "new") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
