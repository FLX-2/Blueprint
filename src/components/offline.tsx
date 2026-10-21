"use client";

import { useOffline } from "next/offline";
import { useEffect } from "react";

/** Registers the service worker in production builds; clears any stale one in development. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    } else {
      // A cached production worker would serve stale pages over the dev server.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
  }, []);
  return null;
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="border-b border-border bg-surface-raised px-4 py-2 text-center text-sm text-fg-secondary">
      You’re offline. Gym mode and your data still work on this device; the AI features need a connection.
    </div>
  );
}
