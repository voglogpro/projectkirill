import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const jwtHeaderSchema = z.object({ alg: z.literal("HS256"), typ: z.literal("JWT") }).strict();
const accessClaimsSchema = z
  .object({
    iss: z.string().min(1),
    aud: z.string().min(1),
    sub: z.uuid(),
    sid: z.uuid(),
    jti: z.uuid(),
    type: z.literal("access"),
    iat: z.number().int(),
    exp: z.number().int(),
  })
  .strict();

export type AccessClaims = z.infer<typeof accessClaimsSchema>;

export class AccessTokenService {
  private readonly secret: Buffer;

  public constructor(
    secret: Uint8Array,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly ttlSeconds = 15 * 60,
    private readonly clock: () => number = () => Date.now(),
  ) {
    if (secret.byteLength < 32) throw new Error("JWT secret must contain at least 32 bytes");
    if (issuer.length === 0 || audience.length === 0) throw new Error("JWT issuer and audience are required");
    this.secret = Buffer.from(secret);
  }

  public sign(userId: string, sessionId: string): string {
    const now = Math.floor(this.clock() / 1_000);
    const claims: AccessClaims = {
      iss: this.issuer,
      aud: this.audience,
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      type: "access",
      iat: now,
      exp: now + this.ttlSeconds,
    };
    accessClaimsSchema.parse(claims);
    const header = encodeJson({ alg: "HS256", typ: "JWT" });
    const payload = encodeJson(claims);
    return `${header}.${payload}.${this.signature(`${header}.${payload}`).toString("base64url")}`;
  }

  public get expiresInSeconds(): number {
    return this.ttlSeconds;
  }

  public verify(token: string): AccessClaims {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid access token");
    const headerPart = parts[0] ?? "";
    const payloadPart = parts[1] ?? "";
    const supplied = Buffer.from(parts[2] ?? "", "base64url");
    const expected = this.signature(`${headerPart}.${payloadPart}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Invalid access token");
    jwtHeaderSchema.parse(decodeJson(headerPart));
    const claims = accessClaimsSchema.parse(decodeJson(payloadPart));
    const now = Math.floor(this.clock() / 1_000);
    if (claims.iss !== this.issuer || claims.aud !== this.audience || claims.exp <= now || claims.iat > now + 30 || claims.exp <= claims.iat) {
      throw new Error("Invalid access token");
    }
    return claims;
  }

  private signature(input: string): Buffer {
    return createHmac("sha256", this.secret).update(input, "ascii").digest();
  }
}

export class OpaqueRefreshTokens {
  private readonly hashKey: Buffer;

  public constructor(hashKey: Uint8Array) {
    if (hashKey.byteLength < 32) throw new Error("Refresh-token hash key must contain at least 32 bytes");
    this.hashKey = Buffer.from(hashKey);
  }

  public issue(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  public hash(token: string): string {
    if (token.length < 32 || token.length > 256) throw new Error("Invalid refresh token");
    return createHmac("sha256", this.hashKey).update(token, "utf8").digest("hex");
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid access token");
  }
}
