import { describe, expect, it } from "vitest";
import { createBlock, createProjectFromTemplate, templateOptions } from "./store";

describe("builder templates", () => {
  it("creates a distinct and editable document for every visible template", () => {
    const projects = templateOptions.map((template) => createProjectFromTemplate(template.id));
    expect(projects).toHaveLength(5);
    expect(new Set(projects.map((project) => project.name)).size).toBe(5);
    expect(projects.find((project) => project.templateId === "blank")?.pages[0]?.blocks).toEqual([]);
    expect(projects.find((project) => project.templateId === "catalog")?.pages[0]?.blocks.some((block) => block.type === "product")).toBe(true);
    expect(projects.find((project) => project.templateId === "booking")?.pages[0]?.blocks.some((block) => block.type === "form")).toBe(true);
  });

  it("creates a publishable media block that needs no third-party host", () => {
    const media = createBlock("media");
    expect(media.type).toBe("media");
    if (media.type !== "media") return;
    // The backend accepts any parseable URL under 2048 characters; an inline
    // sample also renders inside Telegram without an outbound request.
    expect(media.props.url.startsWith("data:image/svg+xml,")).toBe(true);
    expect(media.props.url.length).toBeLessThan(2048);
    expect(() => new URL(media.props.url)).not.toThrow();
  });

  it("creates form fields with backend-required text defaults", () => {
    const form = createBlock("form");
    expect(form.type).toBe("form");
    if (form.type === "form") expect(form.props.fields[0]).toMatchObject({ kind: "text", multiline: false, maxLength: 120 });
  });
});
