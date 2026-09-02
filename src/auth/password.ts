import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_BYTES = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

export interface PepperKey {
  id: string;
  key: Uint8Array;
}

/** Supports verification with old peppers while new hashes use current(). */
export interface PepperProvider {
  current(): PepperKey;
  get(id: string): PepperKey | null;
}

export class StaticPepperProvider implements PepperProvider {
  private readonly pepper: PepperKey;

  public constructor(id: string, key: Uint8Array) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("Invalid pepper id");
    if (key.byteLength < 32) throw new Error("Password pepper must contain at least 32 bytes");
    this.pepper = { id, key: Buffer.from(key) };
  }

  public current(): PepperKey {
    return this.pepper;
  }

  public get(id: string): PepperKey | null {
    return id === this.pepper.id ? this.pepper : null;
  }
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

export class ScryptPasswordHasher implements PasswordHasher {
  public constructor(private readonly peppers: PepperProvider) {}

  public async hash(password: string): Promise<string> {
    assertPasswordSize(password);
    const pepper = this.peppers.current();
    const salt = randomBytes(16);
    const derived = await derive(password, salt, pepper.key, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    return ["scrypt", "1", pepper.id, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), derived.toString("base64url")].join("$");
  }

  public async verify(password: string, encodedHash: string): Promise<boolean> {
    try {
      assertPasswordSize(password);
      const parts = encodedHash.split("$");
      if (parts.length !== 8 || parts[0] !== "scrypt" || parts[1] !== "1") return false;
      const pepper = this.peppers.get(parts[2] ?? "");
      if (pepper === null) return false;
      const n = parseStrictInteger(parts[3]);
      const r = parseStrictInteger(parts[4]);
      const p = parseStrictInteger(parts[5]);
      if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
      const salt = Buffer.from(parts[6] ?? "", "base64url");
      const expected = Buffer.from(parts[7] ?? "", "base64url");
      if (salt.length !== 16 || expected.length !== KEY_BYTES) return false;
      const actual = await derive(password, salt, pepper.key, n, r, p);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}

function derive(password: string, salt: Uint8Array, pepper: Uint8Array, n: number, r: number, p: number): Promise<Buffer> {
  const preHash = createHmac("sha256", pepper).update(password, "utf8").digest();
  return new Promise((resolve, reject) => {
    scrypt(preHash, salt, KEY_BYTES, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      preHash.fill(0);
      if (error !== null) reject(error);
      else resolve(Buffer.from(key));
    });
  });
}

function assertPasswordSize(password: string): void {
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 12 || bytes > 1_024) throw new Error("Password must contain between 12 and 1024 UTF-8 bytes");
}

function parseStrictInteger(value: string | undefined): number {
  if (value === undefined || !/^[0-9]+$/.test(value)) return Number.NaN;
  return Number(value);
}
