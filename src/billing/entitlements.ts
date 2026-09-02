import { EntitlementError } from "./errors.js";
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
  if (projectAlreadyActive) return;
  if (!entitlement.canPublish || currentActiveBotCount >= entitlement.maxActiveBots) {
    throw new EntitlementError(
      entitlement.planCode === "free"
        ? "Для запуска бота требуется тариф «Один бот» или «Три бота»"
        : `На тарифе ${entitlement.planCode} уже используется максимум активных ботов`,
    );
  }
}

