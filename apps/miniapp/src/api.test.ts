import { afterEach, describe, expect, it, vi } from "vitest";
import { loadManifest, normalizeManifest } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("Mini App manifest normalization", () => {
  it("identifies the public site surface but not private previews", async () => {
    vi.stubGlobal("location", { origin: "https://kira.example", pathname: "/s/public" });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ data: { project: { publicId: "public", name: "Site" }, pages: [], release: { id: "r", version: 1 }, entryPageId: "home" } })));
    vi.stubGlobal("fetch", fetchMock);
    await loadManifest("public");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("?surface=site");
    await loadManifest("public", "private-preview");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("surface=site");
  });
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
