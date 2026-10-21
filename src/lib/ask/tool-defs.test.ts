import { describe, expect, it } from "vitest";
import * as z from "zod/v4";
import { ToolInputs } from "./tool-defs";

describe("Ask tool schemas", () => {
  it("stay within the API's limit of 16 nullable (union-typed) fields across all strict tools", () => {
    let unions = 0;
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (Array.isArray(n.anyOf) || Array.isArray(n.type)) unions++;
      Object.values(n).forEach(walk);
    };
    for (const schema of Object.values(ToolInputs)) walk(z.toJSONSchema(schema));
    expect(unions).toBeLessThanOrEqual(16);
  });
});
