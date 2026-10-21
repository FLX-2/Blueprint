import type { Metadata } from "next";
import { ArrowRightIcon, PlanIcon, ReviewIcon, TrainIcon } from "@/components/icons";
import { StartLink } from "@/components/onboarding/start-link";
import { Eyebrow } from "@/components/ui/text";

export const metadata: Metadata = { title: "Welcome" };

const DOORS = [
  {
    href: "/plan/import",
    title: "I have a program",
    body: "Paste it from a post, PDF or spreadsheet. You check what the AI read, and the rules run themselves.",
    time: "About 3 minutes",
  },
  {
    href: "/review/data",
    title: "I have training history",
    body: "Bring a Strong or Hevy export, clean up exercise names, then ask it anything.",
    time: "About 2 minutes",
  },
  {
    href: "/plan",
    title: "Show me with sample data",
    body: "Explore every screen as a sample lifter with 18 months of history. You can switch to your own at any time.",
    time: "Start right away",
  },
] as const;

const MODES = [
  { icon: PlanIcon, name: "Plan", body: "Your program and the rules that move your weights." },
  { icon: TrainIcon, name: "Train", body: "Today’s session, logged set by set, even offline." },
  { icon: ReviewIcon, name: "Review", body: "Your history, and answers to questions about it." },
] as const;

export default function WelcomePage() {
  return (
    <main className="bg-drafting flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[960px] flex-col gap-12">
        <div className="enter-up flex flex-col gap-4">
          <Eyebrow>Blueprint</Eyebrow>
          <h1 className="m-0 max-w-[720px] font-display text-5xl font-medium tracking-[-0.02em] text-balance">
            Paste any strength program, and it <span className="font-normal italic">runs itself.</span>
          </h1>
          <p className="m-0 max-w-[560px] text-lg text-fg-secondary">
            AI reads the fuzzy parts. Code does the exact parts: every target weight is calculated, never guessed. Where do you want to start?
          </p>
        </div>

        <ul className="m-0 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {DOORS.map((door, i) => (
            <li key={door.href} className="enter-up" style={{ "--i": i + 1 } as React.CSSProperties}>
              <StartLink
                href={door.href}
                className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 text-fg no-underline transition duration-200 ease-standard hover:-translate-y-0.5 hover:border-border-strong"
              >
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <span className="text-xl font-semibold">{door.title}</span>
                <span className="text-md text-fg-secondary">{door.body}</span>
                <span className="mt-auto flex items-center justify-between pt-3 text-sm text-muted">
                  {door.time}
                  <ArrowRightIcon className="text-fg transition-transform duration-200 ease-standard group-hover:translate-x-1" />
                </span>
              </StartLink>
            </li>
          ))}
        </ul>

        <div className="enter-up flex flex-col gap-4 border-t border-border pt-8" style={{ "--i": 4 } as React.CSSProperties}>
          <Eyebrow>Three places, one app</Eyebrow>
          <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-3">
            {MODES.map(({ icon: Icon, name, body }) => (
              <li key={name} className="flex gap-3">
                <Icon className="mt-0.5 shrink-0 text-muted" />
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{name}</span>
                  <span className="text-sm text-fg-secondary">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
