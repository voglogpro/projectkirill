export type BlockType = "heading" | "text" | "button" | "product" | "form" | "media";
export type TemplateId = "catalog" | "booking" | "leads" | "services" | "blank";
/** What the owner set out to build: the choice made on the start screen. */
export type ProductKit = "bot" | "bot-app" | "bot-app-site" | "site";
export type BuilderTab = "blocks" | "pages" | "sections";
export type DashboardSection = "overview" | "flow" | "bot" | "leads" | "design" | "settings" | "help";
export type BotConnectionStatus = "configuring" | "active" | "error" | "revoked";

export type BlockAction =
  | { kind: "url"; url: string }
  | { kind: "telegram"; url: string }
  | { kind: "page"; pageId: string };

export type FormField =
  | { id: string; kind: "text"; label: string; required: boolean; multiline: boolean; maxLength: number }
  | { id: string; kind: "email" | "phone" | "checkbox"; label: string; required: boolean }
  | { id: string; kind: "select"; label: string; required: boolean; options: Array<{ value: string; label: string }> };

interface BaseBlock { id: string; version: 1 }
export interface HeadingBlock extends BaseBlock { type: "heading"; props: { text: string; level: 1 | 2 | 3; align: "start" | "center" | "end" } }
export interface TextBlock extends BaseBlock { type: "text"; props: { markdown: string; tone: "default" | "secondary" | "hint" } }
export interface ButtonBlock extends BaseBlock { type: "button"; props: { label: string; style: "primary" | "secondary" | "danger" | "link"; action: BlockAction; haptic: "none" | "light" | "medium" | "heavy"; fullWidth: boolean } }
export interface MediaBlock extends BaseBlock { type: "media"; props: { kind: "image"; url: string; alt: string; aspectRatio: "1:1" | "4:3" | "16:9" | "auto" } }
export interface ProductBlock extends BaseBlock { type: "product"; props: { productId: string; title: string; description?: string; price: { amountMinor: number; currency: string }; badge?: string; cta: { label: string; action: BlockAction } } }
export interface FormBlock extends BaseBlock { type: "form"; props: { formKey: string; fields: FormField[]; submitLabel: string; successMessage: string; hapticOnSuccess: boolean } }
export type BuilderBlock = HeadingBlock | TextBlock | ButtonBlock | MediaBlock | ProductBlock | FormBlock;

export interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  blocks: BuilderBlock[];
  remoteRevision?: number;
}

export interface ProjectState {
  /** A free, isolated browser draft. Never autosave it over a cloud project. */
  storageMode?: "local-preview";
  id: string;
  name: string;
  status: "draft" | "active" | "suspended";
  pages: BuilderPage[];
  activePageId?: string;
  botUsername?: string;
  miniAppUrl?: string;
  botStatus?: BotConnectionStatus;
  plan: "free" | "solo" | "trio";
  templateId?: TemplateId;
  kit?: ProductKit;
  updatedAt?: string;
  previewed?: boolean;
  hasPendingChanges?: boolean;
}

export interface Lead {
  id: string;
  formKey: string;
  pageTitle: string;
  telegramUserId?: string;
  values: Record<string, string | boolean>;
  createdAt: string;
}
