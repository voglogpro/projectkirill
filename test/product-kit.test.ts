import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema } from "../src/domain/core.js";
import { hasMiniApp } from "../src/domain/product-kit.js";

describe("persisted product kit boundary", () => {
  it("accepts every freely editable format, defaulting old create clients to text bots", () => {
    expect(createProjectSchema.parse({ name: "Test", slug: "new-test" }).kit).toBe("bot");
    for (const kit of ["bot", "bot-app", "bot-app-site", "site"] as const) {
      expect(createProjectSchema.parse({ name: "Test", slug: "new-test", kit }).kit).toBe(kit);
      expect(updateProjectSchema.parse({ kit })).toEqual({ kit });
    }
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "Test", slug: "new-test", kit: "premium-bypass" }).success).toBe(false);
  });

  it("keeps text bots and standalone sites out of Telegram Mini App surfaces", () => {
    expect(hasMiniApp("bot")).toBe(false);
    expect(hasMiniApp("site")).toBe(false);
    expect(hasMiniApp("bot-app")).toBe(true);
    expect(hasMiniApp("bot-app-site")).toBe(true);
  });
});
