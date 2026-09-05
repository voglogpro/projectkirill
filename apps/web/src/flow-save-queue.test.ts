import { describe, expect, it, vi } from "vitest";
import { createFlowSaveQueue } from "./flow-save-queue";
import { createStarterFlow } from "./flow-store";

describe("scenario save queue", () => {
  it("serializes rapid edits against the latest revision and skips unchanged documents", async () => {
    const initial = createStarterFlow();
    const first = { ...initial, metadata: { name: "Первое" } };
    const second = { ...initial, metadata: { name: "Второе" } };
    const write = vi.fn(async (_document, revision: number) => ({ revision: revision + 1 }));
    const queue = createFlowSaveQueue(initial, 4, write);
    await queue.save(initial);
    expect(write).not.toHaveBeenCalled();
    await Promise.all([queue.save(first), queue.save(second), queue.save(second)]);
    expect(write.mock.calls.map((call) => call[1])).toEqual([4, 5]);
    expect(write.mock.calls[1]?.[0]).toBe(second);
  });

  it("reports a failed save and allows retry without advancing revision", async () => {
    const initial = createStarterFlow();
    const next = { ...initial, metadata: { name: "Правка" } };
    const write = vi.fn(async (_document, revision: number) => ({ revision: revision + 1 }))
      .mockRejectedValueOnce(new Error("offline"));
    const queue = createFlowSaveQueue(initial, 3, write);
    await expect(queue.save(next)).rejects.toThrow("offline");
    await queue.save(next);
    expect(write.mock.calls.map((call) => call[1])).toEqual([3, 3]);
  });
});
