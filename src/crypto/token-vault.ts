import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export interface WrappedKey {
  keyId: string;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface KekProvider {
  wrapKey(plaintextKey: Uint8Array, context: string): Promise<WrappedKey>;
  unwrapKey(wrapped: WrappedKey, context: string): Promise<Uint8Array>;
}

export interface SealedSecret {
  version: 1;
  algorithm: "AES-256-GCM";
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: WrappedKey;
}

function encryptAesGcm(plaintext: Uint8Array, key: Uint8Array, aad: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decryptAesGcm(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, authTag: Uint8Array, aad: string) {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(authTag));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Development/self-hosted KEK. Production should implement KekProvider through
 * a cloud KMS or Vault Transit so the key never enters application memory.
 */
export class LocalAesKek implements KekProvider {
  private readonly key: Buffer;

  public constructor(base64Key: string, private readonly keyId: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== KEY_BYTES) throw new Error("TOKEN_KEK_BASE64 must decode to exactly 32 bytes");
  }

  public async wrapKey(plaintextKey: Uint8Array, context: string): Promise<WrappedKey> {
    const result = encryptAesGcm(plaintextKey, this.key, `tma:kek:v1:${context}:${this.keyId}`);
    return {
      keyId: this.keyId,
      ciphertext: result.ciphertext.toString("base64"),
      iv: result.iv.toString("base64"),
      authTag: result.authTag.toString("base64"),
    };
  }

  public async unwrapKey(wrapped: WrappedKey, context: string): Promise<Uint8Array> {
    if (wrapped.keyId !== this.keyId) throw new Error(`Unknown KEK id: ${wrapped.keyId}`);
    return decryptAesGcm(
      Buffer.from(wrapped.ciphertext, "base64"),
      this.key,
      Buffer.from(wrapped.iv, "base64"),
      Buffer.from(wrapped.authTag, "base64"),
      `tma:kek:v1:${context}:${wrapped.keyId}`,
    );
  }
}

export class EnvelopeTokenVault {
  public constructor(private readonly kek: KekProvider) {}

  public async seal(token: string, projectId: string): Promise<SealedSecret> {
    const dataKey = randomBytes(KEY_BYTES);
    try {
      const aad = `tma:bot-token:v1:${projectId}`;
      const encrypted = encryptAesGcm(Buffer.from(token, "utf8"), dataKey, aad);
      return {
        version: 1,
        algorithm: "AES-256-GCM",
        ciphertext: encrypted.ciphertext.toString("base64"),
        iv: encrypted.iv.toString("base64"),
        authTag: encrypted.authTag.toString("base64"),
        wrappedKey: await this.kek.wrapKey(dataKey, projectId),
      };
    } finally {
      dataKey.fill(0);
    }
  }

  public async open(secret: SealedSecret, projectId: string): Promise<string> {
    if (secret.version !== 1 || secret.algorithm !== "AES-256-GCM") throw new Error("Unsupported secret format");
    const dataKey = Buffer.from(await this.kek.unwrapKey(secret.wrappedKey, projectId));
    try {
      return decryptAesGcm(
        Buffer.from(secret.ciphertext, "base64"),
        dataKey,
        Buffer.from(secret.iv, "base64"),
        Buffer.from(secret.authTag, "base64"),
        `tma:bot-token:v1:${projectId}`,
      ).toString("utf8");
    } finally {
      dataKey.fill(0);
    }
  }
}
