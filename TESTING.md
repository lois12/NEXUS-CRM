# NEXUS CRM - Руководство по тестам

## Структура тестов

### Backend (server/tests/)
| Файл | Описание |
|------|----------|
| `setup.ts` | Настройка тестовой БД, сидинг пользователей |
| `auth.test.ts` | Тесты авторизации (login, register, getMe) |
| `users.test.ts` | Тесты CRUD пользователей |
| `ideas.test.ts` | Тесты IdeaMap (идеи, связи, комментарии) |
| `kanban.test.ts` | Тесты Kanban доски |
| `partners.test.ts` | Тесты партнёров |
| `vacations.test.ts` | Тесты отпусков |
| `inventory.test.ts` | Тесты инвентаря (ТМЦ/ОС) |
| `events.test.ts` | Тесты мероприятий |
| `projects.test.ts` | Тесты проектов |
| `knowledge.test.ts` | Тесты базы знаний |
| `dashboard.test.ts` | Тесты дашборда |
| `middleware.test.ts` | Тесты middleware (auth, rate limit) |
| `database.test.ts` | Тесты работы с БД |

### Frontend (client/tests/)
| Файл | Описание |
|------|----------|
| `setup.ts` | Настройка jsdom, моки localStorage |
| `api.test.ts` | Тесты API сервиса |
| `AuthContext.test.tsx` | Тесты контекста авторизации |
| `types.test.ts` | Тесты типобезопасности |

## Запуск тестов

### Установка зависимостей
```bash
# Backend
cd server && npm install

# Frontend
cd client && npm install
```

### Запуск всех тестов
```bash
# Backend
cd server && npm test

# Frontend
cd client && npm test
```

### Запуск в watch-режиме
```bash
cd server && npm run test:watch
cd client && npm run test:watch
```

### Запуск с покрытием
```bash
cd server && npm run test:coverage
cd client && npm run test:coverage
```

## Покрытие тестами

### Backend API Endpoints
- `POST /api/auth/login` - 5 тестов
- `POST /api/auth/register` - 3 теста
- `GET /api/auth/me` - 3 теста
- `GET /api/users` - 2 теста
- `GET /api/users/:id` - 2 теста
- `POST /api/users` - 2 теста
- `PUT /api/users/:id` - 2 теста
- `DELETE /api/users/:id` - 2 теста
- `GET /api/ideas` - 1 тест
- `POST /api/ideas` - 3 теста
- `PUT /api/ideas/:id` - 2 теста
- `DELETE /api/ideas/:id` - 1 тест
- `POST /api/ideas/link` - 2 теста
- `GET /api/ideas/:id/comments` - 1 тест
- `POST /api/ideas/:id/comments` - 2 теста
- `GET /api/kanban` - 1 тест
- `POST /api/kanban` - 3 теста
- `PUT /api/kanban/:id` - 2 теста
- `DELETE /api/kanban/:id` - 1 тест
- `PUT /api/kanban/:id/archive` - 1 тест
- `GET /api/partners` - 1 тест
- `POST /api/partners` - 2 теста
- `PUT /api/partners/:id` - 2 теста
- `DELETE /api/partners/:id` - 1 тест
- `GET /api/vacations` - 1 тест
- `POST /api/vacations` - 1 тест
- `PUT /api/vacations/:id` - 1 тест
- `DELETE /api/vacations/:id` - 1 тест
- `GET /api/inventory` - 1 тест
- `POST /api/inventory` - 1 тест
- `PUT /api/inventory/:id` - 1 тест
- `DELETE /api/inventory/:id` - 1 тест
- `GET /api/events` - 1 тест
- `POST /api/events` - 1 тест
- `PUT /api/events/:id` - 1 тест
- `DELETE /api/events/:id` - 1 тест
- `GET /api/projects` - 1 тест
- `POST /api/projects` - 1 тест
- `PUT /api/projects/:id` - 1 тест
- `DELETE /api/projects/:id` - 1 тест
- `GET /api/knowledge` - 1 тест
- `POST /api/knowledge` - 1 тест
- `PUT /api/knowledge/:id` - 1 тест
- `DELETE /api/knowledge/:id` - 1 тест
- `GET /api/dashboard/stats` - 2 теста
- `GET /api/health` - 2 теста

### Middleware
- `authenticateToken` - 3 теста
- `requireRole` - 3 теста
- `rateLimitAuth` - 1 тест
- `recordFailedAttempt` - 1 тест
- `recordSuccessfulLogin` - 1 тест

### Database
- `query()` - 3 теста
- `get()` - 2 теста
- `run()` - 3 теста

### Frontend
- AuthContext - 4 теста
- API Service - 3 теста
- Types - 6 тестов

## Статистика
- **Всего тестов**: ~85+
- **Backend**: ~75 тестов
- **Frontend**: ~13 тестов
