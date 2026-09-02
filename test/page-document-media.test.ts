import { describe, expect, it } from "vitest";
import { pageDocumentSchema } from "../src/domain/page-document.js";

const base = { schemaVersion: 1 as const, metadata: { title: "Главная" }, settings: { maxWidth: "normal" as const, respectTelegramTheme: true as const } };

describe("page media document", () => {
  it("accepts the URL-backed image contract used by BotHost", () => {
    const document = pageDocumentSchema.parse({ ...base, blocks: [{ id: crypto.randomUUID(), version: 1, type: "media", props: { kind: "image", url: "https://example.com/image.webp", alt: "Товар", aspectRatio: "16:9" } }] });
    expect(document.blocks[0]?.type).toBe("media");
  });

  it("rejects an empty or non-URL media source", () => {
    expect(() => pageDocumentSchema.parse({ ...base, blocks: [{ id: crypto.randomUUID(), version: 1, type: "media", props: { kind: "image", url: "", alt: "", aspectRatio: "auto" } }] })).toThrow();
  });
});
