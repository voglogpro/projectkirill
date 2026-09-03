/*
 * Assembles the single-file live preview: the production console bundle, the
 * production Mini App renderer and a Telegram client stand-in, all wired to an
 * in-browser backend. Run `node tools/preview/build.mjs` after `npm run build`.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(root, "preview/index.html");

execFileSync("npm", ["exec", "-w", "@tma/miniapp", "--", "vite", "build", "--config", resolve(here, "vite.miniapp.config.ts")], { cwd: root, stdio: "inherit" });

const webDist = resolve(root, "apps/web/dist");
const webIndex = await readFile(resolve(webDist, "index.html"), "utf8");
const assetName = (pattern) => webIndex.match(pattern)?.[1] ?? fail(`missing asset in apps/web/dist/index.html: ${pattern}`);
const base64 = async (path) => (await readFile(path)).toString("base64");

const assets = {
  webJs: await base64(resolve(webDist, assetName(/src="\/(assets\/[^"]+\.js)"/))),
  webCss: await base64(resolve(webDist, assetName(/href="\/(assets\/[^"]+\.css)"/))),
  miniJs: await base64(resolve(here, ".build/miniapp-preview.js")),
  miniCss: await base64(resolve(here, ".build/miniapp-preview.css")),
};

const backend = (await readFile(resolve(here, "backend.js"), "utf8")).replace(/^export /m, "");
const shell = await readFile(resolve(here, "shell.js"), "utf8");
const styles = await readFile(resolve(here, "styles.css"), "utf8");
const markup = await readFile(resolve(here, "markup.html"), "utf8");

const page = `<title>Стенд TMA Studio</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${styles}</style>
${markup}
<script id="preview-assets" type="application/json">${JSON.stringify(assets)}</script>
<script type="module">
${backend}
${shell}</script>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.log(`preview/index.html — ${(Buffer.byteLength(page) / 1024).toFixed(0)} kB`);

function fail(message) { throw new Error(message); }
