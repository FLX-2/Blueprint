import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { TrainingLogSetting } from "@/components/train/training-settings";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { athlete, sessions } from "@/data/seed";

export const metadata: Metadata = { title: "Settings" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0">
      <span className="text-base font-medium">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader trail="Settings" title="Settings" meta={`Demo athlete: ${athlete.name}`} />

      <Card className="max-w-[720px]">
        <CardHeader title="Appearance" />
        <Row label="Theme">
          <ThemeSwitcher />
        </Row>
      </Card>

      <Card className="max-w-[720px]">
        <CardHeader title="Loading" meta="Used for rounding every target weight" />
        <Row label="Units">
          <span className="num text-base">{athlete.unit}</span>
        </Row>
        <Row label="Bar">
          <span className="num text-base">{athlete.barWeight} lb</span>
        </Row>
        <Row label="Smallest jump">
          <span className="num text-base">{athlete.smallestPlatePair} lb</span>
        </Row>
      </Card>

      <Card className="max-w-[720px]">
        <CardHeader title="Training data" meta={`Sample: ${sessions.length} sessions`} />
        <TrainingLogSetting />
        <Row label="Import from Strong, Hevy or a CSV">
          <a href="/review/data" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Import history
          </a>
        </Row>
        <Row label="Sample history as a Strong-style CSV">
          <a href="/demo/strong-export.csv" download className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Download CSV
          </a>
        </Row>
      </Card>
    </>
  );
}
