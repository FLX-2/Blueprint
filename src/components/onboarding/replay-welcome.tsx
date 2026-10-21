"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resetOnboarding } from "@/lib/onboarding";

/** Brings back the welcome screen and the Getting started checklist (handy for demos). */
export function ReplayWelcome() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        resetOnboarding();
        router.push("/welcome");
      }}
    >
      Show them again
    </Button>
  );
}
