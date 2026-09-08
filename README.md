# NEXUS CRM

Локальная CRM-система для маленькой организации в стиле киберпанк.

## Стек технологий

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Router v6
- Axios
- Lucide React
- qrcode.react

### Backend
- Node.js + Express + TypeScript
- better-sqlite3
- JWT авторизация
- bcryptjs
- multer

## Быстрый старт

### Установка зависимостей

```bash
# Установить все зависимости (корень, client, server)
npm run install:all
```

### Запуск в режиме разработки

```bash
# Запустить клиент и сервер одновременно
npm run dev
```

Или запустить по отдельности:

```bash
# Запустить сервер (порт 3001)
cd server
npm run dev

# Запустить клиент (порт 5173)
cd client
npm run dev
```

### Демо доступ

- **Логин:** admin
- **Пароль:** admin123

## Структура проекта

```
nexus-crm/
├── client/          # React фронтенд
├── server/          # Node.js бэкенд
├── uploads/         # Загруженные файлы
└── PROJECT_HISTORY.md
```

## Роли пользователей

| Роль | Описание |
|------|----------|
| Руководитель | Полный доступ ко всему |
| Редактор | Работа с контентом |
| SMM | Соцсети и публикации |
| Документовед | Управление документами |

## Возможности

- Авторизация и управление ролями
- Дашборд со статистикой
- Контент-план для соцсетей
- Хранилище материалов
- Генератор QR-кодов
- Генератор изображений (AI)
- Управление пользователями

## API Endpoints

### Auth
- `POST /api/auth/login` - Вход
- `POST /api/auth/register` - Регистрация
- `GET /api/auth/me` - Текущий пользователь

### Users
- `GET /api/users` - Список пользователей
- `POST /api/users` - Создать пользователя
- `PUT /api/users/:id` - Обновить пользователя
- `DELETE /api/users/:id` - Удалить пользователя

### Content
- `GET /api/content` - Список постов
- `POST /api/content` - Создать пост
- `PUT /api/content/:id` - Обновить пост
- `DELETE /api/content/:id` - Удалить пост

### Materials
- `GET /api/materials` - Список файлов
- `POST /api/materials/upload` - Загрузить файл
- `DELETE /api/materials/:id` - Удалить файл

### Dashboard
- `GET /api/dashboard/stats` - Статистика
