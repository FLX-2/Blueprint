import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { Eyebrow } from "@/components/ui/text";

export const metadata: Metadata = { title: "Welcome" };

const DOORS = [
  { href: "/plan/import", title: "I have a program", body: "Paste it, check what was read, and it runs itself." },
  { href: "/review", title: "I have training history", body: "Bring a Strong or Hevy export and ask it anything." },
  { href: "/plan", title: "Show me with sample data", body: "Explore every screen as a sample athlete. No sign-up." },
] as const;

export default function WelcomePage() {
  return (
    <main className="bg-drafting flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[880px] flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Eyebrow>Blueprint</Eyebrow>
          <h1 className="m-0 font-display text-5xl font-medium tracking-[-0.02em]">
            Where do you <span className="font-normal italic">want to start?</span>
          </h1>
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {DOORS.map((door) => (
            <li key={door.href}>
              <Link
                href={door.href}
                className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 text-fg no-underline transition-colors duration-150 hover:border-border-strong"
              >
                <span className="text-xl font-semibold">{door.title}</span>
                <span className="text-md text-fg-secondary">{door.body}</span>
                <ArrowRightIcon className="mt-auto text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
