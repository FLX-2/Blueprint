import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";

/** Placeholder for a flow that is designed but not built yet. */
export function ComingSoon({
  phase,
  title,
  children,
  back,
}: {
  phase: string;
  title: string;
  children: ReactNode;
  back: { href: string; label: string };
}) {
  return (
    <Card className="flex max-w-[640px] flex-col gap-4 p-6">
      <Eyebrow>{phase}</Eyebrow>
      <h2 className="m-0 font-display text-3xl font-medium tracking-[-0.01em]">{title}</h2>
      <div className="text-md text-fg-secondary">{children}</div>
      <div>
        <Link href={back.href} className={buttonClasses({ variant: "secondary" })}>
          {back.label}
        </Link>
      </div>
    </Card>
  );
}
