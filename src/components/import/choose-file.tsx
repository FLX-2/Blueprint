"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const MAX_BYTES = 20 * 1024 * 1024;

export function ChooseFile({
  onLoaded,
  error,
}: {
  onLoaded: (fileName: string, text: string) => void;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setLocalError("That file is over 20 MB. Export a shorter date range and try again.");
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      onLoaded(file.name, await file.text());
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch("/demo/strong-export.csv");
      if (!res.ok) throw new Error(String(res.status));
      onLoaded("strong-export.csv (sample)", await res.text());
    } catch {
      setLocalError("Couldn’t load the sample export.");
    } finally {
      setBusy(false);
    }
  }

  const message = localError ?? error;

  return (
    <Card className="flex flex-col gap-5 p-6">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          read(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-[1.5px] border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging ? "border-accent bg-surface-raised" : "border-border hover:border-border-strong",
        )}
      >
        <Eyebrow>CSV · Strong, Hevy or any app</Eyebrow>
        <span className="font-display text-3xl font-medium tracking-[-0.01em]">
          Drop your export here, <span className="font-normal italic">or choose a file</span>
        </span>
        <span className="max-w-[520px] text-md text-fg-secondary">
          The file is read in your browser and never uploaded. Only exercise names are sent to the AI, to match them to the
          library.
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(e) => read(e.target.files?.[0])}
        />
      </label>

      {message ? (
        <p role="alert" className="m-0 rounded-md border border-danger bg-danger-wash px-4 py-3 text-base text-fg">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">No export handy? Try the sample athlete’s 18 months of Strong data.</span>
        <Button variant="secondary" onClick={useSample} disabled={busy}>
          Use the sample export
        </Button>
      </div>
    </Card>
  );
}
