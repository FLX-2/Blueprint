/**
 * Which Claude model every AI route uses. Claude Haiku 5.5 by default: the
 * low-cost model, plenty for these small, structured jobs. Set
 * ANTHROPIC_MODEL in .env.local to use another, e.g. claude-opus-5-5.
 */
export const DEFAULT_MODEL = "claude-haiku-5-5";

/**
 * Model settings for a request. Server-side refusal fallbacks (a policy
 * decline retried on Anthropic's recommended model) exist for Opus 5 and
 * later; Haiku 5.5 rejects the parameter, so it's only sent there.
 */
export function modelParams() {
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  return /^claude-opus-5(-|$)/.test(model)
    ? { model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : { model };
}
