import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Mono, uppercase section label. */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("font-mono text-xs uppercase tracking-[0.08em] text-muted", className)}
      {...props}
    />
  );
}

/** Every number in the app: mono with tabular figures. */
export function Num({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("num", className)} {...props} />;
}

/** Text the AI produced that the user hasn't confirmed yet. */
export function AiMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ai-mark", className)} {...props} />;
}

/** The AI's reasoning: always italic serif. */
export function Reasoning({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ai-reasoning m-0", className)} {...props} />;
}

/** How sure the AI is, e.g. "72% sure". */
export function Confidence({ value }: { value: number }) {
  return <span className="font-mono text-xs text-ai-text">{Math.round(value * 100)}% sure</span>;
}

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "confirmed" | "ai";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 font-mono text-xs",
        tone === "neutral" && "bg-surface-raised text-fg-secondary",
        tone === "confirmed" && "border border-border-strong text-fg",
        tone === "ai" && "border-[1.5px] border-dashed border-ai bg-ai-wash text-ai-text",
      )}
    >
      {children}
    </span>
  );
}
