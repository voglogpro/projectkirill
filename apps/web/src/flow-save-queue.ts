import type { BotFlowDocument } from "../../../src/domain/bot-flow";

/** Serial optimistic writes: a later edit must use the revision from the previous save. */
export function createFlowSaveQueue(initial: BotFlowDocument, initialRevision: number,
  write: (document: BotFlowDocument, revision: number) => Promise<{ revision: number }>) {
  let revision = initialRevision;
  let saved = initial;
  let tail: Promise<void> = Promise.resolve();
  return {
    save(document: BotFlowDocument): Promise<void> {
      const job = tail.then(async () => {
        if (document === saved) return;
        const result = await write(document, revision);
        revision = result.revision;
        saved = document;
      });
      // A failed write is reported to its caller but does not poison retries.
      tail = job.catch(() => undefined);
      return job;
    },
  };
}
