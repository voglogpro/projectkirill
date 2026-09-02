import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ScryptPasswordHasher, StaticPepperProvider } from "../src/auth/password.js";
import { AccessTokenService, OpaqueRefreshTokens } from "../src/auth/tokens.js";

describe("authentication primitives", () => {
  it("uses a unique salt and verifies without exposing the password", async () => {
    const hasher = new ScryptPasswordHasher(new StaticPepperProvider("pepper-v1", randomBytes(32)));
    const password = "correct horse battery staple";
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    await expect(hasher.verify(password, first)).resolves.toBe(true);
    await expect(hasher.verify("incorrect password value", first)).resolves.toBe(false);
  });

  it("strictly verifies access token issuer, audience, type and expiration", () => {
    const key = randomBytes(32);
    let now = Date.parse("2026-01-01T00:00:00Z");
    const tokens = new AccessTokenService(key, "tma-api", "tma-dashboard", 60, () => now);
    const token = tokens.sign(randomUUID(), randomUUID());

    expect(tokens.verify(token).type).toBe("access");
    expect(() => new AccessTokenService(key, "tma-api", "other-audience", 60, () => now).verify(token)).toThrow("Invalid access token");
    now += 61_000;
    expect(() => tokens.verify(token)).toThrow("Invalid access token");
  });

  it("stores only a keyed hash of opaque refresh tokens", () => {
    const refresh = new OpaqueRefreshTokens(randomBytes(32));
    const issued = refresh.issue();
    expect(issued.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.hash).not.toContain(issued.token);
    expect(refresh.hash(issued.token)).toBe(issued.hash);
  });
});
