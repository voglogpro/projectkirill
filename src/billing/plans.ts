import type { ProductKit } from "../domain/product-kit.js";
export const BILLING_PLAN_CODES = ["free", "solo", "trio", "studio"] as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];
export type PaidBillingPlanCode = Exclude<BillingPlanCode, "free">;

export interface BillingPlan {
  readonly code: BillingPlanCode;
  readonly name: string;
  readonly monthlyPriceMinor: number;
  readonly currency: "RUB";
  readonly maxProjects: number;
  readonly maxActiveBots: number;
  readonly supportedKits: readonly ProductKit[];
}

/** Prices are stored in kopecks and are never accepted from the browser. */
export const BILLING_PLANS: Readonly<Record<BillingPlanCode, BillingPlan>> = {
  free: {
    code: "free",
    name: "Бесплатный",
    monthlyPriceMinor: 0,
    currency: "RUB",
    maxProjects: 1,
    maxActiveBots: 0,
    supportedKits: [],
  },
  solo: {
    code: "solo",
    name: "Один текстовый бот",
    monthlyPriceMinor: 35_000,
    currency: "RUB",
    maxProjects: 1,
    maxActiveBots: 1,
    supportedKits: ["bot", "site"],
  },
  trio: {
    code: "trio",
    name: "Три текстовых бота",
    monthlyPriceMinor: 65_000,
    currency: "RUB",
    maxProjects: 3,
    maxActiveBots: 3,
    supportedKits: ["bot"],
  },
  studio: {
    code: "studio", name: "Бот + Mini App", monthlyPriceMinor: 65_000,
    currency: "RUB", maxProjects: 1, maxActiveBots: 1,
    supportedKits: ["bot", "bot-app", "bot-app-site", "site"],
  },
};

export function getBillingPlan(code: BillingPlanCode): BillingPlan {
  return BILLING_PLANS[code];
}

export function isPaidBillingPlan(code: BillingPlanCode): code is PaidBillingPlanCode {
  return code !== "free";
}
