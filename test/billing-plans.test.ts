import { describe, expect, it } from "vitest";
import { transitionCheckout } from "../src/billing/checkout-state.js";
import {
  assertCanActivateBot,
  assertCanCreateProject,
  assertCanLaunchKit,
  resolveEntitlement,
} from "../src/billing/entitlements.js";
import { EntitlementError } from "../src/billing/errors.js";
import { BILLING_PLANS } from "../src/billing/plans.js";

describe("billing plans and entitlements", () => {
  it("keeps prices and bot limits as server-owned constants", () => {
    expect(BILLING_PLANS.free).toMatchObject({ monthlyPriceMinor: 0, maxProjects: 1, maxActiveBots: 0 });
    expect(BILLING_PLANS.solo).toMatchObject({ monthlyPriceMinor: 35_000, maxProjects: 1, maxActiveBots: 1 });
    expect(BILLING_PLANS.trio).toMatchObject({ monthlyPriceMinor: 65_000, maxProjects: 3, maxActiveBots: 3 });
  });

  it("falls back to free when a paid period has expired", () => {
    const entitlement = resolveEntitlement(
      { planCode: "trio", status: "active", currentPeriodEnd: new Date("2026-08-31T23:59:59Z") },
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(entitlement).toEqual({
      planCode: "free",
      maxProjects: 1,
      maxActiveBots: 0,
      canPublish: false,
      supportedKits: [],
    });
    expect(() => assertCanActivateBot(entitlement, 0)).toThrow(EntitlementError);
  });

  it("allows an already active project without consuming another bot slot", () => {
    const entitlement = resolveEntitlement(
      { planCode: "solo", status: "active", currentPeriodEnd: new Date("2026-10-01T00:00:00Z") },
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(() => assertCanActivateBot(entitlement, 1, true)).not.toThrow();
    expect(() => assertCanActivateBot(entitlement, 1, false)).toThrow(EntitlementError);
    expect(() => assertCanCreateProject(entitlement, 1)).toThrow(EntitlementError);
  });

  it("separates three text bots from one full-stack project at the same price", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const expiry = new Date("2026-10-05T12:00:00Z");
    const trio = resolveEntitlement({ planCode: "trio", status: "active", currentPeriodEnd: expiry }, now);
    const studio = resolveEntitlement({ planCode: "studio", status: "active", currentPeriodEnd: expiry }, now);
    expect(BILLING_PLANS.studio).toMatchObject({ monthlyPriceMinor: 65_000, maxActiveBots: 1 });
    expect(() => assertCanLaunchKit(trio, "bot", null, now)).not.toThrow();
    for (const kit of ["bot-app", "bot-app-site"] as const) {
      expect(() => assertCanLaunchKit(trio, kit, null, now)).toThrow(EntitlementError);
      expect(() => assertCanLaunchKit(studio, kit, null, now)).not.toThrow();
    }
    expect(() => assertCanActivateBot(trio, 2)).not.toThrow();
    expect(() => assertCanActivateBot(trio, 3)).toThrow(EntitlementError);
    expect(() => assertCanActivateBot(studio, 1)).toThrow(EntitlementError);
  });

  it("honours only the remaining original paid period for legacy full-stack projects", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const solo = resolveEntitlement({ planCode: "solo", status: "active", currentPeriodEnd: new Date("2026-11-01") }, now);
    expect(() => assertCanLaunchKit(solo, "bot-app-site", new Date("2026-10-01"), now)).not.toThrow();
    expect(() => assertCanLaunchKit(solo, "bot-app-site", now, now)).toThrow(EntitlementError);
    expect(() => assertCanActivateBot(resolveEntitlement(null), 1, true)).toThrow(EntitlementError);
    expect(() => assertCanLaunchKit(resolveEntitlement(null), "bot-app-site", new Date("2026-10-01"), now)).toThrow(EntitlementError);
  });
});

describe("checkout state machine", () => {
  it("does not regress terminal states on replayed webhooks", () => {
    expect(transitionCheckout("pending", "succeeded")).toBe("succeeded");
    expect(transitionCheckout("succeeded", "pending")).toBe("succeeded");
    expect(transitionCheckout("canceled", "succeeded")).toBe("canceled");
  });
});
