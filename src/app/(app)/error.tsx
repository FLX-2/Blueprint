"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";

/** A screen in the app shell crashed. The shell (nav, Ask bar) stays usable, and nothing saved is touched. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card role="alert" className="flex max-w-[640px] flex-col gap-4 p-6">
      <Eyebrow>Something broke</Eyebrow>
      <h1 className="m-0 font-display text-3xl font-medium tracking-[-0.01em]">This screen hit an error.</h1>
      <p className="m-0 text-base text-fg-secondary">
        Your program, logged sessions and history are saved on this device and weren’t changed. Try again, or use the tabs to go somewhere else.
      </p>
      <div>
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
