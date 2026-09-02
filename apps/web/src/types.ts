export type BlockType = "heading" | "text" | "button" | "product" | "form" | "media";

export interface BuilderBlock {
  id: string;
  version: 1;
  type: BlockType;
  props: Record<string, unknown>;
}

export interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  blocks: BuilderBlock[];
}

export interface ProjectState {
  id: string;
  name: string;
  status: "draft" | "ready" | "active";
  pages: BuilderPage[];
  botUsername?: string;
  plan: "free" | "solo" | "trio";
  remoteRevision?: number;
}
