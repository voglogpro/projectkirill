# TMA Studio — комплексный MVP

Self-service SaaS-конструктор Telegram Mini Apps: лендинг, личный кабинет, визуальный редактор, общий лёгкий TMA-рендерер, автоматизация Telegram Bot API и тарифы `350 ₽ / 1 бот` и `650 ₽ / 3 бота`.

## Что уже работает

- регистрация, вход, короткий access token и ротация непрозрачных refresh token;
- бесплатное создание одного проекта и редактирование JSON-дерева блоков;
- пять разных стартовых сценариев, onboarding, несколько страниц и готовые секции;
- блоки: заголовок, текст, изображение, кнопка, товар и форма;
- undo/redo, изменение порядка, полный инспектор действий и интерактивный preview;
- облачное автосохранение, восстановление сессии и изолированный локальный demo;
- optimistic locking черновиков, неизменяемые релизы и публичный manifest;
- TMA Core без UI-фреймворка: около `4.2 kB gzip` JavaScript, темы Telegram, `ready/expand`, haptics и Back Button;
- серверная проверка `initData` по HMAC-SHA256 и приём заявок из форм;
- проверка bot token через `getMe`, AES-256-GCM envelope encryption;
- автоматические `setChatMenuButton` и `setWebhook`, секрет webhook, дедупликация updates и worker `/start`;
- тарифные лимиты на сервере, YooKassa checkout и проверка webhook повторным запросом к API провайдера;
- responsive лендинг, кабинет, редактор и трёхшаговый мастер запуска.
- рабочие разделы бота, настроек, помощи и inbox заявок с экспортом CSV;
- публичное приложение и приём форм автоматически закрываются после окончания оплаченного периода.

## Локальный запуск

Нужны Node.js 22+ и PostgreSQL 16+.

```powershell
Copy-Item .env.example .env
npm.cmd install
Get-ChildItem migrations/*.sql | Sort-Object Name | ForEach-Object { psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName }
npm.cmd run dev
npm.cmd run dev:web
npm.cmd run dev:miniapp
```

Адреса по умолчанию:

- API: `http://localhost:3000`
- панель: `http://localhost:4173`
- Mini App demo: `http://localhost:4174/app/demo`

Vite проксирует `/v1` на API. Для настоящего Telegram нужны публичные HTTPS-домены, указанные в `.env`.

## Проверки

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Проверки включают backend, шаблоны конструктора, media-схему и preview manifest. Production-сборка панели — около `84 kB gzip`, TMA Core — около `4.2 kB gzip` JavaScript.

## Production-конфигурация

1. Применить все SQL-файлы из `migrations` по порядку.
2. На BotHost корневой `index.js` сам раздаёт `apps/web/dist` и `apps/miniapp/dist`; отдельный CDN не обязателен.
3. Запустить `index.js` за HTTPS вместе с PostgreSQL/Neon.
4. Передать секреты через secret manager, а `LocalAesKek` заменить адаптером KMS/Vault Transit.
5. Установить `PAYMENT_PROVIDER=yookassa`, `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`.
6. Направить YooKassa webhook на `https://<api>/v1/billing/webhooks/yookassa`.
7. Включить `RUN_TELEGRAM_WORKER=true`.

Первый платёж сохраняет способ оплаты и выдаёт доступ на месяц. Автоматическое списание следующего месяца требует отдельного планировщика продлений и явно не включено в этот MVP; до его добавления продление выполняется новым checkout.

## Что нельзя автоматизировать без владельца

- токен настоящего бота выдаёт только `@BotFather`;
- Telegram принимает только публичные HTTPS URL;
- профильную «Main Mini App» в BotFather владелец настраивает вручную; кнопка меню конкретного бота настраивается платформой автоматически;
- реальные оплаты требуют магазина YooKassa и его секретов.

Подробная модель данных и границы модулей описаны в [ARCHITECTURE.md](./ARCHITECTURE.md), список маршрутов — в [docs/API.md](./docs/API.md).

Инструкция для целевого хостинга: [docs/BOTHOST_DEPLOY.md](./docs/BOTHOST_DEPLOY.md). Корневые `index.js` и `main.js`, автоматические миграции и `Dockerfile` уже подготовлены под Bothost.
