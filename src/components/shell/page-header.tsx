import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/text";

export function PageHeader({
  trail,
  title,
  meta,
  actions,
}: {
  /** Breadcrumb, e.g. "Plan / Import / Review". */
  trail: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Eyebrow>{trail}</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-medium tracking-[-0.02em]">{title}</h1>
          {meta ? <div className="font-mono text-sm text-muted">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
