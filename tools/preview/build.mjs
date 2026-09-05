/*
 * Assembles the single-file live preview: the production console bundle, the
 * production Mini App renderer and a Telegram client stand-in, all wired to an
 * in-browser backend. Run `node tools/preview/build.mjs` after `npm run build`.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(root, "preview/index.html");

// Launch Node directly: npm is a .cmd launcher on Windows, not an executable.
const miniRequire = createRequire(resolve(root, "apps/miniapp/package.json"));
const viteBin = resolve(dirname(miniRequire.resolve("vite/package.json")), "bin/vite.js");
execFileSync(process.execPath, [viteBin, "build", "--config", resolve(here, "vite.miniapp.config.ts")], { cwd: resolve(root, "apps/miniapp"), stdio: "inherit" });

const webDist = resolve(root, "apps/web/dist");
const webIndex = await readFile(resolve(webDist, "index.html"), "utf8");
const assetName = (pattern) => webIndex.match(pattern)?.[1] ?? fail(`missing asset in apps/web/dist/index.html: ${pattern}`);
const base64 = async (path) => (await readFile(path)).toString("base64");

// The stand serves nothing from /public, so the files the console references by
// absolute path are inlined into the bundle it hands the iframe.
const publicDir = resolve(root, "apps/web/public");
const dataUri = async (path, type) => `data:${type};base64,${await base64(resolve(publicDir, path))}`;
const inlinePublic = async (text) => {
  let result = text;
  for (const [path, type] of [["media/kira-build.webm", "video/webm"], ["media/kira-build.mp4", "video/mp4"], ["media/kira-build-poster.jpg", "image/jpeg"], ["media/kira-build-tall.webm", "video/webm"], ["media/kira-build-tall.mp4", "video/mp4"], ["media/kira-build-tall-poster.jpg", "image/jpeg"]]) {
    result = result.replaceAll(`/${path}`, await dataUri(path, type));
  }
  for (const name of await readdir(resolve(publicDir, "fonts"))) {
    result = result.replaceAll(`/fonts/${name}`, await dataUri(`fonts/${name}`, "font/woff2"));
  }
  return result;
};

const assets = {
  webJs: Buffer.from(await inlinePublic(await readFile(resolve(webDist, assetName(/src="\/(assets\/[^"]+\.js)"/)), "utf8"))).toString("base64"),
  webCss: Buffer.from(await inlinePublic(await readFile(resolve(webDist, assetName(/href="\/(assets\/[^"]+\.css)"/)), "utf8"))).toString("base64"),
  miniJs: await base64(resolve(here, ".build/miniapp-preview.js")),
  miniCss: await base64(resolve(here, ".build/miniapp-preview.css")),
};

const backend = (await readFile(resolve(here, "backend.js"), "utf8")).replace(/^export /m, "");
// The compiled scenario interpreter has no runtime imports, so the stand can run
// the production file itself rather than a copy that could drift from it.
const runtimePath = resolve(root, "dist/domain/bot-flow-runtime.js");
const runtime = (await readFile(runtimePath, "utf8").catch(() => fail(`run "npm run build" first: ${runtimePath} is missing`))).replaceAll(/^export /gm, "");
const shell = await readFile(resolve(here, "shell.js"), "utf8");
const styles = await readFile(resolve(here, "styles.css"), "utf8");
const markup = await readFile(resolve(here, "markup.html"), "utf8");

const page = `<title>Стенд KIRA</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${styles}</style>
${markup}
<script id="preview-assets" type="application/json">${JSON.stringify(assets)}</script>
<script type="module">
${runtime}
${backend}
${shell}</script>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.log(`preview/index.html — ${(Buffer.byteLength(page) / 1024).toFixed(0)} kB`);

function fail(message) { throw new Error(message); }
