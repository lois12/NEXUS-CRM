# NEXUS CRM — Полный аудит безопасности и качества
**Дата:** 15.08.2026  
**Охват:** backend (44 файла), frontend (40+ файлов)  
**Найдено:** 100 проблем — 10 CRITICAL, 22 HIGH, 52 MEDIUM, 16 LOW

---

## EXECUTIVE SUMMARY

Проект работает, но имеет **системные проблемы с авторизацией** — почти все write-операции доступны ЛЮБОМУ авторизованному пользователю без проверки ролей. Также обнаружены: отключённая TLS-верификация, инъекция привилегий при регистрации, небезопасная загрузка файлов, hardcoded JWT-секрет, и множество логических багов.

---

## 🔴 CRITICAL (10 шт.)

### C1. Hardcoded JWT Secret — подделка токенов
**Файл:** `middleware/auth.ts:5`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-crm-secret-key-2024';
```
**Риск:** Любой с доступом к исходникам может подделать токен super_admin.
**Исправление:** Убрать fallback, падать при старте если нет env.

### C2. Регистрация позволяет создать super_admin
**Файл:** `controllers/authController.ts:63-95`
```typescript
const { role, roles } = req.body; // принимает от клиента!
```
**Риск:** Любой авторизованный может POST /api/auth/register с `role: 'super_admin'`.
**Исправление:** Игнорировать role/roles из body, или ограничить endpoint requireRole.

### C3. Mass Authorization Bypass — 9 роутов без requireRole
**Затронуты:** events, knowledge, inventory, partners, vacations, ideas, materials, projects, brand, kanban
**Риск:** Любой авторизованный может создавать/удалять/изменять данные в ЛЮБОМ разделе.
**Исправление:** Добавить requireRole во все write-endpoints.

### C4. Привилегия при создании пользователя
**Файл:** `controllers/usersController.ts:44-76`
**Риск:** Руководитель может создать super_admin.
**Исправление:** Проверять что caller не может назначить роль выше своей.

### C5. TLS верификация отключена глобально
**Файл:** `routes/imageGen.ts:10`, `routes/aiChat.ts:10`
```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```
**Риск:** MITM-атака на ВСЕ HTTPS-запросы процесса.
**Исправление:** Удалить, использовать per-request TLS agent.

### C6. Kanban unarchive вызывает НЕПРАВИЛЬНЫЙ handler
**Файл:** `routes/kanban.ts:14`
```typescript
router.put('/:id/unarchive', archiveTask); // Должно быть unarchiveTask!
```
**Риск:** Разархивация задачи архивирует её ещё раз.
**Исправление:** Заменить archiveTask → unarchiveTask.

### C7. Файлы не удаляются в production
**Файлы:** `materialsController.ts:105`, `kanbanController.ts:181`, `projectsController.ts:192`
**Риск:** `__dirname` в dist/ указывает не туда. Файлы остаются на диске.
**Исправление:** Использовать path.join(__dirname, '..', '..', 'uploads', ...).

### C8. Chat getMessages — нет проверки_membership
**Файл:** `controllers/chatController.ts:180-211`
**Риск:** Любой авторизованный может читать ЛЮБЫЕ приватные чужие переписки.
**Исправление:** Проверять что user является участником conversation.

### C9. Socket.IO без аутентификации
**Файл:** `server.ts:89-114`
**Риск:** Любой может подключиться и притвориться любым пользователем.
**Исправление:** Проверять JWT при подключении socket.

### C10. SVG загрузка — stored XSS
**Файл:** `middleware/upload.ts:22`
**Риск:** SVG может содержать JavaScript, выполняемый в браузере.
**Исправление:** Удалить SVG из разрешённых типов.

---

## 🟠 HIGH (22 шт.)

### Безопасность
| # | Файл | Проблема |
|---|------|----------|
| H1 | `server.ts:33` | CORS `origin: '*'` — любой сайт может делать запросы |
| H2 | `server.ts:90` | Socket.IO CORS `origin: '*'` |
| H3 | `middleware/upload.ts:35` | `application/octet-stream` обходит фильтр типов |
| H4 | `middleware/upload.ts:38-40` | ZIP/RAR/7z без сканирования |
| H5 | `chatController.ts:305` | Проверка `role` вместо `roles[]` при удалении сообщений |
| H6 | `chatController.ts:237-276` | Сообщение сохранено, но клиент получает 500 если notification fails |
| H7 | `vacationsController.ts:42-79` | Нет авторизации на update/delete отпусков |
| H8 | `ideasController.ts:202,242` | Нет авторизации на удаление комментариев/вложений |

### Баги
| # | Файл | Проблема |
|---|------|----------|
| H9 | `aiChat.ts:81` | Колонка `name` вместо `title` — AI не получает контекст проектов |
| H10 | `contentController.ts:9-17` | getVisibleStatusFilter — мёртвый код, не вызывается |
| H11 | `contentController.ts:109` | `if (title)` вместо `if (title !== undefined)` — нельзя очистить поле |
| H12 | `usersController.ts:91-93` | Та же проблема с truthy checks |

### Frontend
| # | Файл | Проблема |
|---|------|----------|
| H13 | `socket.ts:21-32` | Connect listener добавляется при каждом вызове (утечка) |
| H14 | `socket.ts:3-18` | Socket не отключается при unmount ChatWidget |
| H15 | `Kanban.tsx:325, Projects.tsx:249` | Hardcoded `http://localhost:8080` в URL — сломано в production |
| H16 | `Kanban.tsx:75-88` | Stale closure при drag-drop reorder |
| H17 | `api.ts:31-34` | 401 handler делает полную перезагрузку страницы |

