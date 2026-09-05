import type { Sql } from "postgres";
import type { CoreEntitlementGate } from "../application/core-service.js";
import type { BotActivationEntitlementGate } from "../application/connect-bot.js";
import { assertCanActivateBot, assertCanCreateProject, assertCanLaunchKit, resolveEntitlement } from "./entitlements.js";
import type { ProductKit } from "../domain/product-kit.js";
import { NotFoundError } from "../domain/errors.js";
import { EntitlementError } from "./errors.js";
import type { PaidBillingPlanCode } from "./plans.js";

export class PostgresEntitlementGate implements CoreEntitlementGate, BotActivationEntitlementGate {
  public constructor(private readonly sql: Sql, private readonly clock: () => Date = () => new Date()) {}

  public async assertCanCreateProject(userId: string): Promise<void> {
    const [subscription, count] = await Promise.all([this.subscription(userId), this.projectCount(userId)]);
    assertCanCreateProject(resolveEntitlement(subscription, this.clock()), count);
  }

  public async assertCanPublish(userId: string, projectId: string): Promise<void> {
    const entitlement = resolveEntitlement(await this.subscription(userId), this.clock());
    const [project] = await this.sql<{ kit: ProductKit; legacy_full_access_until: Date | null; launch_allowed: boolean }[]>`
      SELECT kit, legacy_full_access_until, project_launch_allowed(id) AS launch_allowed
      FROM projects WHERE id = ${projectId} AND owner_user_id = ${userId}`;
    if (!project) throw new NotFoundError("Project not found");
    assertCanLaunchKit(entitlement, project.kit, project.legacy_full_access_until, this.clock());
    if (!project.launch_allowed) throw new EntitlementError("Лимит опубликованных проектов исчерпан или проект приостановлен");
  }

  public async assertCanActivateBot(userId: string, projectId: string): Promise<void> {
    await this.assertCanPublish(userId, projectId);
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
