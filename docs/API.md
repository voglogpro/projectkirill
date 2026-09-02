# API MVP

Все приватные маршруты используют `Authorization: Bearer <access-token>`. Ошибки имеют форму `{ "error": { "code": "...", "message": "..." } }`.

## Учётная запись и проекты

- `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- `GET|POST /v1/projects`
- `GET|PATCH /v1/projects/:projectId`
- `GET|POST /v1/projects/:projectId/pages`
- `PUT|DELETE /v1/projects/:projectId/pages/:pageId`
- `POST /v1/projects/:projectId/preview-grants`
- `POST /v1/projects/:projectId/publish`
- `GET /v1/projects/:projectId/submissions` — последние 500 заявок владельца;
- `GET /v1/public/apps/:publicId`

## Telegram

- `POST /v1/bot-connections/validate` — бесплатная проверка токена, без сохранения;
- `GET /v1/bot-connections/:projectId` — статус подключённого бота для кабинета;
- `POST /v1/bot-connections` — платная активация, шифрование токена, menu button и webhook;
- `POST /v1/telegram/webhooks/:publicIntegrationId` — ingress с проверкой секретного заголовка;
- `POST /v1/public/apps/:publicId/forms` — проверка Telegram `initData` и сохранение формы.

## Тарифы

- `GET /v1/billing/plans`
- `GET /v1/billing/entitlement`
- `POST /v1/billing/checkouts`
- `POST /v1/billing/webhooks/yookassa`

Бесплатный тариф разрешает один draft-проект и не разрешает публикацию. `solo` разрешает один активный бот за 350 ₽/месяц, `trio` — три за 650 ₽/месяц.

## Health

- `GET /health/live`
- `GET /health/ready`
