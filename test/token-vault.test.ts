import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EnvelopeTokenVault, LocalAesKek } from "../src/crypto/token-vault.js";

describe("EnvelopeTokenVault", () => {
  const vault = new EnvelopeTokenVault(new LocalAesKek(randomBytes(32).toString("base64"), "test-v1"));

  it("round-trips a token without storing plaintext", async () => {
    const token = "123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK";
    const sealed = await vault.seal(token, "0c4cb150-7c1a-4864-a67e-c2ee64abc2a1");

    expect(JSON.stringify(sealed)).not.toContain(token);
    await expect(vault.open(sealed, "0c4cb150-7c1a-4864-a67e-c2ee64abc2a1")).resolves.toBe(token);
  });

  it("binds ciphertext to its project through authenticated data", async () => {
    const sealed = await vault.seal("123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK", "project-a");
    await expect(vault.open(sealed, "project-b")).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const sealed = await vault.seal("123456789:abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJK", "project-a");
    sealed.ciphertext = `${sealed.ciphertext.slice(0, -4)}AAAA`;
    await expect(vault.open(sealed, "project-a")).rejects.toThrow();
  });
});
