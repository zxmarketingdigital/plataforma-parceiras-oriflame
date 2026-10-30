"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatCopy } from "./types";
import styles from "./DiagnosticChat.module.css";

interface PdfStatusProps {
  id: string;
  token: string;
  initialStatus?: string;
  copy: ChatCopy["result"];
}

const POLL_DELAYS = [2_000, 4_000, 8_000, 15_000] as const;

export function PdfStatus({ id, token, initialStatus, copy }: PdfStatusProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    let attempt = 0;
    let ready = false;
    let controller: AbortController | null = null;

    const clearObjectUrl = () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };

    const schedule = (delay: number) => {
      if (!mounted) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (!mounted || document.visibilityState !== "visible" || !navigator.onLine) {
        schedule(POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)]);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const parameters = new URLSearchParams({ token });
        const response = await fetch(`/api/diagnostico/${encodeURIComponent(id)}/pdf?${parameters.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!mounted) return;
        if (response.ok) {
          const blob = await response.blob();
          clearObjectUrl();
          const nextUrl = URL.createObjectURL(blob);
          urlRef.current = nextUrl;
          ready = true;
          setDownloadUrl(nextUrl);
          return;
        }
        if (response.status === 401 || response.status === 403) return;
        attempt += response.status === 429 ? 2 : 1;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
        attempt += 1;
      }
      schedule(POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)]);
    };

    const resume = () => {
      if (document.visibilityState === "visible" && navigator.onLine && !ready) schedule(0);
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    schedule(initialStatus === "ready" ? 0 : POLL_DELAYS[0]);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      clearObjectUrl();
    };
  }, [id, initialStatus, token]);

  if (downloadUrl) {
    return <a className={styles.primaryButton} href={downloadUrl} download>{copy.pdf_download}</a>;
  }
  return <p className={styles.pdfPending} aria-live="polite">{copy.pdf_pending}</p>;
}
