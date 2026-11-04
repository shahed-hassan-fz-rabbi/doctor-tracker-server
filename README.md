# Doctor Tracker API

Doctor Tracker API is a standalone REST service for an administrator to manage doctor and patient records and view database-backed operational analytics. It uses MongoDB references and protects application data behind admin authentication.

## Features

- Versioned `/api/v1` Express REST API.
- Admin login, logout and session lookup using JWTs in HttpOnly cookies.
- Paginated doctor and patient CRUD, filters, sorting and doctor roster operations.
- MongoDB aggregation endpoints for dashboard metrics and chart data.
- Request validation, rate limits, Helmet headers, explicit credentialed CORS and centralized errors.

## Stack

Node.js, Express, MongoDB Atlas, Mongoose, Zod, JWT, bcryptjs, Helmet, CORS and express-rate-limit.

## Local setup

1. Install Node.js 20 or newer and MongoDB locally, or create an Atlas cluster.
2. In this repository, run `npm ci`.
3. Copy `.env.example` to `.env`; set a MongoDB URI and a unique random `JWT_SECRET` of at least 16 characters. Set the admin values to credentials you control.
4. Run `npm run seed:admin` to create the administrator.
5. Run `npm run dev`. The API listens on port 4000 by default.
6. Configure the client repository's `NEXT_PUBLIC_API_URL` as `http://localhost:4000/api/v1` and allow `http://localhost:3000` in `CORS_ORIGINS`.

Do not use the example admin credentials or JWT placeholder in a real environment. Never commit `.env`.

## Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode (`development`, `test`, `production`) |
| `PORT` | HTTP port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string; must include the database name, for example `.../doctor-tracker?retryWrites=true&w=majority` |
| `JWT_SECRET` | Signing secret; use a unique random value |
| `JWT_EXPIRES_IN` | JWT lifetime (default `7d`) |
| `COOKIE_NAME` | Session cookie name |
| `COOKIE_SECURE` | Set `true` when served over HTTPS |
| `CORS_ORIGINS` | Comma-separated exact frontend origins |
| `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX` | General API rate limit |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_MAX` | Login rate limit |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin seed inputs |

## API overview

All application routes except health require an admin session where noted. Responses use a common JSON envelope.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Health and Mongo connection status |
| `POST` | `/api/v1/auth/login` | Authenticate and set the session cookie |
| `POST` | `/api/v1/auth/logout` | Clear the session cookie (authenticated) |
| `GET` | `/api/v1/auth/me` | Current admin (authenticated) |
| `GET`, `POST` | `/api/v1/doctors` | List/filter/page and create doctors |
| `GET`, `PATCH`, `DELETE` | `/api/v1/doctors/:id` | Read, update or delete a doctor |
| `GET`, `POST` | `/api/v1/doctors/:id/patients` | List/add patients under a doctor |
| `DELETE` | `/api/v1/doctors/:id/patients/:patientId` | Unassign a patient without deleting the record |
| `GET`, `POST` | `/api/v1/patients` | List/filter/page and create patients |
| `GET`, `PATCH`, `DELETE` | `/api/v1/patients/:id` | Read, update or delete a patient |
| `GET` | `/api/v1/analytics/overview` | Dashboard totals and recent activity |
| `GET` | `/api/v1/analytics/patient-growth` | Monthly patient registration trend |
| `GET` | `/api/v1/analytics/patients-by-condition` | Condition distribution |
| `GET` | `/api/v1/analytics/patients-per-doctor` | Patient assignment counts |
| `GET` | `/api/v1/analytics/doctor-specializations` | Specialization distribution |

List endpoints accept validated filters and pagination parameters; see `src/validators/index.js` for accepted query fields and enums.

## Architecture and data flow

Express mounts versioned routers, then validation and authentication middleware protect controller/service operations. Services own the business logic and Mongoose queries. The client calls this API over HTTP with credentials enabled. MongoDB stores admins, doctors and patients; patient `doctorId` references a doctor. Analytics are computed in MongoDB aggregation pipelines.

## Technical decisions

1. **Use HttpOnly cookies for browser sessions.** The JWT is unavailable to JavaScript, reducing exposure to token theft from script injection. Credentialed CORS is restricted to configured origins; production must use HTTPS and secure cookies.
2. **Keep database logic in services and aggregate on MongoDB.** This makes routes/controllers thin and avoids fetching whole collections to compute dashboard results. Indexes are documented alongside the Mongoose schemas for the query patterns they support.

## Project layout

```text
src/config/       Environment and MongoDB connection
src/controllers/  HTTP handlers
src/middlewares/  Authentication, validation, rate limits and errors
src/models/       Admin, doctor and patient schemas and indexes
src/routes/       Versioned endpoint definitions
src/services/     Business logic and database operations
src/utils/        Responses, errors, logging and query helpers
src/validators/   Zod request schemas
scripts/          Admin and synthetic demo-data seed scripts
tests/            API integration tests
```

## Checks

- `npm test` — Vitest and Supertest integration tests; tests need the in-memory MongoDB binary or a configured test MongoDB URI.
- `npm run dev` — starts Express and connects to the configured database.
- `npm run seed:demo` — inserts synthetic development data; do not run against production data.

## Deployment

Create a Render Web Service from this repository's `main` branch. Set Root Directory to `.`, Runtime to Node, Build Command to `npm ci`, Start Command to `npm start`, and Health Check Path to `/api/v1/health`. The server listens on Render's injected `PORT` (the local default is `4000`).

Set these variables in the service's **Environment** page. Required means required by this deployment; optional values use the defaults shown by the actual environment schema.

| Variable | Required | Purpose | Production value |
|---|---|---|---|
| `NODE_ENV` | Yes | Runtime mode | `production` |
| `MONGODB_URI` | Yes | Atlas connection | Atlas connection string with `/doctor-tracker` as the database path; URI-encode reserved characters in username/password |
| `JWT_SECRET` | Yes | Signs session JWTs | A unique random secret at least 16 characters long; keep private |
| `COOKIE_SECURE` | Yes | Secure cross-site cookie transport | `true` |
| `CORS_ORIGINS` | Yes | Exact allowed browser origins | Actual Vercel production origin, scheme plus host only; add exact Preview origins only if used |
| `PORT` | No | HTTP listen port | Leave unset; Render supplies it |
| `JWT_EXPIRES_IN` | No | Session lifetime | `7d` default, or your chosen policy |
| `COOKIE_NAME` | No | Cookie name | `dt_token` default |
| `RATE_LIMIT_WINDOW_MINUTES` | No | General rate limit window | `15` default |
| `RATE_LIMIT_MAX` | No | General requests per window | `300` default |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | No | Login rate limit window | `15` default |
| `LOGIN_RATE_LIMIT_MAX` | No | Login attempts per window | `10` default |
| `LOG_LEVEL` | No | Server logging verbosity | `info` default; use `warn` if desired |

Do **not** set the `ADMIN_NAME`, `ADMIN_EMAIL`, or `ADMIN_PASSWORD` seed-only variables for routine runtime. The existing Atlas database already has an admin; do not run `npm run seed:admin` against it. Only seed a deliberately empty database after confirming the target and credentials. Never run `seed:demo` against production.

### MongoDB Atlas network access

In Atlas, open **Security → Network Access → IP Access List → Add IP Address**. In Render, open the created service, choose **Connect → Outbound**, and copy the outbound IP ranges for the service's region into Atlas as the narrowest supported CIDR entries. Do not use `0.0.0.0/0` for production. Add a database user with the built-in `readWrite` role scoped to `doctor-tracker`; store the URI only as Render's `MONGODB_URI` secret. Preserve the existing collections and records.

In Atlas, use **Database → Connect → Drivers** to obtain the connection string, then ensure its path is `/doctor-tracker`. If the database user's password contains reserved URI characters, percent-encode those characters in the URI (do not encode the entire URI). Never paste the connection string into source control or a public `NEXT_PUBLIC_*` variable.

After Vercel is deployed and its real origin is known, set that exact origin as `CORS_ORIGINS` in Render and redeploy. `COOKIE_SECURE=true` makes the cookie `Secure`, `HttpOnly`, and `SameSite=None` for cross-site requests; both domains must use HTTPS. Browser privacy settings may block third-party cookies, so verify the production login/session flow. Do not loosen CORS or cookie settings to hide that failure.

No external deployment has been created.

## Visual evidence

The UI belongs to the separate client repository. Desktop and mobile screenshots are published in the client README under `docs/screenshots/`.
