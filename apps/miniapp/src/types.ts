export interface AppBlock { id: string; version: 1; type: "heading" | "text" | "button" | "media" | "product" | "form" | "section"; props: Record<string, unknown>; children?: AppBlock[] }
export interface AppPage { id: string; slug: string; title: string; blocks: AppBlock[] }
export interface AppManifest { project: { publicId: string; name: string }; release: { id: string; version: number }; pages: AppPage[]; entryPageId: string }
