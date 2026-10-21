import { afterEach, describe, expect, it, vi } from "vitest";
import { modelParams } from "./model";

afterEach(() => vi.unstubAllEnvs());

describe("modelParams", () => {
  it("defaults to Haiku 5.5, without refusal fallbacks (Haiku rejects them)", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(modelParams()).toEqual({ model: "claude-haiku-5-5" });
  });

  it("adds server-side fallbacks for Opus 5 and later", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-opus-5-5");
    expect(modelParams()).toEqual({ model: "claude-opus-5-5", betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });
});
