-- No retroactive repricing: old projects retain paid capabilities until the
-- currently paid period ends. No subscription or payment amount is rewritten.
ALTER TABLE projects ADD COLUMN kit text NOT NULL DEFAULT 'bot-app-site'
  CHECK (kit IN ('bot', 'bot-app', 'bot-app-site', 'site'));
ALTER TABLE projects ADD COLUMN legacy_full_access_until timestamptz;
UPDATE projects p SET legacy_full_access_until = s.current_period_end
FROM billing_subscriptions s WHERE s.user_id = p.owner_user_id
  AND s.status = 'active' AND s.current_period_end > now();
ALTER TABLE projects ALTER COLUMN kit SET DEFAULT 'bot';
ALTER TABLE billing_checkouts DROP CONSTRAINT billing_checkouts_plan_code_check;
ALTER TABLE billing_checkouts ADD CONSTRAINT billing_checkouts_plan_code_check
  CHECK (plan_code IN ('solo', 'trio', 'studio'));
ALTER TABLE billing_subscriptions DROP CONSTRAINT billing_subscriptions_plan_code_check;
ALTER TABLE billing_subscriptions ADD CONSTRAINT billing_subscriptions_plan_code_check
  CHECK (plan_code IN ('solo', 'trio', 'studio'));

-- Every public/runtime read uses the same capability and slot policy. Stable
-- ordering also prevents a downgrade from continuing to run excess projects.
CREATE FUNCTION project_launch_allowed(target_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN billing_subscriptions s ON s.user_id = p.owner_user_id
    WHERE p.id = target_id AND p.status <> 'suspended'
      AND s.status = 'active' AND s.current_period_end > now()
      AND (p.legacy_full_access_until > now() OR s.plan_code = 'studio'
        OR (s.plan_code = 'solo' AND p.kit IN ('bot', 'site'))
        OR (s.plan_code = 'trio' AND p.kit = 'bot'))
      AND (SELECT count(*) FROM projects older
        WHERE older.owner_user_id = p.owner_user_id AND older.status <> 'suspended'
          AND (older.created_at, older.id) < (p.created_at, p.id)
          AND (older.published_release_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM bot_integrations bi WHERE bi.project_id = older.id AND bi.status IN ('active', 'configuring')))
          AND (older.legacy_full_access_until > now() OR s.plan_code = 'studio'
            OR (s.plan_code = 'solo' AND older.kit IN ('bot', 'site'))
            OR (s.plan_code = 'trio' AND older.kit = 'bot'))
        ) < CASE WHEN s.plan_code = 'trio' THEN 3 ELSE 1 END
  );
$$;