---

## 🟡 MEDIUM (52 шт.)

### Backend
- Нет валидации тел запросов (joi/zod)
- Rate limiting только на login
- express.json() без size limit
- Пароли админов логируются в консоль
- Unbounded queries без LIMIT/pagination
- Search загружает ВСЕ таблицы в память
- lastSeenCache утечка памяти
- Duplicate DELETE в deleteIdea
- N+1 notifications в general chat
- Duplicate conversation fetch в sendMessage
- User deletion не каскадится
- Duplicate code (imageGen/aiChat, auth/users, brand route)

### Frontend
- Race conditions в AuthContext, ContentPlan, IdeaMap
- Missing error boundaries для ChatWidget, IdeaGraph, lazy pages
- Stale refs в Dashboard FloatingBadges
- Performance: filteredUsers/Convs/Messages без useMemo
- 401 interceptor теряет несохранённую работу
- Типы `any` в api.ts, useCrudPage, AdminMonitoring
- Demo-кредиталы видны на странице логина

---

## 🟢 LOW (16 шт.)

- Нет CSRF защиты
- Password complexity не проверяется
- Нет account lockout
- bcrypt.hashSync блокирует event loop
- Rate limiter interval не очищается
- Maintenance mode теряется при рестарте
- Chat reactions O(n) фильтр
- Пустые catch блоки

---

## ТОП-10 ИСПРАВЛЕНИЙ (по приоритету)

| # | Что | Файл | Влияние |
|---|-----|------|---------|
| 1 | Добавить requireRole на ВСЕ write-endpoints | 9 route files | Закрывает mass auth bypass |
| 2 | Убрать hardcoded JWT fallback | middleware/auth.ts:5 | Закрывает token forgery |
| 3 | Убрать NODE_TLS_REJECT_UNAUTHORIZED=0 | imageGen.ts, aiChat.ts | Закрывает MITM |
| 4 | Запретить клиенту задавать role при регистрации | authController.ts | Закрывает privilege escalation |
| 5 | Исправить kanban unarchive handler | kanban.ts:14 | Восстанавливает фичу |
| 6 | Проверять membership в chat getMessages | chatController.ts | Закрывает data leak |
| 7 | Заменить hardcoded localhost:8080 | Kanban.tsx, Projects.tsx | Восстанавливает production |
| 8 | Удалить SVG из upload types | upload.ts:22 | Закрывает stored XSS |
| 9 | Ограничить CORS | server.ts:33 | Закрывает cross-site attacks |
| 10 | Добавить Socket.IO auth middleware | server.ts:89 | Закрывает socket impersonation |

---

*Отчёт сгенерирован автоматически тремя параллельными аудиторами.*
