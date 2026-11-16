# Staging app

`.do/app.staging.yaml` is a second App Platform spec. It is not created on DigitalOcean. Create it only when you decide to pay for a second app and a second database.

The spec tracks the `staging` branch. It does not attach the production database cluster. `DATABASE_URL` and `DIRECT_URL` are secrets you fill in with a database that is only for staging.

## Before creating it

1. Create a branch named `staging` from the desk branch when you want a separate deploy.
2. Create a separate managed Postgres database. Do not reuse the production cluster.
3. In the spec, replace `set-a-staging-database-url` with that database's connection string for both `DATABASE_URL` and `DIRECT_URL`.
4. Set `APP_URL` to the staging hostname.
5. Set new values for `AUTH_SECRET`, `CRON_SECRET`, `OSWAL_API_KEY`, and the admin password. Do not copy production secrets.
6. Leave `SENTRY_DSN` unset until you want staging errors in Sentry. You can use a separate Sentry project.
7. Leave `PRISMA_CONNECTION_LIMIT` unset. The pool stays at 8. Set it to 12 or 16 only after that staging database is on a 2 GB plan.

Creating the app, the database, or a larger database size is a paid change. This file does not do that.

## Env vars the running app understands

| Variable | When to set it |
| --- | --- |
| `SENTRY_DSN` | Optional. Server errors go to Sentry. Leave it unset and error reporting does nothing. |
| `PRISMA_CONNECTION_LIMIT` | Optional. Integer from 1 to 20. Unset means 8, which is right for the 1 GB database. Set 12–16 only after the database is upgraded to 2 GB. |
| `CRON_SECRET` | Already required in production. `POST /api/cron/work` with header `x-cron-key` drains the background queue. |
| `COOKIE_SECURE` | Optional. `1` forces the Secure cookie flag outside production. Production already sets it. |
| `DATABASE_URL` | The app database. Staging must have its own. |
| `DIRECT_URL` | Same database, direct connection, used by migrations. |
