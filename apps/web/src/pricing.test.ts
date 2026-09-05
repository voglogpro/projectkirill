import { describe, expect, it } from "vitest";
import { planFitsKit, priceForKit, suggestedPlan } from "./pricing";

describe("format-based hosting", () => {
  it("does not confuse equal-price text and Mini App plans", () => {
    expect(planFitsKit("trio", "bot")).toBe(true);
    expect(planFitsKit("trio", "bot-app")).toBe(false);
    expect(planFitsKit("trio", "bot-app-site")).toBe(false);
    expect(planFitsKit("solo", "bot-app")).toBe(false);
    expect(planFitsKit("studio", "bot-app")).toBe(true);
    expect(planFitsKit("studio", "bot-app-site")).toBe(true);
  });
  it("suggests the correct paid plan without restricting free editors", () => {
    expect(suggestedPlan("bot")).toBe("solo");
    expect(suggestedPlan("bot-app")).toBe("studio");
    expect(priceForKit("bot")).toBe(350);
    expect(priceForKit("bot-app")).toBe(650);
    expect(priceForKit("bot-app-site")).toBe(650);
    expect(priceForKit("site")).toBe(350);
    expect(planFitsKit("free", "bot")).toBe(false);
  });
});
