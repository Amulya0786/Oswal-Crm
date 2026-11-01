# Oswal Service CRM

Phase 1 of the field-service complaint desk for **Oswal Pumps Ltd, Karnal**. It replaces the Smartlogics admin desk: masters, complaint booking and the full status cycle, SLA escalation, the dashboard counters, reports, and an Excel import for the old data.

Attendance, expenses, the technician PWA, the dealer portal and Dynamics 365 Business Central are reserved for later phases. Their navigation entries and module interfaces are already in place.

## Stack

- Next.js (App Router) and TypeScript
- Prisma, SQLite locally and Postgres in production
- Session cookie signed with `jose`
- Vitest for the desk rules and one database lifecycle test

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

`db:seed` loads Indian states, districts across Haryana, Uttar Pradesh and Maharashtra, the Oswal pump catalogue, users for every role, and about 420 complaints spread across statuses and ages. It also writes `samples/smartlogics-import.xlsx`.

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@oswalpumps.local | Admin@123 |
| Call centre | callcentre@oswalpumps.local | Call@123 |
| Area manager (Karnal) | am.karnal@oswalpumps.local | Area@123 |
| State head (Haryana) | sh.haryana@oswalpumps.local | State@123 |
| Technician (Karnal) | tech.karnal@oswalpumps.local | Tech@123 |
| Dealer (Karnal) | dealer.karnal@oswalpumps.local | Dealer@123 |

The sign-in screen lists these for the demo. Remove that panel before go-live.

Try booking against mobile `9811000001` or serial `OSW00001` (Baldev Singh, Karnal). Pincode `132001` auto-assigns the Karnal service centre.

## What Phase 1 covers

- **Roles.** Admin, Call Centre, Area Manager, State Head, Technician, and a Dealer placeholder. Each user can be granted state, district and brand permissions. Technicians see the complaints assigned to them. Admins see everything.
- **Masters.** States, city/district, area/block, pincode, category, HSN, products, customer, engineer/service centre, OEM/brand, expense types, complaint issue, source, hold status, pump head, HP/capacity, check list, actual problem, actual solution, and beneficiary data. Each has create, update, delete and Excel/CSV import.
- **Complaints.** Booking creates `OPL10001`-style ticket numbers and looks up the customer by phone or serial. Types are Breakdown, Installation, Insurance, Mobile App and Scheme (MSEDCL/KUSUM). Sources are call, WhatsApp, web form, dealer and QR. Assignment follows the pincode, then the district’s default centre, and can be overridden. Hold, resume, re-assign, close (problem, solution, checklist), happy calling (1–5) and cancel are on the ticket, with a timeline, notes and attachments.
- **SLA.** Response and closing hours are configurable per type. A breach is flagged on the dashboard. `POST /api/jobs/escalate` moves a breached complaint one step: technician → area manager → state head → admin, and writes an escalation log. The scheduled job respects a cooldown; the admin button on the dashboard forces one level.
- **Dashboard.** The Smartlogics counters (pending, open, assigned, on hold, month and today login/closed/happy/cancelled, and pending by breakdown, installation, insurance and mobile app), plus scheme, ageing (0–2, 3–7, 8–15, 15+) and SLA breaches. Filters drill by state, district, technician, product and type. Every number opens the filtered list.
- **Reports.** Employee work summary, complaint summary, MSEDCL (and KUSUM) details, and technician, category, nature, problem, product, state and brand ticket counts. Filters and Excel export.
- **Notifications.** Templates for WhatsApp, SMS and email at booking, assignment, visit and closing. Closing messages include a public feedback link. The default provider writes to the console and `NotificationLog`. WhatsApp Cloud API, Gupshup and MSG91 adapters are included and stay off until their environment variables are set.
- **Smartlogics import.** Upload a workbook, map columns, preview, then commit complaints, customers, products or users. Re-importing a known legacy ticket number updates that complaint.

## Tests

```bash
npm test
npm run typecheck
```

## Deployment

Local development uses SQLite (`DATABASE_URL="file:./dev.db"`). The path is relative to `prisma/schema.prisma`.

For Postgres:

1. Start a database (`docker compose up -d` brings up Postgres 16 on port 5432).
2. In `prisma/schema.prisma`, set `provider = "postgresql"`.
3. Set `DATABASE_URL="postgresql://oswal:oswal@localhost:5432/oswal_crm?schema=public"`.
4. Run `npx prisma db push` (or `prisma migrate dev` to generate a SQL migration) and `npm run db:seed`.

Set a long `AUTH_SECRET`. Set `CRON_SECRET` and call the escalation route every hour:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-host/api/jobs/escalate
```

`vercel.json` schedules that path hourly. Vercel’s cron `Authorization: Bearer` header is accepted as well. Do not send `{"force": true}` from cron; that flag is only for a signed-in admin and skips the cooldown.

`APP_URL` is the public origin used in feedback links.

Notification providers, all optional:

| Variable | Adapter |
| --- | --- |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_ID` | WhatsApp Cloud API |
| `GUPSHUP_API_KEY`, `GUPSHUP_SRC_NAME`, `GUPSHUP_SOURCE` | Gupshup WhatsApp (used when Cloud API is not set) |
| `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID` | MSG91 SMS |
| `SMTP_URL` | Email stub that logs the message. A real mailer is a later hook. |

Until those are set, every message is printed as `[notify:sms]`, `[notify:whatsapp]` or `[notify:email]` and stored on the complaint.

Attachments are stored in the database (5 MB each). On a serverless host the SQLite file is not durable; use Postgres there. Large field photos in Phase 2 should move to object storage.

## Where later phases plug in

- `src/config/nav.ts` marks Attendance and Expenses as Phase 2. The routes are stubs.
- `src/modules/contracts.ts` defines field visits (photos, GPS, OTP, offline id), attendance, expenses, spare stock, warranty/AMC, dealer spare requests, scheme claims, and a Business Central client.
- `src/modules/phase2` and `src/modules/phase3` export stubs that throw a clear “not in this phase” error.
- `src/server/integrations/business-central.ts` is the Dynamics 365 hook. The close action in `src/server/complaints.ts` is the place to call `pushClosedComplaint` once a company and service account exist.
- Expense types are already a master, so Phase 2 claims do not need a new catalogue.

## Known gaps

- Phase 2 is not built: offline technician PWA, GPS, photos as a first-class visit, OTP closing, attendance, expenses, spare-parts stock, warranty and AMC.
- Phase 3 is not built: dealer portal beyond a scoped login, insurance and scheme claim files, and a live Business Central connection.
- WhatsApp, SMS and email are not delivered until a provider is configured. The SMTP adapter only logs.
- The UI is English only.
- Seed volumes are a few hundred complaints, not the live Smartlogics totals.
- Master search and the import run in the application process. Very large historical files should be split under the 5,000-row cap.
- Attachment bytes live in the database rather than object storage.
