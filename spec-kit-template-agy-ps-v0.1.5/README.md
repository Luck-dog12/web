# Spec Kit Template

Production-ready course-commerce starter with:

- `Next.js 16` frontend in `apps/web`
- `NestJS 11` API in `apps/api`
- `Prisma 7 + PostgreSQL` for persistence
- Local `docker compose` database for delivery and handoff

## Quick Start

1. Install dependencies in the project root.
2. Start PostgreSQL with `npm run db:start`.
3. Apply Prisma migrations with `npm run db:migrate:deploy`.
4. Start web and API together with `npm run dev`.

Frontend runs on `http://localhost:3000`.
API runs on `http://localhost:3001`.

## Database

This project is configured for PostgreSQL and Prisma driver adapters:

- Runtime uses `@prisma/adapter-pg` + `pg`
- Prisma CLI reads `DIRECT_URL` first, then falls back to `DATABASE_URL`
- Local default database is `postgresql://postgres:postgres@127.0.0.1:5432/spec_kit?schema=public`
- Prisma Client is generated into `apps/api/src/generated/prisma`
- Runtime pool size can be tuned with `DATABASE_POOL_MAX`

Useful commands:

- `npm run db:start`
- `npm run db:stop`
- `npm run db:generate`
- `npm run db:migrate:dev`
- `npm run db:migrate:deploy`
- `npm run db:studio`

## Environment

Use [`.env.example`](./.env.example) as the base template.

For production:

- `DATABASE_URL` should be the runtime connection string
- `DIRECT_URL` should be a direct PostgreSQL connection for Prisma migrations
- `NEXT_PUBLIC_API_BASE_URL` should point to your deployed API origin

## Delivery Checklist

- PostgreSQL migration files are included in `apps/api/prisma/migrations`
- Local Docker database is included in `docker-compose.yml`
- API build now generates Prisma client before compiling
- Root scripts cover DB bootstrap, migrate, studio, build, and dev workflows
