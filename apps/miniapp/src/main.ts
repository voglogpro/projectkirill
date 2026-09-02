import { loadManifest } from "./api";
import { renderApp, skeleton, stateScreen } from "./renderer";
import { telegram } from "./telegram";
import "./styles.css";

const root = document.getElementById("app");
if (root === null) throw new Error("App root is missing");
telegram.initialize(); root.append(skeleton());
const publicId = location.pathname.match(/\/(?:app|tma)\/([^/]+)/)?.[1] ?? new URLSearchParams(location.search).get("project") ?? "demo";
const preview = new URLSearchParams(location.search).get("preview") ?? undefined;
void loadManifest(publicId, preview).then((manifest) => { document.title = manifest.project.name; renderApp(root, manifest); }).catch((reason: unknown) => { const screen = stateScreen("Не удалось открыть", reason instanceof Error ? reason.message : "Ошибка загрузки"); const retry = document.createElement("button"); retry.textContent = "Попробовать снова"; retry.addEventListener("click", () => location.reload()); screen.append(retry); root.replaceChildren(screen); });
