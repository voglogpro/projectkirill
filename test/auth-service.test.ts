import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AuthService, type AuthRepository } from "../src/application/auth-service.js";
import { AccessTokenService, OpaqueRefreshTokens } from "../src/auth/tokens.js";
import type { PasswordHasher } from "../src/auth/password.js";
import { RefreshReuseError } from "../src/auth/errors.js";

function fixture() {
  const userId = randomUUID();
  const repository: AuthRepository = {
    createUser: vi.fn().mockResolvedValue({ id: userId, email: "kirill@example.com", displayName: "Кирилл", passwordHash: "encoded" }),
    findUserByEmail: vi.fn().mockResolvedValue({ id: userId, email: "kirill@example.com", displayName: "Кирилл", passwordHash: "encoded" }),
    createSession: vi.fn().mockResolvedValue(undefined),
    rotateSession: vi.fn().mockResolvedValue({ kind: "rotated", userId, sessionId: randomUUID() }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
  };
  const passwords: PasswordHasher = { hash: vi.fn().mockResolvedValue("encoded"), verify: vi.fn().mockResolvedValue(true) };
  const access = new AccessTokenService(randomBytes(32), "issuer", "dashboard");
  const service = new AuthService(repository, passwords, access, new OpaqueRefreshTokens(randomBytes(32)));
  return { service, repository, passwords, access, userId };
}

describe("AuthService", () => {
  it("creates a session and returns verifiable strict claims on login", async () => {
    const { service, repository, access, userId } = fixture();
    const result = await service.login({ email: "KIRILL@example.com", password: "a sufficiently long password" });
    expect(result.user.id).toBe(userId);
    expect(access.verify(result.accessToken).sub).toBe(userId);
    expect(repository.createSession).toHaveBeenCalledOnce();
  });

  it("propagates refresh-token reuse as a security event", async () => {
    const { service, repository } = fixture();
    vi.mocked(repository.rotateSession).mockResolvedValue({ kind: "reused" });
    const token = new OpaqueRefreshTokens(randomBytes(32)).issue().token;
    await expect(service.refresh({ refreshToken: token })).rejects.toBeInstanceOf(RefreshReuseError);
  });
});
