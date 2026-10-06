# AGENTS.md — NEXUS CRM

Руководство для разработчика / AI-агента, который впервые садится в этот репозиторий.

Контекст продукта и полный список модулей — в [`README.md`](./README.md).

---

## 0. Рабочий контекст

| | |
|---|---|
| **Проект** | NEXUS CRM — внутренняя CRM команды (киберпанк-UI) |
| **Репо** | `https://github.com/lois12/NEXUS-CRM` (branch `main`) |
| **Прод** | `nexus-liberty.online` · bare VPS + pm2, **без Docker** |
| **База** | SQLite (`server/nexus.db`, better-sqlite3, WAL) |
| **Пользователь** | Общается по-русски, часто с опечатками. Деплоит **сам** (лаунчер → `update.sh`) |
| **Поставка** | Агент делает **только commit + push**. Не запускать деплой, не напоминать про `npm run build` |

---

## 1. Жёсткие правила (нарушение = поломка прода)

### VPS-база данных — священна

- Никогда **не** перезаливать, не синхронизировать, не заменять `nexus.db` на VPS.
- Проверки на проде — **только** `SELECT` (счётчики строк).
- Миграции — **исключительно аддитивные**:
  - `CREATE TABLE IF NOT EXISTS`
  - `ALTER TABLE … ADD COLUMN`
  - `CREATE INDEX IF NOT EXISTS`
- Запрещено: `DROP`, `RENAME`, изменение типа колонки, `UPDATE`/`DELETE` всей таблицы.
- Перед push: `git status --porcelain` **не должен** показывать `*.db*`.

### Миграции: закон импорта

```ts
// server/db/migrations/0XX_name.ts
import { register } from '../migrator';
import { run } from '../database';

register('0YY', 'name', () => {
  run('ALTER TABLE foo ADD COLUMN bar TEXT', [], true); // silent=true обязателен
});
```

**Каждый новый файл миграции обязан быть добавлен в `server/db/migrator.ts`:**

```ts
import './migrations/0XX_name';
```

Без импорта `register()` не выполнится — колонка не появится, API вернёт 500. Это уже ломало surveys и collage.

`server/db/init.ts` содержит полную схему **только для новых** БД. Для VPS изменения приходят через миграции. Оба пути должны совпадать по колонкам.

### Удаление сущностей

`CREATE TABLE IF NOT EXISTS` **не апгрейдит** существующую схему — `ON DELETE CASCADE` на VPS может отсутствовать.

- Удалять детей **явно** перед родителем, в `transaction()`.
- NOT NULL FK (`authorId`, `senderId`, `createdBy`) нельзя обнулить — переписать на актёра (`actorId`) и зачистить чат (`deleted=1`, `content='[Удалено]'`).

### Файлы и кодировка

- **Никогда** не читать/писать исходники через PowerShell `Get-Content` / `Set-Content` — они ломают UTF-8 кириллицу. Только инструменты `read` / `write` / `edit`.
- `uploads/` лежит **в корне проекта**, не в `server/uploads/`.
- `node -e` с вложенными кавычками в PowerShell — писать `.cjs` скрипт файлом.

### Публичные страницы и axios

Главный `api` в `client/src/services/api.ts` при **401** делает redirect на `/login`. Публичные формы (опросы, регистрации, control, виджеты) при этом выкидывает.

→ Публичные эндпоинты — через **отдельный axios** (`publicSurveyApi`, `publicApi`) **без** login-interceptor.

### Тесты и проверки

Перед коммитом:

```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

Это стандарт. Если `tsc` красный — не коммитить.

Тесты: `cd server && npm test` (vitest). Файлы в `server/tests/`. Для content-тестов in-memory БД: `initDatabase(true)` + `initializeDatabase()`.

---

## 2. Как устроен репозиторий

```
client/src/
  pages/            # толстые страницы (ContentPlan ~1200 строк — known smell)
  components/
    surveys/        # тонкие страницы + толстые компоненты (образцовый паттерн)
    content/        # FullCalendarView, WeekAccordionView, PostComments
    ui/             # NexusModal, ImageUpload, RichEditor
  collage/          # модуль коллажа, вырезанный из PhotoCollage.tsx
  services/api.ts   # общий axios + contentApi, usersApi, …
  types/index.ts    # доменные типы (ContentPost, User, Survey, …)

server/
  server.ts         # монтирование роутов (порядок важен: public → auth)
  controllers/      # бизнес-логика
  routes/           # express-роуты; export publicRouter для анонимных
  db/
    database.ts     # query(), run(), get(), transaction(), backupDatabase()
    init.ts         # CREATE TABLE (полная схема)
    migrator.ts     # рантайм миграций + импорты
    migrations/     # аддитивные ALTER
  middleware/       # auth, roles, errorHandler
  services/         # autoBackup и др.
  tests/            # vitest + supertest
```

---

## 3. Процесс разработки

### Workflow пользователя

1. Агент предлагает **нумерованный список идей** (30–50 пунктов).
2. Пользователь выбирает номера («2,21,23»).
3. Агент реализует **только** выбранные.
4. **Commit + push** в `main`.
5. Пользователь сам жмёт «Деплой» в лаунчере.

Новые фичи — только по выбору пользователя. Не расширять scope.

### Сообщение коммита

```
feat: content plan multi-platform posts + week accordion view

