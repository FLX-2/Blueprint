"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { routeIntent } from "@/lib/ask/route-intent";

const STARTERS = ["Why did my bench stall?", "How has my squat changed?", "Traveling this week, hotel gym only"];

/**
 * Phones get Ask as a round button above the tab bar (docs/02: "Floating Ask
 * button above the tab bar") instead of a second header row. It opens a
 * bottom sheet. A native <dialog> handles focus, Escape and the inert page
 * behind it, and returns focus to the button when it closes.
 */
export function PhoneAsk() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");

  const close = () => dialogRef.current?.close();
  const go = (q: string) => {
    close();
    setText("");
    router.push(routeIntent(q).href);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Ask, or say what changed"
        aria-haspopup="dialog"
        onClick={() => {
          dialogRef.current?.showModal();
          inputRef.current?.focus();
        }}
        className="phone-ask fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full border border-border bg-surface-raised text-fg shadow-popover transition active:scale-95 md:hidden"
      >
        <SearchIcon width={22} height={22} />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="phone-ask-title"
        onClick={(e) => {
          // A tap on the backdrop (the dialog box itself, outside the panel) closes it.
          if (e.target === e.currentTarget) close();
        }}
        className="sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl border border-b-0 border-border bg-surface p-0 text-fg backdrop:bg-black/60 md:hidden"
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <span className="mx-auto h-1 w-10 rounded-full bg-border-input" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 id="phone-ask-title" className="m-0 text-md font-semibold">
              Ask, or say what changed
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="flex size-9 items-center justify-center rounded-sm text-muted hover:text-fg">
              <CloseIcon width={18} height={18} />
            </button>
          </div>
          <form
            className="field flex h-12 items-center gap-2.5 rounded-md border border-border-input bg-bg px-3.5 text-muted"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) go(text.trim());
            }}
          >
            <SearchIcon width={18} height={18} />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Ask about your training, or say what changed"
              placeholder="Why did my bench stall?"
              enterKeyHint="go"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-muted"
            />
          </form>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Try">
            {STARTERS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => go(s)} className="rounded-full border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-raised hover:text-fg">
                  {s}
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-muted">Questions go to Ask; changes like travel or less time go to Bend the week.</p>
        </div>
      </dialog>
    </>
  );
}
