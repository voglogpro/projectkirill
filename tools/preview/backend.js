/*
 * In-browser stand-in for the TMA Studio API, used only by the live preview
 * shell. It mirrors the routes in docs/API.md closely enough that the real
 * production console bundle runs unmodified against it: same envelopes, same
 * error codes, same optimistic-locking rules. Nothing here ships to users.
 */
export function createBackend(notify) {
  const STORAGE_KEY = "tma-studio-preview-state-v1";
  const PLANS = [
    { code: "free", name: "Бесплатный", monthlyPriceMinor: 0, currency: "RUB", maxProjects: 1, maxActiveBots: 0, supportedKits: [] },
    { code: "solo", name: "Один текстовый бот", monthlyPriceMinor: 35000, currency: "RUB", maxProjects: 1, maxActiveBots: 1, supportedKits: ["bot", "site"] },
    { code: "trio", name: "Три текстовых бота", monthlyPriceMinor: 65000, currency: "RUB", maxProjects: 3, maxActiveBots: 3, supportedKits: ["bot"] },
    { code: "studio", name: "Студия", monthlyPriceMinor: 65000, currency: "RUB", maxProjects: 1, maxActiveBots: 1, supportedKits: ["bot", "bot-app", "bot-app-site", "site"] },
  ];
  const ORIGIN = "https://apps.tmastudio.ru";

  const state = load() ?? seed();
  for (const project of state.projects) {
    if (project.kit === undefined) {
      project.kit = "bot-app-site";
      project.legacyFullAccessUntil = state.entitlements[project.ownerId]?.validUntil;
    }
  }
  save();

  function seed() {
    const userId = uuid();
    return {
      users: [{ id: userId, displayName: "Кирилл", email: "demo@tmastudio.ru", password: "DemoPass123!" }],
      tokens: { "preview-access-token": userId },
      projects: [], pages: [], releases: [], bots: [], submissions: [], flows: {},
      entitlements: {}, checkouts: [],
    };
  }
  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw === null ? undefined : JSON.parse(raw); } catch { return undefined; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* preview keeps working from memory */ }
  }
  function changed() { save(); notify(snapshot()); }

  function uuid() { return crypto.randomUUID(); }
  function now() { return new Date().toISOString(); }
  function ok(data, status = 200) { return { status, body: { data } }; }
  function fail(status, code, message) { return { status, body: { error: { code, message } } }; }

  function userFor(init) {
    const header = new Headers(init?.headers ?? {}).get("authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "");
    const id = state.tokens[token];
    return id === undefined ? undefined : state.users.find((user) => user.id === id);
  }
  function entitlementFor(userId) {
    const granted = state.entitlements[userId];
    const active = granted !== undefined && Date.parse(granted.validUntil) > Date.now();
    const plan = PLANS.find((item) => item.code === (active ? granted.planCode : "free"));
    return { planCode: plan.code, maxProjects: plan.maxProjects, maxActiveBots: plan.maxActiveBots, supportedKits: plan.supportedKits, canPublish: plan.maxActiveBots > 0, ...(active ? { validUntil: granted.validUntil } : {}) };
  }
  function canLaunch(project) {
    const entitlement = entitlementFor(project.ownerId);
    return entitlement.canPublish && (entitlement.supportedKits.includes(project.kit) || Date.parse(project.legacyFullAccessUntil ?? "") > Date.now());
  }
  function projectFor(user, projectId) { return state.projects.find((item) => item.id === projectId && item.ownerId === user.id); }
  function publicProject(project) {
    // Old saved preview fixtures predate entryPageId. Resolve only this project's
    // own pages, matching the production ProjectRecord without a data migration.
    const entry = state.pages.find((page) => page.projectId === project.id && page.id === project.entryPageId)
      ?? state.pages.find((page) => page.projectId === project.id);
    return { id: project.id, publicId: project.publicId, name: project.name, slug: project.slug, kit: project.kit, legacyFullAccessUntil: project.legacyFullAccessUntil, entryPageId: entry?.id ?? null, status: project.status, publishedReleaseId: project.publishedReleaseId ?? null, updatedAt: project.updatedAt };
  }
  function pageBody(page) { return { id: page.id, projectId: page.projectId, slug: page.slug, title: page.title, document: page.document, revision: page.revision, updatedAt: page.updatedAt }; }
  function emptyDocument(title) { return { schemaVersion: 1, metadata: { title }, settings: { maxWidth: "normal", respectTelegramTheme: true }, blocks: [] }; }

  function snapshot() {
    const project = state.projects[state.projects.length - 1];
    if (project === undefined) return { project: undefined };
    const bot = state.bots.find((item) => item.projectId === project.id);
    const release = state.releases.filter((item) => item.projectId === project.id).at(-1);
    return {
      project: { id: project.id, name: project.name, publicId: project.publicId, status: project.status },
      bot,
      draft: manifestFrom(project, state.pages.filter((page) => page.projectId === project.id), { id: "draft", version: 0 }),
      published: release === undefined ? undefined : manifestFrom(project, release.pages, { id: release.id, version: release.version }),
      submissions: state.submissions.filter((item) => item.projectId === project.id).length,
    };
  }
  function manifestFrom(project, pages, release) {
    const ordered = [...pages];
    return {
      project: { publicId: project.publicId, name: project.name },
      release,
      entryPageId: ordered[0]?.id ?? "",
      pages: ordered.map((page) => ({ id: page.id, slug: page.slug, title: page.title, blocks: page.document.blocks ?? [] })),
    };
  }

  /** Routes a console request. Returns { status, body } — never throws. */
  function handle(rawUrl, init = {}) {
    const method = (init.method ?? "GET").toUpperCase();
    const url = new URL(String(rawUrl), "https://console.tmastudio.ru");
    const path = url.pathname;
    let payload = {};
    try { payload = init.body === undefined || init.body === null ? {} : JSON.parse(String(init.body)); } catch { payload = {}; }

    if (path === "/v1/auth/register" && method === "POST") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      if (state.users.some((user) => user.email === email)) return fail(409, "EMAIL_TAKEN", "Этот адрес уже зарегистрирован");
      const user = { id: uuid(), displayName: String(payload.displayName ?? "Пользователь"), email, password: String(payload.password ?? "") };
      state.users.push(user); changed();
      return ok(issue(user));
    }
    if (path === "/v1/auth/login" && method === "POST") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const user = state.users.find((item) => item.email === email && item.password === String(payload.password ?? ""));
      if (user === undefined) return fail(401, "INVALID_CREDENTIALS", "Неверная почта или пароль");
      return ok(issue(user));
    }
    if (path === "/v1/auth/refresh" && method === "POST") {
      const userId = state.tokens[String(payload.refreshToken ?? "")];
      const user = state.users.find((item) => item.id === userId);
      return user === undefined ? fail(401, "INVALID_REFRESH_TOKEN", "Сессия истекла") : ok(issue(user));
    }
    if (path === "/v1/auth/logout" && method === "POST") return { status: 204, body: undefined };
    if (path === "/v1/billing/plans" && method === "GET") return ok(PLANS);

    if (path.startsWith("/v1/public/apps/")) {
      const [, publicId, tail] = path.match(/^\/v1\/public\/apps\/([^/]+)(\/forms)?$/) ?? [];
      const project = state.projects.find((item) => item.publicId === publicId);
      if (project === undefined) return fail(404, "NOT_FOUND", "Приложение не найдено");
      if (!canLaunch(project) || project.kit === "bot") return fail(404, "NOT_FOUND", "Приложение недоступно на текущем тарифе");
      const surface = url.searchParams.get("surface") === "site" ? "site" : "miniapp";
      if (surface === "site" ? !["site", "bot-app-site"].includes(project.kit) : !["bot-app", "bot-app-site"].includes(project.kit)) return fail(404, "NOT_FOUND", "Этот формат не опубликован");
      if (tail === "/forms" && method === "POST") {
        const page = state.pages.find((item) => item.id === payload.pageId) ?? state.pages.find((item) => item.projectId === project.id);
        state.submissions.push({ id: uuid(), projectId: project.id, pageId: payload.pageId, pageTitle: page?.title ?? "Главная", formKey: String(payload.formKey ?? "form"), telegramUserId: "570123456", values: payload.values ?? {}, createdAt: now() });
        changed();
        return ok({ accepted: true }, 202);
      }
      const release = state.releases.filter((item) => item.projectId === project.id).at(-1);
      if (release === undefined) return fail(404, "NOT_FOUND", "Приложение не найдено");
      return ok({ project: { publicId: project.publicId, name: project.name, entryPageId: release.pages[0]?.id ?? "" }, release: { id: release.id, version: release.version }, pages: release.pages.map((page) => ({ id: page.id, slug: page.slug, title: page.title, document: page.document })) });
    }

    const user = userFor(init);
    if (user === undefined) return fail(401, "UNAUTHORIZED", "Требуется вход");

    if (path === "/v1/billing/entitlement" && method === "GET") return ok(entitlementFor(user.id));
    if (path === "/v1/billing/checkouts" && method === "POST") {
      const plan = PLANS.find((item) => item.code === payload.planCode);
      if (plan === undefined || plan.code === "free") return fail(422, "VALIDATION_ERROR", "Неизвестный тариф");
      const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      state.entitlements[user.id] = { planCode: plan.code, validUntil };
      state.checkouts.push({ id: uuid(), planCode: plan.code, status: "succeeded", createdAt: now() });
      changed();
      // The preview uses the mock provider, which settles instantly and returns
      // no confirmation URL, so the launch wizard skips the payment page.
      return ok({ checkoutId: state.checkouts.at(-1).id, status: "succeeded" });
    }

    if (path === "/v1/projects" && method === "GET") return ok(state.projects.filter((item) => item.ownerId === user.id).map(publicProject));
    if (path === "/v1/projects" && method === "POST") {
      const limit = entitlementFor(user.id).maxProjects;
      const owned = state.projects.filter((item) => item.ownerId === user.id);
      if (owned.length >= limit) return fail(403, "PLAN_LIMIT_REACHED", `Текущий тариф разрешает ${limit} проект(а)`);
      const entryPageId = uuid();
      const project = { id: uuid(), ownerId: user.id, name: String(payload.name ?? "Новый проект"), kit: payload.kit ?? "bot", slug: String(payload.slug ?? `project-${Date.now()}`), publicId: `app${Math.random().toString(36).slice(2, 10)}`, entryPageId, status: "draft", publishedReleaseId: null, updatedAt: now() };
      state.projects.push(project);
      state.pages.push({ id: entryPageId, projectId: project.id, slug: "home", title: "Главная", document: emptyDocument("Главная"), revision: 1, updatedAt: now() });
      changed();
      return ok(publicProject(project), 201);
    }

    const projectMatch = path.match(/^\/v1\/projects\/([^/]+)(?:\/(pages|publish|submissions|preview-grants|flow))?(?:\/([^/]+))?$/);
    if (projectMatch) {
      const [, projectId, section, pageId] = projectMatch;
      const project = projectFor(user, projectId);
      if (project === undefined) return fail(404, "NOT_FOUND", "Проект не найден");
      const pages = () => state.pages.filter((item) => item.projectId === project.id);

      if (section === undefined && method === "GET") return ok(publicProject(project));
      if (section === undefined && method === "PATCH") {
        project.name = String(payload.name ?? project.name);
        if (payload.kit !== undefined && payload.kit !== project.kit) { project.kit = payload.kit; project.legacyFullAccessUntil = undefined; }
        project.updatedAt = now(); changed(); return ok(publicProject(project));
      }
      if (section === "pages" && method === "GET") return ok(pages().map(pageBody));
      if (section === "pages" && method === "POST") {
        const page = { id: uuid(), projectId: project.id, slug: String(payload.slug ?? `page-${Date.now()}`), title: String(payload.title ?? "Страница"), document: payload.document ?? emptyDocument("Страница"), revision: 1, updatedAt: now() };
        state.pages.push(page); project.updatedAt = now(); changed();
        return ok(pageBody(page), 201);
      }
      if (section === "pages" && method === "PUT") {
        const page = pages().find((item) => item.id === pageId);
        if (page === undefined) return fail(404, "NOT_FOUND", "Страница не найдена");
        if (payload.expectedRevision !== undefined && payload.expectedRevision !== page.revision) return fail(409, "REVISION_CONFLICT", "Страница изменена в другой вкладке — обновите её");
        page.title = String(payload.title ?? page.title);
        page.document = payload.document ?? page.document;
        page.revision += 1; page.updatedAt = now(); project.updatedAt = now();
        changed();
        return ok(pageBody(page));
      }
      if (section === "pages" && method === "DELETE") {
        if (pages().length <= 1) return fail(409, "LAST_PAGE", "В проекте должна остаться хотя бы одна страница");
        state.pages = state.pages.filter((item) => item.id !== pageId); changed();
        return { status: 204, body: undefined };
      }
      if (section === "flow" && pageId === undefined && method === "GET") {
        state.flows[project.id] ??= { document: seedFlow(), revision: 1, versions: [] };
        changed();
        return ok(flowBody(project.id));
      }
      if (section === "flow" && pageId === undefined && method === "PUT") {
        const flow = (state.flows[project.id] ??= { document: seedFlow(), revision: 1, versions: [] });
        if (payload.expectedRevision !== flow.revision) return fail(409, "REVISION_CONFLICT", "Сценарий изменён в другой вкладке — обновите страницу");
        flow.document = payload.document; flow.revision += 1; changed();
        return ok(flowBody(project.id));
      }
      if (section === "flow" && pageId === "publish" && method === "POST") {
        if (!canLaunch(project)) return fail(403, "PLAN_LIMIT_REACHED", "Выберите тариф для формата проекта");
        const flow = state.flows[project.id];
        if (flow === undefined) return fail(404, "NOT_FOUND", "Сценарий не найден");
        flow.versions.push(JSON.parse(JSON.stringify(flow.document)));
        changed();
        return ok({ versionId: uuid(), version: flow.versions.length });
      }
      if (section === "preview-grants" && method === "POST") return ok({ token: `preview-${uuid()}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() });
      if (section === "submissions" && method === "GET") return ok(state.submissions.filter((item) => item.projectId === project.id).slice(-500).reverse().map((item) => ({ id: item.id, formKey: item.formKey, pageTitle: item.pageTitle, telegramUserId: item.telegramUserId, values: item.values, createdAt: item.createdAt })));
      if (section === "publish" && method === "POST") {
        if (!canLaunch(project)) return fail(403, "PLAN_LIMIT_REACHED", "Для этого формата нужен подходящий платный тариф");
        const version = state.releases.filter((item) => item.projectId === project.id).length + 1;
        const release = { id: uuid(), projectId: project.id, version, createdAt: now(), pages: JSON.parse(JSON.stringify(pages())) };
        state.releases.push(release);
        project.publishedReleaseId = release.id; project.status = "active"; project.updatedAt = now();
        changed();
        return ok({ project: { publicId: project.publicId }, release: { id: release.id, version } });
      }
    }

    if (path === "/v1/bot-connections/validate" && method === "POST") {
      const bot = parseToken(String(payload.botToken ?? ""));
      return bot === undefined ? fail(422, "INVALID_BOT_TOKEN", "Telegram не принял этот токен") : ok(bot);
    }
    if (path.startsWith("/v1/bot-connections/") && method === "GET") {
      const bot = state.bots.find((item) => item.projectId === path.split("/").pop());
      return ok(bot === undefined ? null : { botUsername: bot.username, miniAppUrl: bot.miniAppUrl, status: bot.status });
    }
    if (path === "/v1/bot-connections" && method === "POST") {
      const project = projectFor(user, String(payload.projectId ?? ""));
      if (project === undefined) return fail(404, "NOT_FOUND", "Проект не найден");
      const entitlement = entitlementFor(user.id);
      if (!canLaunch(project)) return fail(403, "PLAN_LIMIT_REACHED", "Подключение доступно на подходящем платном тарифе");
      const parsed = parseToken(String(payload.botToken ?? ""));
      if (parsed === undefined) return fail(422, "INVALID_BOT_TOKEN", "Telegram не принял этот токен");
      if (state.bots.some((item) => item.botId === parsed.botId && item.projectId !== project.id)) return fail(409, "BOT_ALREADY_CONNECTED", "Этот бот уже подключён к другому проекту");
      const bot = { projectId: project.id, botId: parsed.botId, username: parsed.username, firstName: parsed.firstName, status: "active", miniAppUrl: project.kit === "bot" || project.kit === "site" ? "" : `${ORIGIN}/app/${project.publicId}`, menuButtonText: String(payload.menuButtonText ?? "Открыть приложение") };
      state.bots = [...state.bots.filter((item) => item.projectId !== project.id), bot];
      changed();
      return ok({ botId: bot.botId, botUsername: bot.username, miniAppUrl: bot.miniAppUrl, status: "active" });
    }

    return fail(404, "NOT_FOUND", "Route not found");
  }

  function flowBody(projectId) {
    const flow = state.flows[projectId];
    return { document: flow.document, revision: flow.revision, ...(flow.versions.length === 0 ? {} : { publishedVersion: flow.versions.length }), updatedAt: now() };
  }
  /** Smallest valid scenario, mirroring createEmptyBotFlow on the server. */
  function seedFlow() {
    const start = uuid(), hello = uuid();
    return {
      schemaVersion: 1,
      metadata: { name: "Мой бот" },
      nodes: [
        { id: start, version: 1, position: { x: 0, y: 0 }, type: "start", props: { command: "start", description: "Первое сообщение" } },
        { id: hello, version: 1, position: { x: 0, y: 140 }, type: "message", props: { text: "Здравствуйте! Чем помочь?", buttons: [] } },
      ],
      edges: [{ id: "start-hello", from: start, fromHandle: "next", to: hello }],
    };
  }

  function issue(user) {
    const accessToken = `access-${uuid()}`;
    const refreshToken = `refresh-${uuid()}`;
    state.tokens[accessToken] = user.id; state.tokens[refreshToken] = user.id; save();
    return { accessToken, refreshToken, user: { id: user.id, displayName: user.displayName, email: user.email } };
  }
  /** Mirrors the shape @BotFather issues; the preview never calls Telegram. */
  function parseToken(token) {
    const trimmed = token.trim();
    if (trimmed.length < 20) return undefined;
    const numeric = trimmed.match(/^(\d{6,})/);
    const botId = numeric ? numeric[1] : String(7_000_000_000 + (hash(trimmed) % 900_000_000));
    const suffix = String(botId).slice(-4);
    return { botId, firstName: "Мой Mini App", username: `tma_studio_${suffix}_bot` };
  }
  function hash(value) { let result = 0; for (const character of value) result = (result * 31 + character.codePointAt(0)) >>> 0; return result; }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    location.reload();
  }

  return { handle, snapshot, reset, demoUser: () => ({ email: state.users[0].email, password: state.users[0].password }), sessionFor: () => issue(state.users[0]) };
}
