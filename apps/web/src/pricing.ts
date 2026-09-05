import { BILLING_PLANS, type BillingPlanCode, type PaidBillingPlanCode } from "../../../src/billing/plans";
import type { ProductKit } from "./types";

export type { BillingPlanCode, PaidBillingPlanCode };
export const requiresMiniApp = (kit: ProductKit): boolean => kit === "bot-app" || kit === "bot-app-site";
export const suggestedPlan = (kit: ProductKit): PaidBillingPlanCode => requiresMiniApp(kit) ? "studio" : "solo";
export const planFitsKit = (plan: BillingPlanCode, kit: ProductKit): boolean => plan !== "free" && BILLING_PLANS[plan].supportedKits.includes(kit);
export const priceForKit = (kit: ProductKit): number => BILLING_PLANS[suggestedPlan(kit)].monthlyPriceMinor / 100;
export const kitName: Record<ProductKit, string> = {
  bot: "Текстовый бот", "bot-app": "Бот + Mini App", "bot-app-site": "Бот + Mini App + сайт", site: "Сайт",
};
