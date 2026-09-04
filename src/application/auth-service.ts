import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PasswordHasher } from "../auth/password.js";
import { AuthenticationError, RefreshReuseError } from "../auth/errors.js";
import type { AccessTokenService, OpaqueRefreshTokens } from "../auth/tokens.js";

const registerSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(320),
    displayName: z.string().trim().min(1).max(120),
    password: z.string().min(8).max(256),
  })
  .strict();

const loginSchema = z.object({ email: z.email().trim().toLowerCase().max(320), password: z.string().min(1).max(256) }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(256) }).strict();

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
}

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthRepository {
  createUser(input: { email: string; displayName: string; passwordHash: string }): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createSession(input: {
    id: string;
    familyId: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    context: SessionContext;
  }): Promise<void>;
  rotateSession(input: {
    oldTokenHash: string;
    newSessionId: string;
    newTokenHash: string;
    expiresAt: Date;
    context: SessionContext;
  }): Promise<{ kind: "rotated"; userId: string; sessionId: string } | { kind: "invalid" } | { kind: "reused" }>;
  revokeSession(sessionId: string, userId: string, reason: string): Promise<void>;
}

export interface AuthTokensResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

export class AuthService {
  private readonly refreshTtlMilliseconds = 30 * 24 * 60 * 60 * 1_000;
  private dummyHashPromise: Promise<string> | undefined;

  public constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: OpaqueRefreshTokens,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  public async register(untrustedInput: unknown, context: SessionContext = {}): Promise<AuthTokensResult & { user: Omit<AuthUser, "passwordHash"> }> {
    const input = registerSchema.parse(untrustedInput);
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.repository.createUser({ email: input.email, displayName: input.displayName, passwordHash });
    return { user: publicUser(user), ...(await this.createSession(user.id, context)) };
  }

  public async login(untrustedInput: unknown, context: SessionContext = {}): Promise<AuthTokensResult & { user: Omit<AuthUser, "passwordHash"> }> {
    const input = loginSchema.parse(untrustedInput);
    const user = await this.repository.findUserByEmail(input.email);
    // A full scrypt calculation for absent users reduces account enumeration by timing.
    const valid = user?.passwordHash === null || user === null
      ? await this.verifyDummy(input.password)
      : await this.passwordHasher.verify(input.password, user.passwordHash);
    if (user === null || user.passwordHash === null || !valid) throw new AuthenticationError();
    return { user: publicUser(user), ...(await this.createSession(user.id, context)) };
  }

  public async refresh(untrustedInput: unknown, context: SessionContext = {}): Promise<AuthTokensResult> {
    const input = refreshSchema.parse(untrustedInput);
    let oldTokenHash: string;
    try {
      oldTokenHash = this.refreshTokens.hash(input.refreshToken);
    } catch {
      throw new AuthenticationError("Invalid refresh token");
    }
    const next = this.refreshTokens.issue();
    const newSessionId = randomUUID();
    const result = await this.repository.rotateSession({
      oldTokenHash,
      newSessionId,
      newTokenHash: next.hash,
      expiresAt: new Date(this.clock() + this.refreshTtlMilliseconds),
      context,
    });
    if (result.kind === "reused") throw new RefreshReuseError();
    if (result.kind === "invalid") throw new AuthenticationError("Invalid refresh token");
    return {
      accessToken: this.accessTokens.sign(result.userId, result.sessionId),
      refreshToken: next.token,
      accessTokenExpiresInSeconds: this.accessTokens.expiresInSeconds,
    };
  }

  public async logout(accessToken: string): Promise<void> {
    const claims = this.accessTokens.verify(accessToken);
    await this.repository.revokeSession(claims.sid, claims.sub, "logout");
  }

  public verifyAccessToken(accessToken: string) {
    return this.accessTokens.verify(accessToken);
  }

  private async createSession(userId: string, context: SessionContext): Promise<AuthTokensResult> {
    const id = randomUUID();
    const refresh = this.refreshTokens.issue();
    await this.repository.createSession({
      id,
      familyId: randomUUID(),
      userId,
      refreshTokenHash: refresh.hash,
      expiresAt: new Date(this.clock() + this.refreshTtlMilliseconds),
      context,
    });
    return { accessToken: this.accessTokens.sign(userId, id), refreshToken: refresh.token, accessTokenExpiresInSeconds: this.accessTokens.expiresInSeconds };
  }

  private async verifyDummy(password: string): Promise<boolean> {
    this.dummyHashPromise ??= this.passwordHasher.hash("not-a-real-password-value");
    const dummy = await this.dummyHashPromise;
    await this.passwordHasher.verify(password, dummy);
    return false;
  }
}

function publicUser(user: AuthUser): Omit<AuthUser, "passwordHash"> {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
