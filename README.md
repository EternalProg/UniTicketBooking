# Server-side for University Ticket Booking application

**[English](#english) • [Українська](#українська)**

---

<a name="english"></a>

## English

### Description

A server-side for University Ticket Booking application to different events. The system supports user registration and authentication (JWT), event management by administrators, transactional ticket booking, Redis caching, and role-based access control.

### Technologies

| Category          | Technology                                             |
| ----------------- | ------------------------------------------------------ |
| Runtime           | Node.js 20+                                            |
| Language          | TypeScript 6                                            |
| Framework         | Fastify 5                                               |
| Database          | MySQL 8                                                 |
| ORM               | Prisma 7                               |
| Validation        | Zod 4                                                   |
| Authentication    | JWT (access + refresh tokens), bcryptjs                 |
| Cache             | Redis 7, ioredis                                        |
| API Docs          | Swagger (OpenAPI)                                       |
| Security          | Helmet, CORS, rate limiting                             |
| Testing           | Vitest                                                  |
| Containerization  | Docker, docker-compose                                  |

### How to Run

#### Prerequisites

- Node.js 20+
- Docker (for MySQL and Redis)
- npm

#### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
cp .env.test.example .env.test

# 3. Start MySQL and Redis
docker compose up mysql redis -d

# 4. Generate Prisma client and create tables
npm run db:generate
npm run db:push

# 4a. Create a separate test database once, for example ticket_booking_test,
# then apply the schema to it
npm run db:test:push

# 5. (Optional) Seed test data
npm run db:seed
```

#### Development

```bash
npm run dev
```

Server starts on `http://localhost:3000`. Swagger docs available at `http://localhost:3000/docs`.

#### Production

```bash
npm run build
npm start
```

#### Full Docker

```bash
docker compose up --build
```

#### Tests

```bash
npm test
npm run test:integration
```

Integration tests load `.env.test` and will refuse to run unless `DATABASE_URL`
points to a dedicated database whose name ends with `_test`.

---

<a name="українська"></a>

## Українська

### Опис

Серверна частина системи для бронювання квитків на культурні заходи університету. Система підтримує реєстрацію та автентифікацію користувачів (JWT), управління подіями адміністраторами, транзакційне бронювання квитків, кешування через Redis та розмежування доступу за ролями.

### Технології

| Категорія        | Технологія                                            |
| ---------------- | ----------------------------------------------------- |
| Середовище       | Node.js 20+                                           |
| Мова             | TypeScript 6                                          |
| Фреймворк        | Fastify 5                                             |
| База даних       | MySQL 8                                               |
| ORM              | Prisma 7                             |
| Валідація        | Zod 4                                                 |
| Автентифікація   | JWT (access + refresh tokens), bcryptjs               |
| Кешування        | Redis 7, ioredis                                      |
| Документація API | Swagger (OpenAPI)                                     |
| Безпека          | Helmet, CORS, обмеження запитів                       |
| Тестування       | Vitest                                                |
| Контейнеризація  | Docker, docker-compose                                |

### Як запустити

#### Передумови

- Node.js 20+
- Docker (для MySQL та Redis)
- npm

#### Налаштування

```bash
# 1. Встановити залежності
npm install

# 2. Скопіювати змінні оточення
cp .env.example .env
cp .env.test.example .env.test

# 3. Запустити MySQL та Redis
docker compose up mysql redis -d

# 4. Згенерувати Prisma клієнт та створити таблиці
npm run db:generate
npm run db:push

# 4a. Один раз створити окрему test-базу, наприклад ticket_booking_test,
# і застосувати до неї схему
npm run db:test:push

# 5. (Необов'язково) Наповнити тестовими даними
npm run db:seed
```

#### Середовище розробки

```bash
npm run dev
```

Сервер запускається на `http://localhost:3000`. Swagger документація доступна за адресою `http://localhost:3000/docs`.

#### Продакшн середовище

```bash
npm run build
npm start
```

#### Повний Docker

```bash
docker compose up --build
```

#### Тести

```bash
npm test
npm run test:integration
```

Інтеграційні тести завантажують `.env.test` і відмовляються запускатися,
якщо `DATABASE_URL` не вказує на окрему базу з назвою, що закінчується на `_test`.
