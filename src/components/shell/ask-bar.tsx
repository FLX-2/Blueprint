"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SearchIcon } from "@/components/icons";

/**
 * The one input for questions, plan changes and navigation (⌘K / Ctrl+K).
 * For now every question goes to Ask; routing plan changes to Bend the week
 * (F3) and navigation requests to pages comes later.
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
        router.push(q ? `/review/ask?q=${encodeURIComponent(q)}` : "/review/ask");
        if (inputRef.current) inputRef.current.value = "";
      }}
    >
      <SearchIcon width={16} height={16} />
      <input
        ref={inputRef}
        name="q"
        aria-label="Ask about your training"
        placeholder="Ask about your training…"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
      />
      <kbd className="hidden rounded-xs border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">⌘K</kbd>
    </form>
  );
}
