# NEXUS CRM

Внутренняя CRM-система для команды. Тёмная киберпанк-эстетика (неон `#00ff88` / `#00d4ff`), 5 цветовых тем, 40+ модулей — от контент-плана до QR-чекина на мероприятиях.

**Прод:** [nexus-liberty.online](https://nexus-liberty.online) · **Repo:** [lois12/NEXUS-CRM](https://github.com/lois12/NEXUS-CRM)

---

## Стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion, React Router v6, Axios, Zustand-free (Context), Lucide, Recharts, FullCalendar, Leaflet, CodeMirror, react-force-graph-3d, Sonner |
| **Backend** | Node.js + Express + TypeScript, better-sqlite3 (WAL), JWT, bcryptjs, multer, Socket.IO, web-push, Resend, Swagger |
| **Хранение** | SQLite (`server/nexus.db`), файлы в `uploads/` (корень проекта) |
| **Инфра** | bare VPS (reg.ru) + pm2, **без Docker**. Деплой: GitHub → `update.sh` |

---

## Быстрый старт

```bash
# 1. Зависимости (react-leaflet требует --legacy-peer-deps)
npm run install:all
# или вручную:
#   cd client && npm install --legacy-peer-deps
#   cd server && npm install --legacy-peer-deps

# 2. Переменные окружения
cp .env.example .env
# заполнить JWT_SECRET (обязательно), остальное — по желанию

# 3. Dev (клиент + сервер)
npm run dev
# server: http://localhost:3001  (PORT из .env)
# client: http://localhost:5173
```

Или по отдельности:

```bash
cd server && npm run dev   # tsx watch server.ts
cd client && npm run dev   # vite
```

### Переменные окружения (`.env`)

| Переменная | Назначение | Обязательна |
|---|---|---|
| `PORT` | Порт API (по умолчанию 8080 / 3001) | нет |
| `ALLOWED_ORIGIN` | CORS-origin (прод: `https://nexus-liberty.online`) | да |
| `JWT_SECRET` | Секрет токенов — **генерировать свой** | **да** |
| `GIGACHAT_API_KEY` | AI-чат / генерация текста | нет |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push (`npx web-push generate-vapid-keys`) | нет |
| `RESEND_API_KEY` | Email-рассылки (до 3000/мес бесплатно) | нет |

JWT_SECRET сгенерировать:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Структура проекта

```
NEXUS-CRM/
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── pages/          # 40+ страниц (ContentPlan, Surveys, Kanban, …)
│       ├── components/     # UI-компоненты (surveys/, content/, ui/)
│       ├── collage/        # Фоторедактор коллажей (разбитый модуль)
│       ├── services/       # api.ts (axios), surveyApi.ts, …
│       ├── context/        # AuthContext
│       ├── config/         # maintPages.ts и др.
│       └── types/          # общие TS-типы
├── server/                 # Express API
│   ├── controllers/
│   ├── routes/             # роуты + publicRouter (без auth)
│   ├── db/
│   │   ├── database.ts     # query/run/get/transaction/backupDatabase
│   │   ├── init.ts         # CREATE TABLE (полная схема для новых БД)
│   │   ├── migrator.ts     # + migrations/ — аддитивные ALTER
│   │   └── sqlBuilder.ts
│   ├── middleware/         # auth, roles, errorHandler
│   ├── services/           # autoBackup, email, …
│   └── tests/              # vitest + supertest
├── uploads/                # ВНИМАНИЕ: в корне проекта, не в server/
├── launcher/               # Electron-лаунчер (деплой кнопкой)
├── .env.example
└── update.sh               # скрипт деплоя на VPS
```

---

## Модули (40+)

<details>
<summary><b>Рабочие инструменты</b></summary>

- **Дашборд** — статистика, активность, онлайн-пользователи
- **Контент-план** — календари (сетка / недели-аккордеон / FullCalendar), мультиплощадки (ТГ/VK/MAX/Web), статусы, комментарии
- **Опросы** — конструктор, публичные формы `/opros/:slug`, статусы (draft/scheduled/published/completed), графики, PDF/CSV
- **Материалы** — хранилище файлов
- **Брендбанк** — фирменные материалы
- **Идеи** — idea map
- **Канбан** — задачи
- **Партнёры**, **События**, **Проекты** (медиа + документы)
- **База знаний**, **Склад** (kanban по локациям)
- **Отпуска**

</details>

<details>
<summary><b>Коммуникации</b></summary>

- **Чат** — личные / групповые / общий, emoji, стикеры, файлы
- **AI-чат** (GigaChat)
- **Уведомления** + Web Push
- **Регистрации v3** — публичные формы (30 типов полей), QR, waitlist, карта, PDF, CSV
- **NEXUS CONTROL** `/control` — QR-чекин (камера / код / файл), пароль-гейт
- **Виджеты** — embeddable HTML-карточки `/w/:slug`, пароль, OG-теги
- **Списки** — общие списки + публичные ссылки

</details>

<details>
<summary><b>Утилиты</b></summary>

- **QR-генератор**, **Генератор изображений** (AI)
- **Фотоколлаж** — полноценный редактор с серверным сохранением проектов
- **Конвертеры** — изображения, документы (20+ инструментов, LibreOffice)
- **Удаление фона**, **Короткие ссылки**, **Пинг**, **Рандомайзер**, **Погода**, **Аврора** (Kp для Норильска)

</details>

<details>
<summary><b>Админка</b></summary>

- **Пользователи** — роли, удаление с реассайном владения
- **Мониторинг** `/admin/monitoring` — health, бэкапы БД (ручной + авто 09:00), техобслуживание по страницам
- **Swagger** `/api/docs`

</details>

---

## Роли

| Роль | Права |
|------|-------|
| `super_admin` | Полный доступ, админка, бэкапы, maintenance |
| `руководитель` | Управление командой и контентом |
| `smm` | Контент-план, соцсети |
| `редактор` | Контент и материалы |
| `документовед` | Документы и списки |

Роли хранятся в `users.role` + `users.roles` (JSON-массив). Проверка на клиенте: `user.roles?.includes('…') || user.role === '…'`.

### Матрица ролей (кто что видит)

| Модуль | super_admin | руководитель | smm | редактор | документовед |
|---|---|---|---|---|---|
| Дашборд | ✓ | ✓ | ✓ | ✓ | ✓ |
| Контент-план | ✓ | ✓ | ✓ | ✓ | — |
| Опросы | ✓ | ✓ | ✓ | свои | — |
| Задачи (канбан) | ✓ | ✓ | свои | свои | свои |
| События / Регистрации | ✓ | ✓ | ✓ | свои | свои |
| Пользователи | ✓ | ✓ | — | — | — |
| Админка / Бэкапы | ✓ | — | — | — | — |
| Экспорт | ✓ | ✓ | ✓ | свои | свои |

`свои` — видит и редактирует только свои записи. Актуальная матрица также показана в **Админка → Мониторинг**.

---

## API

Swagger: **`/api/docs`**

Основные префиксы (все под `/api`):

| Модуль | Путь |
|---|---|
| Auth | `/auth` (login, register, me, qr) |
| Users | `/users` |
| Content | `/content` (+ comments, image, publish) |
| Surveys | `/surveys` + **public** `/api/opros/*` |
| Lists | `/lists` + **public** `/api/lists/public/*` |
| Registrations | **public** `/api/reg/*`, `/api/control/*` |
| Widgets | `/widgets` + **public** `/api/w/*` |
| Dashboard | `/dashboard` (analytics, maintenance, backups) |
| Chat / Push | `/chat`, `/push` |
| Collage | `/collage` |
| … | materials, ideas, kanban, partners, vacations, inventory, events, projects, knowledge, brand, notifications, imageGen, aiChat, search, converter, links, qrAuth |

**Публичные роуты** монтируются **до** auth-роутов и не требуют Bearer-токена.

---

## База данных

- SQLite + **better-sqlite3** в **WAL**-режиме (`busy_timeout ≥ 5000`)
- Файл: `server/nexus.db` (+ `-wal`, `-shm`) — **никогда не коммитить**
- `uploads/` — **в корне проекта** (`PROJECT_ROOT/uploads`)

### Миграции

Две ветки схемы:
1. **Новая БД** — полный `CREATE TABLE` в `server/db/init.ts`
2. **Существующая БД (VPS)** — только аддитивные миграции в `server/db/migrations/`

Каждый файл миграции:
```ts
import { register } from '../migrator';
import { run } from '../database';

register('0XX', 'name', () => {
  run('ALTER TABLE … ADD COLUMN …', [], true); // silent=true обязателен
});
```

> **ЗАКОН:** новый файл миграции **обязан** быть импортирован в `server/db/migrator.ts`. Без импорта `register()` не выполнится — колонка не появится, будут 500-е.

> **VPS-БД священна.** Только `ADD COLUMN` / `CREATE TABLE IF NOT EXISTS`. Никаких `DROP`, `RENAME`, перезаливок. `*.db*` не попадают в git.

### Бэкапы

- Ручной: админка → Мониторинг → «БЭКАП БД»
- Авто: ежедневно в **09:00** (`server/services/autoBackup.ts`), хранение 30 дней
- Директория: `DB_BACKUP_DIR` → `/var/nexus_db_backups` (VPS) или `db_backups/` локально

---

## Тесты

```bash
cd server && npm test          # vitest run
cd server && npm run test:watch
cd client && npm test
```

- **`server/tests/`** — vitest + supertest (auth, content, chat, users, …)
- Перед `content`-тестами используется in-memory БД + `initializeDatabase()`
- Проверка перед коммитом: **`npx tsc --noEmit`** в `client/` и `server/`

---

## Деплой (VPS)

Рабочий процесс:

1. **Агент / разработчик:** commit + push в `main`
2. **Пользователь:** кнопка «Деплой» в Electron-лаунчере (`update.sh`)

Скрипт `update.sh` (сокращённо):
```
git pull → pm2 stop → sleep → npm run build (client+server) → pm2 start
```

Критично:
- `pm2 stop` **до** сборки — иначе риск повреждения WAL-базы
- `better-sqlite3` — нативный модуль, компилируется на VPS при `npm install`
- Зависимости ставятся с `--legacy-peer-deps`
- `uploads/` синхронизировать только при остановленном сервере

Проверка после деплоя: `git log --oneline -1` на VPS, счётчики строк в таблицах, `uploads | wc -l`.

---

## Дизайн-система (кратко)

- CSS-переменные в `client/src/styles/globals.css`
- Основные цвета: `--color-primary: #00ff88`, `--color-accent: #00d4ff`, `--color-bg: #0a0a0f`
- Утилиты: `.glass`, `.glass-card`, `.glass-frost`, `.neon-text`, `.cyber-grid`, `.cyber-input`
- 5 тем: NETRUNNER / SYNTHWAVE / ARASAKA / BIOTECH / WASTELAND
- Шрифты: JetBrains Mono для «хакерского» UI-текста

Ловушки CSS:
- `backdrop-filter` создаёт stacking context — z-index dropdown’ов может «утонуть» под соседом
- `width: auto` + `aspect-ratio` с только absolute-детьми = 0×0 (задавать явную ширину)

---

## Полезные команды

```bash
# Типы (обязательно перед коммитом)
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# Сборка клиента (после UI-правок — чтобы бэкенд отдавал свежий dist)
cd client && npm run build

# Dev одним процессом
npm run dev

# Swagger локально
open http://localhost:3001/api/docs
```

---

## Частые грабли (short list)

| Проблема | Решение |
|---|---|
| 500 на новый модуль после миграции | Забыли `import './migrations/0XX'` в `migrator.ts` |
| 401 выкидывает с публичной страницы | Публичные API — через отдельный axios **без** login-редиректа (`publicSurveyApi` / `publicApi`) |
| Удаление родителя роняет FK | Вручную удалять детей в `transaction()` — `ON DELETE CASCADE` на VPS может отсутствовать |
| Кириллица ломается в файлах | Никаких PowerShell `Get-Content`/`Set-Content` — только `read`/`write`/`edit` |
| `*.db` в git | Никогда. `git status --porcelain` перед push |
| JPEG с прозрачностью | JPEG не хранит alpha — авто-переключение на PNG/WebP |
| `useNexusConfirm` | **Callback**, не Promise — `showConfirm(title, msg, onConfirm, type)` |

---

## Лицензия

Внутренний продукт. Публичная лицензия не указана.
