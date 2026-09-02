# Запуск TMA Studio на Bothost

Проект разворачивается одним контейнером и одним HTTPS-доменом:

- `/` — сайт и кабинет конструктора;
- `/app/:publicId` — Telegram Mini App;
- `/v1/*` — API, webhook и формы;
- `/health/live` и `/health/ready` — проверки состояния.

## 1. Внешняя PostgreSQL

Bothost рекомендует внешний сервер для PostgreSQL. Для простого старта подходит Neon; скопируйте pooled connection string с `sslmode=require`. Альтернатива — Supabase Session Pooler на порту 5432.

Схема БД применяется автоматически из `migrations/*.sql` при запуске контейнера. Изменять уже применённый SQL-файл нельзя — нужно добавлять следующую миграцию.

## 2. Создание приложения в Bothost

1. Создайте приложение типа Telegram / Node.js из репозитория `https://github.com/voglogpro/projectkirill` и ветки `main`.
2. Включите домен и запомните выданное имя, например `projectkirill.bothost.tech`.
3. Порт установите `3000`.
4. Включите использование собственного `Dockerfile`.
5. Главный файл: `index.js`. Файл `main.js` также присутствует как совместимый alias.
6. Выполните новый deploy, а не только restart.

Bothost передаёт `DOMAIN` и `PORT` автоматически. Сервер слушает `0.0.0.0:$PORT`, а `https://$DOMAIN` автоматически используется для сайта, API и Mini App.

## 3. Переменные окружения

Добавьте в панели Bothost:

```text
DATABASE_URL=postgresql://...
SESSION_JWT_SECRET=<не менее 32 случайных символов>
PASSWORD_PEPPER_BASE64=<32 случайных байта в base64>
PASSWORD_PEPPER_ID=password-v1
REFRESH_TOKEN_HASH_KEY_BASE64=<32 случайных байта в base64>
TOKEN_KEK_BASE64=<32 случайных байта в base64>
TOKEN_KEK_ID=bothost-v1
JWT_ISSUER=tma-studio-api
JWT_AUDIENCE=tma-studio-console
PAYMENT_PROVIDER=mock
RUN_TELEGRAM_WORKER=true
TRUST_PROXY_HOPS=1
```

Локальная команда для генерации каждого ключа:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Создайте разные значения для JWT, password pepper, refresh hash key и KEK. Не добавляйте их в GitHub.

Для реальных платежей замените:

```text
PAYMENT_PROVIDER=yookassa
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
```

И добавьте в YooKassa webhook:

```text
https://<ваш-домен>/v1/billing/webhooks/yookassa
```

## 4. Telegram

Токен, который Bothost просит при создании контейнера, доступен как `BOT_TOKEN`, но платформа-конструктор намеренно не читает эту переменную. Каждый клиент подключает собственного бота через защищённый мастер на сайте.

Для первой проверки:

1. Зарегистрируйтесь на опубликованном сайте.
2. Отредактируйте проект и нажмите «Запустить».
3. Вставьте токен тестового бота из `@BotFather`.
4. В режиме `PAYMENT_PROVIDER=mock` тестовая оплата подтверждается сразу.
5. Сервис опубликует Mini App, вызовет `setChatMenuButton` и установит webhook.

## 5. Проверка после deploy

```text
https://<ваш-домен>/health/live
https://<ваш-домен>/health/ready
https://<ваш-домен>/
https://<ваш-домен>/app/demo
```

`live` проверяет процесс, `ready` — доступность PostgreSQL. Если домен отдаёт 502, сравните порт в панели с `PORT` в логах.

## 6. Автообновление

Включите в Bothost автоматический deploy из ветки `main` либо добавьте выданный Bothost webhook в GitHub. Каждый push будет пересобирать контейнер; данные остаются во внешней PostgreSQL.