- one post stores all social platforms as platforms[] (JSON)
- fix platform checkboxes not persisting after create/edit
- week accordion view: weeks -> days -> posts
```

Стиль: `feat:` / `fix:` / `refactor:` + bullet-список «зачем», не «что».

### Проверка перед push

```bash
git status --porcelain    # нет *.db*, нет мусора
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
# при изменении API — npm test в server/
```

---

## 4. Паттерны, которым следовать

### Новый модуль (страница)

Предпочтительный паттерн (как «Опросы»):

1. **Тонкая страница** `pages/Xxx.tsx` — стейт + fetch + роутинг.
2. **Толстые компоненты** `components/xxx/*` — вся верстка.
3. Сервер: `controllers/xxxController.ts` + `routes/xxx.ts`.
4. Типы — в `client/src/types/index.ts`.
5. API-обёртка — в `services/api.ts` (или отдельный файл для public-ветки).

Не копить 1200-страничные монолиты в `pages/`.

### Контент-план: мультиплощадки

Один пост = одна строка. `platforms` — JSON-массив тегов `['telegram','vk']`.  
`platform` — legacy-первичка (`platforms[0]`), остаётся для старых фильтров.  
Не создавать дубликаты поста на каждую сеть.

### UI

- Переменные темы из `globals.css`, не хардкод цветов.
- `.glass` / `.glass-card` / `.neon-text` — готовые утилиты.
- Подтверждения: `useNexusConfirm` — **callback**, не Promise:

```ts
const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
showConfirm('ЗАГОЛОВОК', 'текст', async () => { /* … */ }, 'danger');
```

- Тосты: `showToast(msg, 'success'|'error')` из `NexusModal`.
- Формат дат/времени: `utils/timezone` (`formatDateKR`, `formatTimeKR`), таймзона отчётов — `Asia/Krasnoyarsk`.

### PDF/CSV экспорт

- PDF-отчёты: printable HTML + `window.print()` (без pdf-lib).
- CSV: BOM + `;` (Excel-локаль).

---

## 5. Известные грабли (не наступать)

| Симптом | Причина | Что делать |
|---|---|---|
| 500 после новой миграции | Нет `import` в `migrator.ts` | Добавить импорт, задеплоить |
| 401 выкидывает с `/opros/...` | Общий axios + login-redirect | Отдельный public axios |
| Кириллица → «Р—РћРќРђ» | PowerShell Get/Set-Content | `read`/`write`/`edit`, лечить через cp1251-recovery |
| Dropdown «утекает» под соседа | `.glass` = stacking context | Родителю `relative z-50`, соседу `relative z-0` |
| `width: auto` + `aspect-ratio` = 0×0 | Только absolute-дети | Явная ширина |
| `showConfirm` не ждёт | API callback-style | Не `await confirm()` |
| JPEG без прозрачности | Формат без alpha | PNG/WebP |
| Edit tool «multi-match» | `old_string` в 2+ местах | `replace_all: true` или шире контекст |
| Тесты падают на FK | Нет сид-пользователя | `initDatabase(true)` + `initializeDatabase()` + INSERT user |
| vitest: `register is not a function` | Цикл migrator↔migrations в ESM | Не дёргать `runMigrations()` в тестах, ALTER руками |

---

## 6. Типы и API-контракты (кратко)

```ts
// ContentPost — один пост, несколько площадок
{
  id: string;
  title: string;
  content: string;
  platform: SocialPlatform;      // legacy primary
  platforms: SocialPlatform[];   // ['telegram','vk','site','max']
  status: 'черновик' | 'запланирован' | 'опубликован';
  scheduledDate?: string;
  imageUrl?: string;
  // …
}
```

Сервер всегда возвращает `platforms` массивом (fallback `[platform]`).

Роуты: см. `server/server.ts` и Swagger `/api/docs`.  
Публичные роуты монтируются **до** auth — порядок важен.

---

## 7. Политика безопасности (коротко)

- Пароли: bcryptjs. JWT: `JWT_SECRET` из env, никогда не хардкод.
- Роли проверяются на сервере (`requireRole`), не только на клиенте.
- Загрузка файлов: multer, тип/размер ограничены.
- `path.basename` + whitelist для скачивания бэкапов (без traversal).
- `.env`, `.deploy.env`, `*.db`, `uploads/` — в `.gitignore`, не коммитить секреты.

---

## 8. Куда смотреть в первую очередь

| Задача | Файлы |
|---|---|
| Новая страница | `client/src/pages/`, `client/src/App.tsx` (роут), `client/src/types/index.ts` |
| Новый API | `server/controllers/`, `server/routes/`, `server/server.ts` |
| Схема БД | `server/db/init.ts` + `server/db/migrations/` + **import в `migrator.ts`** |
| Тесты | `server/tests/*.test.ts` |
| Стиль | `client/src/styles/globals.css` |
| Деплой-поведение | `update.sh`, MEMORY → «Deploy procedure» |
| История фич | `PROJECT_HISTORY.md` |

---

## 9. Definition of Done

- [ ] `npx tsc --noEmit` зелёный (client + server)
- [ ] Миграции аддитивны + import в `migrator.ts`
- [ ] Нет `*.db*` в `git status --porcelain`
- [ ] Публичные роуты не завязаны на login-interceptor
- [ ] Удаления чистят детей явно
- [ ] Commit с понятным «зачем» + push в `main`
- [ ] Деплой — **силами пользователя**

---

## 10. Доп. чтение

- [`README.md`](./README.md) — стек, модули, env, деплой
- `PROJECT_HISTORY.md` — летопись фич
- Память проекта (MEMORY.md) — глубокие правила сессий (access через mimocode memory)

Если правило из этого файла конфликтует с живым требованием пользователя — **побеждает пользователь**, но зафиксируй изменение здесь после.
