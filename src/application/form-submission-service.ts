import { z } from "zod";
import type { CoreService } from "./core-service.js";
import type { EnvelopeTokenVault, SealedSecret } from "../crypto/token-vault.js";
import { DomainError, NotFoundError } from "../domain/errors.js";
import type { Block } from "../domain/page-document.js";
import { validateTelegramInitData } from "../telegram/init-data-validator.js";

const submitSchema = z.object({
  pageId: z.uuid(),
  formKey: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  values: z.record(z.string().min(1).max(64), z.union([z.string().max(5_000), z.boolean()])),
}).strict();

const sealedSecretSchema: z.ZodType<SealedSecret> = z.object({
  version: z.literal(1), algorithm: z.literal("AES-256-GCM"), ciphertext: z.string(), iv: z.string(), authTag: z.string(),
  wrappedKey: z.object({ keyId: z.string(), ciphertext: z.string(), iv: z.string(), authTag: z.string() }),
});

export interface FormConnection { projectId: string; encryptedToken: unknown }
export interface FormSubmissionRepository {
  getActiveConnection(publicId: string): Promise<FormConnection | null>;
  store(input: { requestId: string; projectId: string; pageId: string; formKey: string; telegramUserId?: string; values: Record<string, string | boolean> }): Promise<"stored" | "duplicate">;
  listOwned(ownerUserId: string, projectId: string): Promise<Array<{ id: string; formKey: string; pageTitle: string; telegramUserId?: string; values: Record<string, string | boolean>; createdAt: string }>>;
}

export class FormSubmissionError extends DomainError {
  public constructor(code: string, message: string, status = 422) { super(code, message, status); }
}

export class FormSubmissionService {
  public constructor(private readonly repository: FormSubmissionRepository, private readonly core: CoreService, private readonly vault: EnvelopeTokenVault) {}

  public async submit(publicId: string, requestId: string, initData: string, untrustedInput: unknown) {
    const parsedPublicId = z.uuid().parse(publicId); z.uuid().parse(requestId);
    const input = submitSchema.parse(untrustedInput);
    const [manifest, connection] = await Promise.all([this.core.getPublicApp(parsedPublicId), this.repository.getActiveConnection(parsedPublicId)]);
    if (connection === null) throw new NotFoundError("Application is not active");
    const token = await this.vault.open(sealedSecretSchema.parse(connection.encryptedToken), connection.projectId);
    let telegramUserId: string | undefined;
    try { const validated = validateTelegramInitData(initData, token); telegramUserId = validated.user === undefined ? undefined : String(validated.user.id); }
    catch { throw new FormSubmissionError("INVALID_TELEGRAM_SESSION", "Telegram session is invalid or expired", 401); }

    const page = manifest.pages.find((candidate) => candidate.id === input.pageId);
    if (page === undefined) throw new FormSubmissionError("FORM_NOT_FOUND", "Form not found", 404);
    const form = findForm(page.document.blocks, input.formKey);
    if (form === undefined) throw new FormSubmissionError("FORM_NOT_FOUND", "Form not found", 404);
    const normalized = validateValues(form.props.fields, input.values);
    const outcome = await this.repository.store({ requestId, projectId: connection.projectId, pageId: input.pageId, formKey: input.formKey, ...(telegramUserId === undefined ? {} : { telegramUserId }), values: normalized });
    return { accepted: true, duplicate: outcome === "duplicate" } as const;
  }

  public list(ownerUserId: string, projectId: string) {
    return this.repository.listOwned(z.uuid().parse(ownerUserId), z.uuid().parse(projectId));
  }
}

function findForm(blocks: Block[], formKey: string): Extract<Block, { type: "form" }> | undefined {
  const stack = [...blocks];
  while (stack.length > 0) { const block = stack.pop(); if (block === undefined) break; if (block.type === "section") stack.push(...block.children); else if (block.type === "form" && block.props.formKey === formKey) return block; }
  return undefined;
}

function validateValues(fields: Extract<Block, { type: "form" }>["props"]["fields"], values: Record<string, string | boolean>) {
  const allowed = new Map(fields.map((field) => [field.id, field]));
  for (const key of Object.keys(values)) if (!allowed.has(key)) throw new FormSubmissionError("UNKNOWN_FORM_FIELD", `Unknown form field: ${key}`);
  for (const field of fields) {
    const value = values[field.id];
    if (field.required && (value === undefined || value === "" || value === false)) throw new FormSubmissionError("REQUIRED_FORM_FIELD", `Required field is missing: ${field.id}`);
    if (value === undefined) continue;
    if (field.kind === "checkbox" && typeof value !== "boolean") throw new FormSubmissionError("INVALID_FORM_FIELD", `Field ${field.id} must be boolean`);
    if (field.kind !== "checkbox" && typeof value !== "string") throw new FormSubmissionError("INVALID_FORM_FIELD", `Field ${field.id} must be text`);
    if (field.kind === "email" && typeof value === "string" && !z.email().safeParse(value).success) throw new FormSubmissionError("INVALID_FORM_FIELD", `Field ${field.id} must be an email`);
    if (field.kind === "select" && typeof value === "string" && !field.options.some((option) => option.value === value)) throw new FormSubmissionError("INVALID_FORM_FIELD", `Field ${field.id} has an unknown option`);
  }
  return values;
}
