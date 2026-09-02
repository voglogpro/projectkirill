import { z } from "zod";

const blockId = z.uuid();
const visibleWhen = z
  .object({
    field: z.string().min(1).max(64),
    operator: z.enum(["eq", "neq"]),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .strict();

const baseBlock = {
  id: blockId,
  version: z.literal(1),
  visibleWhen: visibleWhen.optional(),
};

export const headingBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("heading"),
    props: z
      .object({
        text: z.string().min(1).max(300),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        align: z.enum(["start", "center", "end"]).default("start"),
      })
      .strict(),
  })
  .strict();

export const textBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("text"),
    props: z
      .object({
        // Markdown is sanitized by the renderer; arbitrary HTML is never accepted.
        markdown: z.string().max(20_000),
        tone: z.enum(["default", "secondary", "hint"]).default("default"),
      })
      .strict(),
  })
  .strict();

export const mediaBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("media"),
    props: z
      .object({
        assetId: z.uuid(),
        kind: z.enum(["image", "video"]),
        alt: z.string().max(300).default(""),
        aspectRatio: z.enum(["1:1", "4:3", "16:9", "auto"]).default("auto"),
      })
      .strict(),
  })
  .strict();

const buttonActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.url().max(2048) }).strict(),
  z.object({ kind: z.literal("page"), pageId: z.uuid() }).strict(),
  z.object({ kind: z.literal("telegram"), url: z.string().regex(/^tg:\/\/.+/).max(2048) }).strict(),
]);

export const buttonBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("button"),
    props: z
      .object({
        label: z.string().min(1).max(64),
        style: z.enum(["primary", "secondary", "danger", "link"]),
        action: buttonActionSchema,
        haptic: z.enum(["none", "light", "medium", "heavy"]).default("light"),
        fullWidth: z.boolean().default(true),
      })
      .strict(),
  })
  .strict();

export const productBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("product"),
    props: z
      .object({
        productId: z.string().min(1).max(128),
        title: z.string().min(1).max(200),
        description: z.string().max(2_000).optional(),
        imageAssetId: z.uuid().optional(),
        price: z
          .object({ amountMinor: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) })
          .strict(),
        compareAtPriceMinor: z.number().int().nonnegative().optional(),
        badge: z.string().max(32).optional(),
        cta: z.object({ label: z.string().min(1).max(64), action: buttonActionSchema }).strict(),
      })
      .strict(),
  })
  .strict();

const formFieldSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string().min(1).max(64), kind: z.literal("text"), label: z.string().min(1).max(120), required: z.boolean(), multiline: z.boolean().default(false), maxLength: z.number().int().min(1).max(5000).default(255) }).strict(),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("email"), label: z.string().min(1).max(120), required: z.boolean() }).strict(),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("phone"), label: z.string().min(1).max(120), required: z.boolean() }).strict(),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("select"), label: z.string().min(1).max(120), required: z.boolean(), options: z.array(z.object({ value: z.string().min(1).max(64), label: z.string().min(1).max(120) }).strict()).min(1).max(100) }).strict(),
  z.object({ id: z.string().min(1).max(64), kind: z.literal("checkbox"), label: z.string().min(1).max(300), required: z.boolean() }).strict(),
]);

export const formBlockSchema = z
  .object({
    ...baseBlock,
    type: z.literal("form"),
    props: z
      .object({
        formKey: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
        fields: z.array(formFieldSchema).min(1).max(50),
        submitLabel: z.string().min(1).max(64),
        successMessage: z.string().min(1).max(500),
        hapticOnSuccess: z.boolean().default(true),
      })
      .strict()
      .superRefine((props, context) => {
        const ids = new Set<string>();
        props.fields.forEach((field, index) => {
          if (ids.has(field.id)) {
            context.addIssue({ code: "custom", path: ["fields", index, "id"], message: "Field ids must be unique" });
          }
          ids.add(field.id);
        });
      }),
  })
  .strict();

const atomicBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  mediaBlockSchema,
  buttonBlockSchema,
  productBlockSchema,
  formBlockSchema,
]);

export type AtomicBlock = z.infer<typeof atomicBlockSchema>;
export type Block = AtomicBlock | {
  id: string;
  version: 1;
  type: "section";
  visibleWhen?: z.infer<typeof visibleWhen> | undefined;
  props: {
    gap: "none" | "sm" | "md" | "lg";
    padding: "none" | "sm" | "md" | "lg";
    surface: "transparent" | "secondary" | "accent";
  };
  children: Block[];
};

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.union([
    atomicBlockSchema,
    z
      .object({
        ...baseBlock,
        type: z.literal("section"),
        props: z
          .object({
            gap: z.enum(["none", "sm", "md", "lg"]),
            padding: z.enum(["none", "sm", "md", "lg"]),
            surface: z.enum(["transparent", "secondary", "accent"]),
          })
          .strict(),
        children: z.array(blockSchema).max(100),
      })
      .strict(),
  ]),
);

export const pageDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    metadata: z.object({ title: z.string().min(1).max(200), description: z.string().max(500).optional() }).strict(),
    settings: z
      .object({
        maxWidth: z.enum(["compact", "normal", "wide"]).default("normal"),
        respectTelegramTheme: z.literal(true),
      })
      .strict(),
    blocks: z.array(blockSchema).max(500),
  })
  .strict();

export type PageDocument = z.infer<typeof pageDocumentSchema>;
