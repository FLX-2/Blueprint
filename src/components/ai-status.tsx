"use client";

import { createContext, useContext, type ReactNode } from "react";

const AiStatus = createContext(true);

export const LIVE_AI_OFF = "Live AI is turned off on this public demo, so your own text can’t be read here.";

/** Provided by the root layout from the server's settings (see src/lib/ai/status.ts). */
export function AiStatusProvider({ live, children }: { live: boolean; children: ReactNode }) {
  return <AiStatus.Provider value={live}>{children}</AiStatus.Provider>;
}

/** False on the public demo: AI features show their scripted examples instead of calling the API. */
export function useLiveAi() {
  return useContext(AiStatus);
}
