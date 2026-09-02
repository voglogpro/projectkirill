import type { Sql } from "postgres";
import type { CoreEntitlementGate } from "../application/core-service.js";
import type { BotActivationEntitlementGate } from "../application/connect-bot.js";
import { assertCanActivateBot, assertCanCreateProject, resolveEntitlement } from "./entitlements.js";
import type { PaidBillingPlanCode } from "./plans.js";

export class PostgresEntitlementGate implements CoreEntitlementGate, BotActivationEntitlementGate {
  public constructor(private readonly sql: Sql, private readonly clock: () => Date = () => new Date()) {}

  public async assertCanCreateProject(userId: string): Promise<void> {
    const [subscription, count] = await Promise.all([this.subscription(userId), this.projectCount(userId)]);
    assertCanCreateProject(resolveEntitlement(subscription, this.clock()), count);
  }

  public async assertCanPublish(userId: string): Promise<void> {
    const entitlement = resolveEntitlement(await this.subscription(userId), this.clock());
    if (!entitlement.canPublish) {
      const { EntitlementError } = await import("./errors.js");
      throw new EntitlementError("Для публикации приложения требуется активный платный тариф");
    }
  }

  public async assertCanActivateBot(userId: string, projectId: string): Promise<void> {
    const [subscription, rows] = await Promise.all([
      this.subscription(userId),
      this.sql<{ count: string; project_active: boolean }[]>`
        SELECT
          count(*) FILTER (WHERE bi.status IN ('configuring', 'active'))::text AS count,
          bool_or(bi.project_id = ${projectId} AND bi.status = 'active') AS project_active
        FROM projects p
        LEFT JOIN bot_integrations bi ON bi.project_id = p.id
        WHERE p.owner_user_id = ${userId}
      `,
    ]);
    const row = rows[0] ?? { count: "0", project_active: false };
    assertCanActivateBot(resolveEntitlement(subscription, this.clock()), Number(row.count), row.project_active);
  }

  private async subscription(userId: string) {
    const rows = await this.sql<{ plan_code: PaidBillingPlanCode; status: "active" | "past_due" | "canceled"; current_period_end: Date }[]>`
      SELECT plan_code, status, current_period_end
      FROM billing_subscriptions WHERE user_id = ${userId} LIMIT 1
    `;
    const row = rows[0];
    return row === undefined ? null : { planCode: row.plan_code, status: row.status, currentPeriodEnd: row.current_period_end };
  }

  private async projectCount(userId: string): Promise<number> {
    const rows = await this.sql<{ count: string }[]>`SELECT count(*)::text AS count FROM projects WHERE owner_user_id = ${userId}`;
    return Number(rows[0]?.count ?? 0);
  }
}
