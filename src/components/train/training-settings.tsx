"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logStore, resetTraining } from "@/lib/train/store";

/** Settings row: how many sessions are logged on this device, and a way to start over. */
export function TrainingLogSetting() {
  const log = logStore.useValue();
  const [confirming, setConfirming] = useState(false);
  const count = log.status === "ready" ? log.value.length : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0">
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-medium">Sessions logged on this device</span>
        <span className="text-sm text-muted">{count === null ? "Loading…" : `${count} logged. Clearing also resets progress for every program.`}</span>
      </span>
      {confirming ? (
        <span className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="border-danger text-danger"
            onClick={async () => {
              await resetTraining();
              setConfirming(false);
            }}
          >
            Clear everything
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <Button variant="secondary" size="sm" disabled={!count} onClick={() => setConfirming(true)}>
          Clear log
        </Button>
      )}
    </div>
  );
}
