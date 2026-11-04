# Isolated public demo environment

The public demo is a separate API service and Atlas database. Its API process accepts only `DEMO_MODE=true`, a `DEMO_MONGODB_URI` whose path is exactly `/doctor-tracker-demo`, and a separate `DEMO_JWT_SECRET`. It rejects production database/JWT settings, production admin seed credentials, Google OAuth credentials, and temporary seed credentials. The runtime service should contain no production credentials at all.

## Atlas users

- **Runtime user:** grant `read` on `doctor-tracker-demo` only. The runtime never creates indexes; index creation happens during the one-time seed using the temporary user.
- **Temporary seed user:** grant `readWrite` on `doctor-tracker-demo` only. Do not grant cluster-wide or admin roles. Use this user only for seeding, then revoke/delete it in Atlas and remove its URI from the local process/environment.
- Neither user should be reused by production.

## Safe setup sequence

1. Create a new Atlas database named `doctor-tracker-demo` in a cluster isolated from the production database user. Add only the intended developer/seed IP range temporarily to Network Access.
2. Create a temporary database user with `readWrite` on `doctor-tracker-demo`. Store its connection URI locally outside the repository as `DEMO_SEED_MONGODB_URI`; the URI database path must be `/doctor-tracker-demo` and reserved credential characters must be percent encoded.
3. Run `npm run seed:demo`. It refuses a non-demo database URI and a database containing any records. It creates only synthetic doctors and patients.
4. Generate a one-time demo password securely. Set `DEMO_ACCOUNT_EMAIL` and `DEMO_ACCOUNT_PASSWORD` only in the local process running `npm run seed:demo-account`. The script verifies the expected synthetic counts/domains and refuses existing Admin, Google User, or demo account records. It hashes the password and clears credential variables from its process on exit.
5. Revoke/delete the temporary Atlas user in Atlas. Do not proceed until that has been confirmed. The account script reports successful provisioning, but it cannot revoke Atlas database users because it has no Atlas control-plane credentials.
6. Create a separate Atlas database user with `read` on `doctor-tracker-demo` only. Configure it in the demo Render service as `DEMO_MONGODB_URI`.
7. Configure the demo Render service with `DEMO_MODE=true`, `DEMO_MONGODB_URI`, a newly generated `DEMO_JWT_SECRET` (32+ random characters), `COOKIE_NAME=dt_demo_token`, `COOKIE_SECURE=true`, exact demo frontend `CORS_ORIGINS`, and matching `FRONTEND_ORIGIN`. Do **not** set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_*`, `GOOGLE_*`, or `DEMO_SEED_MONGODB_URI` there.
8. Create a separate Vercel project connected to the client repository. Set `NEXT_PUBLIC_APP_ENV=demo`, `NEXT_PUBLIC_DEMO_API_URL=https://<demo-render-host>/api/v1`, `NEXT_PUBLIC_DEMO_EMAIL`, and the approved `NEXT_PUBLIC_DEMO_PASSWORD`. `NEXT_PUBLIC_*` values are public and included in the client bundle. Keep production Vercel variables unchanged and set production `NEXT_PUBLIC_APP_ENV=production` (or omit it).

Deployment requires a separate explicit approval. The present work does not create Atlas users/databases, change Render/Vercel settings, or deploy.
