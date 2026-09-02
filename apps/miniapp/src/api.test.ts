import { describe, expect, it } from "vitest";
import { normalizeManifest } from "./api";

describe("Mini App manifest normalization", () => {
  it("normalizes a private preview snapshot without requiring a published release", () => {
    const manifest = normalizeManifest({ project: { publicId: "public", name: "Preview", entryPageId: "home" }, pages: [{ id: "home", slug: "home", title: "Главная", document: { blocks: [] } }] });
    expect(manifest.release).toEqual({ id: "preview", version: 0 });
    expect(manifest.pages[0]?.blocks).toEqual([]);
  });

  it("normalizes a published backend document", () => {
    const manifest = normalizeManifest({ project: { publicId: "public", name: "Live", entryPageId: "home" }, release: { id: "release", version: 2 }, pages: [{ id: "home", slug: "home", title: "Главная", document: { blocks: [] } }] });
    expect(manifest.release.version).toBe(2);
  });
});
