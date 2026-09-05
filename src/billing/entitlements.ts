import { EntitlementError } from "./errors.js";
import type { ProductKit } from "../domain/product-kit.js";
import { getBillingPlan, type BillingPlanCode, type PaidBillingPlanCode } from "./plans.js";

export interface PaidSubscriptionSnapshot {
  planCode: PaidBillingPlanCode;
  status: "active" | "past_due" | "canceled";
  currentPeriodEnd: Date;
}

export interface Entitlement {
  planCode: BillingPlanCode;
  maxProjects: number;
  maxActiveBots: number;
  canPublish: boolean;
  supportedKits: readonly ProductKit[];
  validUntil?: Date;
}

export function resolveEntitlement(
  subscription: PaidSubscriptionSnapshot | null,
  now: Date = new Date(),
): Entitlement {
  const paidIsActive =
    subscription !== null &&
    subscription.status === "active" &&
    subscription.currentPeriodEnd.getTime() > now.getTime();
  const plan = getBillingPlan(paidIsActive ? subscription.planCode : "free");

  return {
    planCode: plan.code,
    maxProjects: plan.maxProjects,
    maxActiveBots: plan.maxActiveBots,
    canPublish: plan.maxActiveBots > 0,
    supportedKits: plan.supportedKits,
    ...(paidIsActive ? { validUntil: subscription.currentPeriodEnd } : {}),
  };
}

export function assertCanCreateProject(entitlement: Entitlement, currentProjectCount: number): void {
  if (!Number.isInteger(currentProjectCount) || currentProjectCount < 0) {
    throw new TypeError("currentProjectCount must be a non-negative integer");
  }
  if (currentProjectCount >= entitlement.maxProjects) {
    throw new EntitlementError(`Тариф ${entitlement.planCode} позволяет создать до ${entitlement.maxProjects} проектов`);
  }
}

export function assertCanActivateBot(
  entitlement: Entitlement,
  currentActiveBotCount: number,
  projectAlreadyActive = false,
): void {
  if (!Number.isInteger(currentActiveBotCount) || currentActiveBotCount < 0) {
    throw new TypeError("currentActiveBotCount must be a non-negative integer");
  }
  if (projectAlreadyActive && entitlement.canPublish) return;
  if (!entitlement.canPublish || currentActiveBotCount >= entitlement.maxActiveBots) {
    throw new EntitlementError(
      entitlement.planCode === "free"
        ? "Для запуска требуется платный тариф, подходящий формату проекта"
        : `На тарифе ${entitlement.planCode} уже используется максимум активных ботов`,
    );
  }
}

/** Legacy paid projects retain their already-paid capabilities until renewal. */
export function assertCanLaunchKit(entitlement: Entitlement, kit: ProductKit, legacyUntil?: Date | null, now = new Date()): void {
  if (!entitlement.canPublish) throw new EntitlementError("Для запуска требуется активный платный тариф");
  if (legacyUntil !== undefined && legacyUntil !== null && legacyUntil > now) return;
  if (!entitlement.supportedKits.includes(kit)) {
    throw new EntitlementError(kit === "bot-app" || kit === "bot-app-site"
      ? "Бот с Mini App стоит 650 ₽/месяц за один проект. Выберите тариф «Бот + Mini App»"
      : "Тариф не поддерживает выбранный формат проекта");
  }
}
