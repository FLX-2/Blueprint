"use client";

import { useEffect } from "react";

const isAbortedTransition = (reason: unknown) =>
  reason instanceof DOMException && reason.name === "InvalidStateError" && /transition was aborted/i.test(reason.message);

/**
 * A page change in a background tab can't animate, so the browser aborts the
 * view transition with an InvalidStateError. The page itself updates fine;
 * this keeps that expected abort from surfacing as an error.
 */
export function ViewTransitionGuard() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isAbortedTransition(e.reason)) e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (isAbortedTransition(e.error)) e.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
