"use client";
import { useCallback, useState } from "react";
import { errorCode, publish, type AdminApiError, type PublishFile } from "@/lib/admin/api";
import { recordPublish } from "@/lib/admin/deploy";
import type { RunState } from "./PublishSheet";

/** Runs one publish and turns onProgress / errors into sheet state. */
export function usePublish() {
  const [state, setState] = useState<RunState | null>(null);
  const run = useCallback(
    async (files: PublishFile[], message: string, baseSha: string, viewHref?: string): Promise<string | null> => {
      const photos = files.filter((f) => f.content instanceof Blob).length;
      const total = photos; // "blobs" counts images uploaded via /admin-api/blob
      let retried = false;
      setState({ phase: "running", p: { stage: "blobs", done: 0, total }, retried, photos, blobTotal: total });
      try {
        const { commitSha } = await publish(files, message, {
          baseSha,
          onProgress: (p) => {
            if (p.stage === "retry") retried = true;
            if (p.stage !== "done") setState({ phase: "running", p, retried, photos, blobTotal: total });
          },
        });
        recordPublish(commitSha);
        setState({ phase: "done", commitSha, viewHref, blobTotal: total });
        return commitSha;
      } catch (e) {
        console.error("[admin] publish failed", e);
        setState({
          phase: "error",
          code: errorCode(e),
          details: (e as AdminApiError).details,
          message: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    },
    [],
  );
  return { state, setState, run };
}
