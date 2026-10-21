import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * primary   forest green: actions and progress (Approve, Start, Log set)
 * ink       confirm what the AI proposed (Confirm, Accept)
 * secondary hairline outline (Edit, Review each)
 * ghost     text-only (Show in source, Undo)
 * ai        hand a task to the AI (Ask AI to adjust); dashed amber
 */
export type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "ai";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  ink: "bg-fg text-inverse hover:opacity-90",
  secondary: "border border-border bg-transparent text-fg hover:bg-surface-raised",
  ghost: "bg-transparent text-link hover:text-fg",
  ai: "border-[1.5px] border-dashed border-ai bg-ai-wash text-fg hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm rounded-sm",
  md: "h-11 px-[18px] text-base rounded-md",
  lg: "h-15 px-6 text-lg rounded-xl",
};

/** Class string for anything that should look like a button, e.g. a <Link>. */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition duration-150 ease-standard active:scale-[0.98] disabled:active:scale-100",
    "disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted disabled:border-transparent disabled:brightness-100",
    variant === "secondary" || variant === "ghost" ? "font-medium" : null,
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
