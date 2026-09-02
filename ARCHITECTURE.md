# Архитектура TMA Studio MVP

## Выбранный стек

| Слой | Основной выбор | Почему |
|---|---|---|
| Backend/API | Node.js 22+, TypeScript, Fastify, Zod | Telegram API и PostgreSQL — I/O-bound нагрузка; один процесс обслуживает много запросов, Fastify имеет небольшой overhead, а TypeScript/Zod дают общий контракт от БД до редактора. Сервис stateless и горизонтально масштабируется. |
| Панель конструктора | React + Vite | Панель загружается вне критического TMA-пути; React ускоряет разработку редактора и не увеличивает bundle самого Mini App. |
| TMA Core | TypeScript + DOM API + Vite, schema-driven renderer | В runtime нет UI-фреймворка и клиентского кода конкретного проекта. Результат текущей сборки — 3.69 kB gzip JavaScript. |
| Основная БД | PostgreSQL 17: нормализованные сущности + JSONB-документы страниц | ACID нужен для владения ботами, публикаций и платежей; JSONB сохраняет гибкость конструктора. Отдельная NoSQL БД на MVP увеличит сложность без выигрыша. |
| Jobs MVP | PostgreSQL inbox/outbox + `FOR UPDATE SKIP LOCKED` worker | Надёжная дедупликация и обработка Telegram updates без дополнительного stateful-компонента. Redis добавляется после измерения нагрузки для распределённого rate limit и hot-cache. |
| Медиа | S3-совместимое object storage + CDN | Медиа не проходят через API-процессы; signed upload, оптимизированные AVIF/WebP-варианты. |
| Секреты | AES-256-GCM envelope encryption + AWS/GCP KMS или Vault Transit | У каждого токена свой data key; KMS оборачивает ключ, AAD привязывает ciphertext к project ID, AEAD обнаруживает подмену. |

Альтернативы: Go даст меньший расход памяти на CPU-насыщенных сервисах, но здесь доминируют сетевые ожидания, а общий TypeScript-контракт заметно ускоряет MVP. NestJS удобен большим командам, но тяжелее и добавляет слой абстракций; MongoDB не дает преимуществ над JSONB и усложняет транзакционное владение ботом.

## Границы системы и масштабирование

```text
React Builder ──► API/Fastify ──► PostgreSQL
                       │              │
                       ├──► PG jobs ─────► Telegram Bot API
                       └──► S3/CDN

Telegram client ──► CDN: vanilla TMA Core ──► Public manifest API/cache
                                      └──► Forms API (проверка initData)
```

На каждого бота не создается отдельный сервер или deployment. Все Mini Apps используют один версионированный TMA Core; `public_id` в URL определяет проект, а опубликованный JSON загружается с CDN/API. Боты маршрутизируются по `telegram_bot_id`. Для входящих updates нужны HTTPS webhooks и общая очередь, а не тысячи long-polling процессов. API stateless; PostgreSQL использует connection pooler (PgBouncer), Redis — только ускоритель.

Рекомендуемая эволюция: модульный монолит на MVP → независимо масштабируемые public-read API, Telegram automation worker и submission service после подтверждения профилем нагрузки. Преждевременные микросервисы здесь создадут распределенные транзакции раньше, чем это оправдано.

## Модель данных

- `users`: учетная запись. `password_hash` опционален для OIDC/passkeys; сырой пароль не хранится.
- `projects`: tenant-owned TMA. Внутренний `id` нельзя раскрывать; случайный `public_id` используется TMA Core.
- `bot_integrations`: один бот на проект в MVP; уникальный Telegram bot ID запрещает захват одного бота двумя проектами. Секрет — только `encrypted_token` envelope.
- `pages`: редактируемый draft JSONB и optimistic revision.
- `page_versions`: неизменяемые публикации. `pages.published_version_id` переключается атомарно; rollback — смена указателя.
- `media_assets`: метаданные объектов, сами байты находятся в object storage.
- `form_submissions`: индексируемые tenant/page/form поля нормализованы, динамические ответы находятся в JSONB.
- `outbox_events`: надежная передача событий worker-ам после commit без dual-write.

