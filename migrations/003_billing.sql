CREATE TYPE billing_checkout_status AS ENUM (
  'creating', 'pending', 'succeeded', 'canceled', 'failed'
);
CREATE TYPE billing_subscription_status AS ENUM ('active', 'past_due', 'canceled');

CREATE TABLE billing_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_code text NOT NULL CHECK (plan_code IN ('solo', 'trio')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  status billing_checkout_status NOT NULL DEFAULT 'creating',
  client_request_id uuid NOT NULL,
  -- Sent to YooKassa as Idempotence-Key. It contains no customer data.
  idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  provider_payment_id text UNIQUE,
  provider_status text CHECK (
    provider_status IS NULL OR provider_status IN ('pending', 'succeeded', 'canceled')
  ),
  confirmation_url text CHECK (
    confirmation_url IS NULL OR confirmation_url LIKE 'https://%'
  ),
  failure_reason text CHECK (
    failure_reason IS NULL OR char_length(failure_reason) <= 100
  ),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_request_id),
  CHECK (status = 'creating' OR provider_payment_id IS NOT NULL OR status = 'failed')
);
CREATE INDEX billing_checkouts_user_idx
  ON billing_checkouts(user_id, created_at DESC);
CREATE INDEX billing_checkouts_pending_idx
  ON billing_checkouts(updated_at)
  WHERE status IN ('creating', 'pending');

-- Immutable provider identity plus the latest provider-verified state.
-- Raw webhooks are intentionally not persisted because they are untrusted.
CREATE TABLE billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid NOT NULL UNIQUE REFERENCES billing_checkouts(id) ON DELETE RESTRICT,
  provider_payment_id text NOT NULL UNIQUE,
  status billing_checkout_status NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency = 'RUB'),
  provider_payment_method_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  plan_code text NOT NULL CHECK (plan_code IN ('solo', 'trio')),
  status billing_subscription_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  provider_payment_method_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end > current_period_start)
);
CREATE INDEX billing_subscriptions_entitlement_idx
  ON billing_subscriptions(user_id, current_period_end)
  WHERE status = 'active';

