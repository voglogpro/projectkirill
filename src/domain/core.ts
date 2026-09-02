import { z } from "zod";
import type { PageDocument } from "./page-document.js";

export const createProjectSchema = z
  .object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().regex(/^[a-z][a-z0-9-]{1,62}[a-z0-9]$/) })
  .strict();

export const updateProjectSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const createPageSchema = z
  .object({ slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,62}$/), title: z.string().trim().min(1).max(200), document: z.unknown() })
  .strict();
export const updatePageSchema = z
  .object({ expectedRevision: z.number().int().positive(), title: z.string().trim().min(1).max(200), document: z.unknown() })
  .strict();
export const previewGrantSchema = z.object({ ttlSeconds: z.number().int().min(60).max(86_400).default(3_600) }).strict();

export interface ProjectRecord {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "suspended";
  entryPageId: string | null;
  publishedReleaseId: string | null;
  updatedAt: string;
}

export interface PageRecord {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  document: PageDocument;
  revision: number;
  updatedAt: string;
}

export interface ProjectSnapshot {
  project: ProjectRecord;
  pages: PageRecord[];
}

export interface PublicAppManifest {
  project: { publicId: string; name: string; entryPageId: string };
  release: { id: string; version: number; contentHash: string; publishedAt: string };
  pages: Array<{ id: string; slug: string; title: string; document: PageDocument }>;
}
