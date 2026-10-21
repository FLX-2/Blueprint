import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/text";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="bg-drafting flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="m-0 font-display text-4xl font-medium tracking-[-0.02em]">
        Nothing drawn <span className="font-normal italic">here</span>
      </h1>
      <p className="m-0 max-w-[420px] text-md text-fg-secondary">That page doesn’t exist. Your program, log and history are where you left them.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/train" className={buttonClasses({ variant: "primary" })}>
          Go to Train
        </Link>
        <Link href="/plan" className={buttonClasses({ variant: "secondary" })}>
          Plan
        </Link>
      </div>
    </main>
  );
}
