# Поэтапный план TMA Studio

## Выполнено в MVP

1. Архитектурный фундамент: TypeScript-монорепозиторий, PostgreSQL/JSONB, строгие Zod-контракты, версии блоков.
2. Безопасность: scrypt-пароли, JWT access, ротация refresh, tenant-scoped SQL, rate limits, security headers, AES-256-GCM envelope encryption.
3. Конструктор: лендинг, регистрация, кабинет, каталог блоков, телефонный preview, инспектор свойств и локальное сохранение черновика.
4. Публикация: серверная валидация документа, optimistic locking, immutable release и public manifest.
5. Mini App: общий компактный renderer, Telegram theme variables, dark/light theme, Haptic Feedback и отправка форм.
6. Telegram automation: `getMe`, `setChatMenuButton`, `setWebhook`, проверка webhook secret, inbox/dedupe, worker и ответ на `/start`.
7. Монетизация: free draft, solo 350 ₽, trio 650 ₽, YooKassa adapter, idempotent checkout, проверяемый webhook и серверные лимиты.
8. Качество: 47 тестов, typecheck, production builds и документация запуска.

## Перед закрытой бетой

1. Подключить реальные домены, PostgreSQL, KMS/Vault, object storage и магазин YooKassa.
2. Добавить загрузку изображений через signed URL и оптимизацию WebP/AVIF.
3. Завершить UX drag-and-drop, несколько страниц, undo/redo и историю релизов.
4. Добавить экран заявок, экспорт CSV и уведомления владельцу бота.
5. Добавить scheduled renewal с сохранённым payment method, dunning и уведомления об окончании тарифа.
6. Добавить E2E Playwright для регистрация → редактирование → checkout → publish с Telegram/YooKassa sandbox.

## Перед публичным запуском

1. PgBouncer, CDN public manifests, централизованный distributed rate limit и autoscaling worker/API.
2. Observability: traces, RED-метрики, бизнес-метрики, alerting, audit log без секретов.
3. KMS key rotation, backup/restore drill, dependency/secret scanning и внешний security review.
4. Юридические документы, чеки/54-ФЗ через возможности магазина, согласия на обработку персональных данных.
5. Нагрузочные тесты webhook ingress, public manifest и form submissions.
