# Oswal Service

Service desk for Oswal Pumps Ltd and Oswal Solar Energy. One shared complaint number series. Pump complaints, including PM-KUSUM, solar pumps, motors, controllers and RMS, are tagged Oswal Pumps. Oswal Solar is only panels, modules, rooftop systems and inverters. The booking form sets that company from the product category, and the agent can still change it.

## Put it online on DigitalOcean

The app and the database run in **Bangalore**. Deploy the branch `cursor/oswal-service-crm-5f17`. That branch has `.do/app.yaml`. Do not run `npm run seed` on DigitalOcean. The seed wipes the database and adds the demo login. The first start creates only the two companies, the SLA hours, the close-proof defaults, and one admin.

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Amulya0786/Oswal-Crm/tree/cursor/oswal-service-crm-5f17)

1. Create a DigitalOcean account and sign in at [cloud.digitalocean.com](https://cloud.digitalocean.com).
2. Connect GitHub when asked, and authorize **Amulya0786/Oswal-Crm**.
3. The Space **oswal-service-files** is in **Singapore (SGP1)**, not Bangalore. Leave it private (restrict file listing). Under **API** → **Spaces Keys**, generate a key with read and write if you do not already have one. Copy the key and the secret. You will not see the secret again.
4. Open the button above, or choose **Create** → **Apps** → **GitHub** and pick **Amulya0786/Oswal-Crm**, branch **cursor/oswal-service-crm-5f17**. DigitalOcean reads `.do/app.yaml`.
5. Check the app region is **Bangalore**. The spec creates a web service and attaches the managed Postgres cluster `oswal-pg` in that region. A pre-deploy step runs the migrations and the first-admin setup. The database keeps its own default database name and user.
6. On the environment screen, replace the placeholders:
   - `ADMIN_EMAIL`: the owner’s email.
   - `ADMIN_INITIAL_PASSWORD`: at least 8 characters.
   - `AUTH_SECRET`, `CRON_SECRET`, `OSWAL_API_KEY`: three long random strings. A password manager can make them. Anything starting with `enter-` is rejected.
   - `S3_ACCESS_KEY` and `S3_SECRET_KEY`: the Spaces key from step 3.
   - Leave `S3_ENDPOINT` as `https://sgp1.digitaloceanspaces.com`, `S3_REGION` as `sgp1`, and `S3_BUCKET` as `oswal-service-files`. `APP_URL` is filled in by DigitalOcean.
   - Leave WhatsApp, SMS, speech, AI and push empty.
7. Deploy. The first build uses the Dockerfile. Before the site goes live, the migrate job updates the database. If the admin email or password is still a placeholder, that job stops and the log says what to fill in. Fix it and redeploy.
8. The URL is on the app page. It looks like `https://oswal-service-xxxxx.ondigitalocean.app`. Open it and sign in with the email and password you entered.
9. The desk asks for a new password before anything else. After that, clear `ADMIN_INITIAL_PASSWORD` in the app’s environment so the starting password is not kept there.
10. Health is `https://<your-url>/api/health` and should answer `{"ok":true}`. Tracking links use `APP_URL`, which DigitalOcean sets to the live address.

Photos, signatures, voice notes and import files go to the private Space in Singapore. A download link is a short-lived signed URL. Without the Space keys, files stay on the container disk and disappear on the next deploy. Local development still uses the `data/` folder. The app and the database stay in Bangalore.

WhatsApp, SMS, speech, AI and phone push stay in log or mock mode until those keys are added later. Nothing is sent out.

### Custom domain later

When IT is ready for `service.oswalpumps.com`:

1. On the app, open **Settings** → **Domains** → add `service.oswalpumps.com`.
2. DigitalOcean shows a hostname such as `oswal-service-xxxxx.ondigitalocean.app`.
3. IT adds a DNS record: **CNAME** `service` → that `ondigitalocean.app` hostname.
4. Wait until the certificate is issued.
5. Make `service.oswalpumps.com` the primary domain. `APP_URL` is tied to the app URL, so tracking links pick up that name on the next deploy.

### What it costs

List prices in November 2026, before tax. Rupees use ₹94.95 per US dollar on 1 November 2026. The old Basic and Professional app tiers are gone. You pick a container size instead.

**Testing**

| Piece | Size | USD / month | INR / month |
| --- | --- | --- | --- |
| App container | 1 vCPU, 1 GB (`apps-s-1vcpu-1gb`) | $10 | ₹950 |
| Managed Postgres | Smallest, 1 GB RAM, 10 GB disk, daily backups included | $15.15 | ₹1,440 |
| Spaces | $5 plan, 250 GB and 1 TB transfer | $5 | ₹475 |
| **Total** | | **about $30** | **about ₹2,860** |

The migrate job uses the same container size only while it runs, a few cents a deploy. A 512 MB container is $5, and it is too small for this app.

**About 15,000 open tickets**

That many open complaints is a small database. The bill is the app staying on and the database, not the row count. Photos are what grow, and the $5 Space includes 250 GB.

| Piece | Size | USD / month | INR / month |
| --- | --- | --- | --- |
| App container | 1 vCPU, 2 GB | $25 | ₹2,370 |
| Managed Postgres | 2 GB RAM, 30 GB disk | $30.45 | ₹2,890 |
| Spaces | same $5 plan | $5 | ₹475 |
| **Total** | | **about $60** | **about ₹5,740** |

If many people are on the desk at once, move the app to 2 vCPU and 4 GB ($50) and the database to 4 GB RAM ($60.90). That is about **$116** a month, about **₹11,000**, plus the same $5 Space. Extra database disk is $0.215 per GB. Extra Space storage is $0.02 per GB after 250 GB.

### Backups

Managed Postgres in Bangalore includes a daily backup and can restore to a point in the last seven days. That is already on for the production database in the spec. The $5 Space does not back up the database. Keep the Space, because that is where the photos live. A dev database attached only to an app is not backed up. Do not switch this app to one.

## Setup

Postgres 16, Node 22.

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

`DATABASE_URL` in `.env.example` matches the local role `oswal` / `oswal` and database `oswal`. `docker compose up -d` starts that Postgres if you do not already have one.

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@oswal.test | Admin@123 |
| Test account (excluded from MIS) | test.user@oswal.test | Test@123 |

## Smartlogics history

Comp. No values use three digits through 999 in a day (`OPL261101001`). From the 1000th complaint that day the number keeps growing (`OPL2611011000`). That longer number is still valid.

Complaint imports keep a row only when Book Date is on or after **1 April 2026**. That is a fixed cutoff, not a full year and not a rolling twelve months. Set `IMPORT_CUTOFF` (or the date on the import screen) to move it. The file can be a Smartlogics CSV of about 70,000 rows; rows are written in batches of 100. The result reports how many were skipped because they are older, and how many had no book date. Book dates use `DD-Mon-YYYY`, for example `01-Apr-2026`. Closed and Happy Calling Done are stored as finished history. Do not commit a customer export to the repo. Uploaded files stay in `data/imports` locally, or in the Space when that is configured. Do not commit them.

## Serial numbers

A serial is optional at booking. If it is missing, tick **Serial not available** and choose a reason (sticker missing or damaged, customer not at site, scheme beneficiary, or other). The ticket is stored with a null serial and **Serial pending**. Junk such as `0`, `1234` or repeated digits is rejected and never stored.

With no serial, a duplicate is an open ticket with the same mobile, customer, product or capacity, and district. A same-day match warns and links to the existing Comp. No. Overriding either case needs a written reason, which is logged.

Closing still asks for the serial, a nameplate photo, or a reason. Closures without a number stay on the **Missing serial** report. The dashboard shows the share of tickets without a serial by state, technician and source. Test-account tickets stay out of those figures.

## Checks

```bash
npm test
```

## Phase 2

The desk keeps working with no extra keys. Messages are logged, the map uses OpenStreetMap, and the public form shows the OTP in the response until a provider is configured.

| Key | Used for |
| --- | --- |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Meta WhatsApp Cloud API |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification at `GET /api/public/whatsapp` |
| `WHATSAPP_TEMPLATE_OSWAL_REGISTERED_EN` (and the other `WHATSAPP_TEMPLATE_*` names) | Optional approved template name. Without it, Cloud API sends the text body |
| `WHATSAPP_BSP_URL`, `WHATSAPP_BSP_KEY`, `WHATSAPP_BSP_NAME` | Generic BSP (Interakt, AiSensy, or similar). JSON `POST` with `to` and `text` |
| `GUPSHUP_API_KEY`, `GUPSHUP_SOURCE`, `GUPSHUP_SRC_NAME` | Gupshup, used when the generic BSP URL is not set |
| `SUMMARY_EMAIL` | Daily summary recipient. Mail stays in the log until `SMTP_URL` is wired |
| `SUMMARY_WHATSAPP` | Comma-separated manager mobiles for the same summary |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` or `GOOGLE_MAPS_KEY` | Optional. Default tiles are OpenStreetMap via Leaflet |
| `VISIT_RATE` | Rupees per closed visit on the technician earnings screen. Blank shows the visit count only |
| `AUTH_SECRET` | Signs the public-form captcha |
| `MSG91_AUTH_KEY` | When set, booking and track OTPs are not returned in the API response |

Webhook for inbound status and opt-out: `POST /api/public/whatsapp`. A customer can send the Comp. No or their mobile. `STOP` or `बंद` opts out. `START` opts back in. Five WhatsApp messages per mobile per hour.

Website form: `/book`, also embeddable in an iframe. It asks for a mobile OTP and a captcha before it books into the same OPL sequence.

Technician app: `/field` (installable PWA). Visits, GPS check-in, attendance and earnings. Offline posts wait on the phone and retry when the network returns.

Telephony is a stub. `/calls` looks up a caller by mobile and writes a call on the ticket. No PBX is attached.

Info@ email booking, Business Central and the dealer portal are not in this phase.

## Phase 3

These stay in log or mock mode until the key is set. Nothing is sent to a real model or a speech service without one.

| Key | Used for |
| --- | --- |
| WhatsApp keys from Phase 2 | Rating message after a close. The customer replies `1` to `5` and an optional comment. A score of 2 or less is escalated. Happy calling on the desk remains for customers who are not on WhatsApp. |
| `GPS_MAX_KM` | How far a closing pin may be from the customer pin before it is flagged. Default 15. Proof rules per call type are saved in the app. |
| `SPEECH_URL`, `SPEECH_KEY` | Speech to text for voice notes, including Hindi. Without them the transcript is a mock line and the audio is stored with the other files. |
| `AI_API_KEY` | Booking hints, fix steps, the daily management note, plain-language questions, SLA risk wording, and timeline summaries. Without it those answers are a local mock. |

Development writes files under `data/`. With `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY` and `S3_SECRET_KEY` set, the same files go to a private Space and downloads use a signed link.

## Technician phone app

The Android and iOS projects live in `mobile/`. See `mobile/README.md` for the Play Store and TestFlight steps. Google Play Developer and Apple Developer accounts are required for store builds. Push stays a log until `FCM_SERVER_KEY` or `APNS_KEY_ID` is set.

## Customer tracking and WhatsApp menu

A booking message includes `/track/<token>`. The same status is available from `/track` with the Comp. No, mobile and OTP. The WhatsApp webhook understands a small menu: book, status, or ask for a call back. Booking uses the same company rule as the desk. Without WhatsApp keys the replies are only logged.

## Power BI and Excel

Admins open **Power BI** and create a reporting key. Send it only in the `x-report-key` header. A `?key=` query is rejected. Keys can expire, can be limited to a state or brand, and can be revoked. The page shows when a key was last used. The secret is shown once.

## Staging

Use a second DigitalOcean app from the same spec, with its own name and its own managed Postgres. Do not point it at the live database. Leave `NEXT_PUBLIC_DEMO_HINTS` unset. The live import and the live users stay on the production app. This document does not create that app.

## Backups

DigitalOcean managed Postgres takes a daily backup. Restore it once on the staging database: in the database page choose a backup, restore into the staging cluster, then open staging `/api/health` and confirm `db` is true. Do not restore a backup over the live database. This does not change the paid plan.

## Error monitoring

Set `SENTRY_DSN` if you want the app to forward errors. Leave it empty and nothing is sent. `/api/health` checks that Postgres answers.

## Mail

Password reset and the bulk user import send a 30-minute link when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` are set. Without them the link is not emailed.