SQL находится в `migrations/001_initial.sql`. При росте `form_submissions` партиционируется по времени; tenant ID остается первым полем составных индексов. Для defense in depth можно добавить PostgreSQL RLS, но приложение уже проверяет `owner_user_id` в том же SQL, который резервирует интеграцию.

## Формат динамического интерфейса

Страница — versioned JSON tree, валидируемый строгой схемой из `src/domain/page-document.ts`:

```json
{
  "schemaVersion": 1,
  "metadata": { "title": "Каталог" },
  "settings": { "maxWidth": "normal", "respectTelegramTheme": true },
  "blocks": [
    {
      "id": "0b5c6e8f-e53b-49e4-a287-bdb034ff8c70",
      "version": 1,
      "type": "heading",
      "props": { "text": "Новые товары", "level": 1, "align": "start" }
    }
  ]
}
```

`type` — discriminant, `version` позволяет мигрировать конкретный блок, `props` — только данные блока, `children` есть у layout-блока `section`, `visibleWhen` — декларативное условие. В JSON запрещены JavaScript и произвольный HTML. Поддержаны `heading`, `text`, `media`, `button`, `product`, `form`, рекурсивный `section`; денежные значения хранятся целым `amountMinor`, а поля форм имеют уникальные стабильные ID.

Draft валидируется при каждом сохранении и ограничивается по размеру. Публикация повторно валидирует документ, нормализует его, вычисляет SHA-256 content hash, создает immutable `page_versions` и очищает CDN-кэш. TMA Core должен поддерживать текущую и как минимум предыдущую версию схемы.

## Подключение бота: надежный сценарий

`POST /v1/bot-connections` выполняет saga:

1. JWT-сессия устанавливает `ownerUserId`; запрос к БД проверяет владение проектом до вызова Telegram.
2. `getMe` проверяет токен и возвращает canonical bot ID.
3. Токен шифруется случайным data key (AES-256-GCM); data key оборачивается KEK/KMS. AAD содержит project ID.
4. БД атомарно резервирует уникальный bot ID со статусом `configuring`.
5. URL строится сервером из доверенного `PUBLIC_TMA_ORIGIN`, затем вызывается `setChatMenuButton` с `MenuButtonWebApp`.
6. Случайный secret token хэшируется для БД, а исходное значение один раз передаётся в `setWebhook`.
6. Интеграция становится `active`; при отказе Telegram — `error`, безопасный retry повторяет идемпотентную установку.

Токен исключен из логов Fastify, ошибки не сохраняют URL/объект запроса, body ограничен 32 KiB, endpoint имеет rate limit. В production `LocalAesKek` заменяется KMS adapter; KEK не должен находиться в `.env`. Также нужны TLS, secret scanning, audit log без секретов, ротация ключей и ограниченный IAM principal только на wrap/unwrap.

## API подключения бота

```http
POST /v1/bot-connections
Authorization: Bearer <session-jwt>
Content-Type: application/json

{
  "projectId": "0c4cb150-7c1a-4864-a67e-c2ee64abc2a1",
  "botToken": "<token from BotFather>",
  "menuButtonText": "Открыть каталог"
}
```

Успех: `200 { "data": { "botId": "...", "botUsername": "...", "miniAppUrl": "https://...", "status": "active" } }`. Неверный токен: 422; чужой/несуществующий проект: 404 без утечки его существования; уже занятый бот: 409; временный сбой Telegram: 502.

## Проверка Telegram-сессии

TMA Core отправляет сырой `Telegram.WebApp.initData`, `public_id` проекта и ничего из `initDataUnsafe` не считает доверенным. Backend находит bot integration, расшифровывает токен, проверяет HMAC-SHA-256 постоянным временем и ограничивает TTL `auth_date`. Сырой bot token никогда не уходит в браузер.

## Официальные контракты Telegram

- Bot API (`getMe`, `setChatMenuButton`, `setWebhook`, `MenuButtonWebApp`): https://core.telegram.org/bots/api
- Mini Apps SDK, темы, haptics и проверка `initData`: https://core.telegram.org/bots/webapps
