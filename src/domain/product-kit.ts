import { z } from "zod";

export const productKitSchema = z.enum(["bot", "bot-app", "bot-app-site", "site"]);
export type ProductKit = z.infer<typeof productKitSchema>;
export const hasMiniApp = (kit: ProductKit): boolean => kit === "bot-app" || kit === "bot-app-site";
