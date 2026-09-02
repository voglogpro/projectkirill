export const BILLING_PLAN_CODES = ["free", "solo", "trio"] as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];
export type PaidBillingPlanCode = Exclude<BillingPlanCode, "free">;

export interface BillingPlan {
  readonly code: BillingPlanCode;
  readonly name: string;
  readonly monthlyPriceMinor: number;
  readonly currency: "RUB";
  readonly maxProjects: number;
  readonly maxActiveBots: number;
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
  },
  solo: {
    code: "solo",
    name: "Один бот",
    monthlyPriceMinor: 35_000,
    currency: "RUB",
    maxProjects: 1,
    maxActiveBots: 1,
  },
  trio: {
    code: "trio",
    name: "Три бота",
    monthlyPriceMinor: 65_000,
    currency: "RUB",
    maxProjects: 3,
    maxActiveBots: 3,
  },
};

export function getBillingPlan(code: BillingPlanCode): BillingPlan {
  return BILLING_PLANS[code];
}

export function isPaidBillingPlan(code: BillingPlanCode): code is PaidBillingPlanCode {
  return code !== "free";
}

