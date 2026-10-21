"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SearchIcon } from "@/components/icons";
import { routeIntent } from "@/lib/ask/route-intent";

/**
 * The one input for questions and plan changes (⌘K / Ctrl+K). Plan changes
 * ("traveling, hotel gym only") go to Bend the week; everything else to Ask.
 */
export function AskBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      className="flex h-10 min-w-0 flex-[1_1_240px] items-center gap-2.5 rounded-md border border-border bg-bg px-3.5 text-muted focus-within:border-focus"
      onSubmit={(event) => {
        event.preventDefault();
        const q = inputRef.current?.value.trim() ?? "";
        router.push(routeIntent(q).href);
        if (inputRef.current) inputRef.current.value = "";
      }}
    >
      <SearchIcon width={16} height={16} />
      <input
        ref={inputRef}
        name="q"
        aria-label="Ask about your training, or say what changed"
        placeholder="Ask, or say what changed…"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
      />
      <kbd className="hidden rounded-xs border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">⌘K</kbd>
    </form>
  );
}
