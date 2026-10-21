import type { ProgramDay, Program, Tier } from "@/lib/domain/types";
import { TIER_NAMES, dayTitle } from "@/lib/domain/describe";
import { cn } from "@/lib/cn";
import { InfoIcon } from "@/components/icons";

/** The program's own shorthand (T1, A1), as a quiet tag next to the plain name. */
export function Code({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-xs border border-current/30 px-1 font-mono text-[10px] leading-4 tracking-normal normal-case", className)}>
      {children}
    </span>
  );
}

/** "MAIN LIFT [T1]": plain name first, code as a tag. */
export function TierLabel({ tier, plural = false, className }: { tier: Tier; plural?: boolean; className?: string }) {
  const name = TIER_NAMES[tier];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted uppercase", className)}>
      {plural ? name.many : name.one}
      <Code>{tier}</Code>
    </span>
  );
}

/** "Workout 1 [A1]". */
export function DayTitle({ program, day, className }: { program: { days: Array<Pick<ProgramDay, "id" | "name">> }; day: Pick<ProgramDay, "id" | "name">; className?: string }) {
  const { title, code } = dayTitle(program, day);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {title}
      {code ? <Code>{code}</Code> : null}
    </span>
  );
}

/** "What do these mean?" Explains tiers and the workout rotation, in place. */
export function TermsHelp({ program, className }: { program: Program; className?: string }) {
  const tiers = [...new Set(program.days.flatMap((d) => d.slots.map((s) => s.tier)))].sort() as Tier[];
  const codes = program.days.map((d) => dayTitle(program, d).code).filter(Boolean);
  return (
    <details className={cn("group text-sm", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-fg-secondary transition-colors duration-150 hover:text-fg [&::-webkit-details-marker]:hidden">
        <InfoIcon width={15} height={15} />
        What do these labels mean?
      </summary>
      <div className="enter-fade mt-3 grid gap-4 rounded-md border border-border bg-surface-raised p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-fg">Tiers</span>
          <dl className="m-0 flex flex-col gap-2">
            {tiers.map((t) => (
              <div key={t} className="flex flex-col gap-0.5">
                <dt>
                  <TierLabel tier={t} className="text-fg" />
                </dt>
                <dd className="m-0 text-fg-secondary">{TIER_NAMES[t].about}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-fg">Workouts</span>
          <p className="m-0 text-fg-secondary">
            Workouts come in order, not on set weekdays. Train whenever you can and the next one in line is up.
            {codes.length ? ` ${codes.join(", ")} are your program’s own names for them.` : ""}
          </p>
          <p className="m-0 text-fg-secondary">
            Schemes read sets × reps: <span className="font-mono text-fg">5×3+</span> is five sets of three, with as many reps as you can on the last.
          </p>
        </div>
      </div>
    </details>
  );
}
