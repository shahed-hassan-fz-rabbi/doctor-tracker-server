# Doctor Tracker — API

This repository contains the Express API used by the Doctor Tracker dashboard. It handles admin sign-in, doctor and patient records, doctor-patient assignments, and the data used by the dashboard and analytics pages.

The API stores its data in MongoDB through Mongoose. The client and server are separate applications; the browser talks to this API over REST and never connects to MongoDB directly.

## Features

- Versioned REST endpoints under `/api/v1`.
- Admin login, session verification, and logout using a JWT in an HttpOnly cookie.
- An isolated public demo API with read-only viewer sessions and synthetic data.
- Doctor and patient CRUD, search, filters, sorting, and server-side pagination.
- Doctor-patient relationships and roster endpoints.
- MongoDB aggregations for dashboard and analytics data.
- Request validation, rate limits, Helmet headers, explicit credentialed CORS, and centralized error handling.

## Built with

Node.js, Express, MongoDB Atlas, Mongoose, Zod, JWT, bcryptjs, Helmet, CORS, and express-rate-limit.

## Screenshots

The screenshots are stored with the client repository and show the dashboard against development data.

![Doctor Tracker dashboard](https://raw.githubusercontent.com/shahed-hassan-fz-rabbi/doctor-tracker-client/main/docs/screenshots/dashboard-desktop.png)

[Browse the full screenshot set](https://github.com/shahed-hassan-fz-rabbi/doctor-tracker-client/tree/main/docs/screenshots), including desktop and mobile views.

## Run locally

You’ll need Node.js 20 or newer and a MongoDB database, either local or in Atlas.

```bash
npm ci
```

Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique `JWT_SECRET` of at least 16 characters. The MongoDB URI must include the database name, such as `/doctor-tracker`.

Start the API:

```bash
npm run dev
```

The default local port is `4000`. The client’s `NEXT_PUBLIC_API_URL` should be `http://localhost:4000/api/v1`, and `CORS_ORIGINS` must include the exact client origin (usually `http://localhost:3000`).

Never commit `.env` or use the example values as real credentials. Admin credentials are not stored in `.env`: run `npm run seed:admin` from a private interactive terminal only when the production database has no Admin account. The script asks for the email, then reads the password without echoing it. It hashes the password, creates the first Admin once, and refuses to reset or duplicate an existing account. The seed scripts are for setup and development; don’t run the demo-data seed against production.

## Configuration

| Variable | Purpose | Notes |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development`, `test`, or `production` |
| `PORT` | HTTP port | Defaults to `4000`; Render provides this in production |
| `MONGODB_URI` | MongoDB connection | Required; include `/doctor-tracker` in the database path |
| `JWT_SECRET` | Signs application sessions | Required; use a private random value of at least 16 characters |
| `JWT_EXPIRES_IN` | Session lifetime | Defaults to `7d` |
| `COOKIE_NAME` | Session cookie name | Defaults to `dt_token` |
| `COOKIE_SECURE` | HTTPS-only cookie setting | Set `true` in production |
| `CORS_ORIGINS` | Allowed frontend origins | Comma-separated exact origins; no wildcard with credentials |
| `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX` | General API limit | Defaults are in `.env.example` |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_MAX` | Login API limit | Defaults are in `.env.example` |
| `LOG_LEVEL` | Server log verbosity | Defaults to `info` |

## API overview

Production doctor, patient, relationship, and analytics endpoints require an Admin session. The isolated demo service accepts only its dedicated viewer session for reads and rejects all writes. Successful responses use a common JSON envelope.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | API and MongoDB health |
| `POST` | `/api/v1/auth/login` | Sign in and set the session cookie |
| `GET` | `/api/v1/auth/me` | Check the current session |
| `POST` | `/api/v1/auth/logout` | Clear the session cookie |
| `GET`, `POST` | `/api/v1/doctors` | List, filter, paginate, or create doctors |
| `GET`, `PATCH`, `DELETE` | `/api/v1/doctors/:id` | View, edit, or delete a doctor |
| `GET`, `POST` | `/api/v1/doctors/:id/patients` | View or add patients for a doctor |
| `DELETE` | `/api/v1/doctors/:id/patients/:patientId` | Unassign a patient without deleting the record |
| `GET`, `POST` | `/api/v1/patients` | List, filter, paginate, or create patients |
| `GET`, `PATCH`, `DELETE` | `/api/v1/patients/:id` | View, edit, or delete a patient |
| `GET` | `/api/v1/analytics/*` | Dashboard and analytics aggregations |

List query options and validation rules are defined in `src/validators/index.js`.

## Project layout

```text
src/config/       Environment and MongoDB connection
src/controllers/  HTTP handlers
src/middlewares/  Authentication, validation, rate limits, and errors
src/models/       Admin, doctor, and patient schemas
src/routes/       Versioned API routes
src/services/     Business logic and MongoDB queries
src/utils/        Responses, errors, logging, and query helpers
src/validators/   Request schemas
scripts/          Admin and synthetic demo-data seed scripts
tests/            API integration tests
```

## Checks

```bash
npm test
npm start
```

The test suite uses an isolated in-memory MongoDB. `npm run seed:demo` is for synthetic development data only.

## Deploy to Render

Create a Web Service from `shahed-hassan-fz-rabbi/doctor-tracker-server`, using branch `main` and the repository root (`.`). Set Runtime to Node, Build Command to `npm ci`, Start Command to `npm start`, and Health Check Path to `/api/v1/health`.

Set these values in the Render service’s Environment page:

| Variable | Production setting |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string with `/doctor-tracker` as the database path; keep it private |
| `JWT_SECRET` | Unique random value, at least 16 characters; keep it private |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGINS` | The exact Vercel origin, with no path or trailing slash |
| `PORT` | Leave unset; Render supplies it |

The API is deployed at [`https://doctor-tracker-server-29dm.onrender.com`](https://doctor-tracker-server-29dm.onrender.com). Its health endpoint is `/api/v1/health`.

In MongoDB Atlas, grant the application database user `readWrite` access to `doctor-tracker`. Add the Render service’s outbound IP ranges to Atlas Network Access; don’t use `0.0.0.0/0` for production. If a username or password contains reserved URI characters, percent-encode those characters in the connection string. Store the URI only in Render’s `MONGODB_URI` setting. Keep `COOKIE_SECURE=true` and both services on HTTPS so the session cookie can be sent securely.

The existing database already has its admin and records. The Admin setup script is a no-op for the matching existing account and refuses to create a second Admin. Don’t run `seed:demo` against production.
