// Preview-only entry: exposes the production Mini App renderer so the live
// preview shell can mount a manifest without a real Telegram host or URL route.
import { renderApp } from "../../apps/miniapp/src/renderer";
import { telegram } from "../../apps/miniapp/src/telegram";
import type { AppManifest } from "../../apps/miniapp/src/types";
import "../../apps/miniapp/src/styles.css";

declare global {
  interface Window { __renderMiniApp?: (root: HTMLElement, manifest: AppManifest) => void }
}

window.__renderMiniApp = (root, manifest) => {
  telegram.initialize();
  renderApp(root, manifest);
};
