# Oswal Service

Service desk for Oswal Pumps Ltd and Oswal Solar Energy. One shared complaint number series. Pump complaints, including PM-KUSUM, solar pumps, motors, controllers and RMS, are tagged Oswal Pumps. Oswal Solar is only panels, modules, rooftop systems and inverters. The booking form sets that company from the product category, and the agent can still change it.

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

Complaint imports keep a row only when Book Date is on or after **1 April 2026**. That is a fixed cutoff, not a full year and not a rolling twelve months. Set `IMPORT_CUTOFF` (or the date on the import screen) to move it. The file can be a Smartlogics CSV of about 70,000 rows; rows are written in batches of 100. The result reports how many were skipped because they are older, and how many had no book date. Book dates use `DD-Mon-YYYY`, for example `01-Apr-2026`. Closed and Happy Calling Done are stored as finished history. Do not commit a customer export to the repo. Uploaded files stay in `data/imports`, which is gitignored.

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
| `SPEECH_URL`, `SPEECH_KEY` | Speech to text for voice notes, including Hindi. Without them the transcript is a mock line and the audio is stored on local disk (`STORAGE_DIR` or `data/uploads`). |
| `AI_API_KEY` | Booking hints, fix steps, the daily management note, plain-language questions, SLA risk wording, and timeline summaries. Without it those answers are a local mock. |

`STORAGE_DIR` is the object-storage stand-in. Development writes files to disk.

## Technician phone app

The Android and iOS projects live in `mobile/`. See `mobile/README.md` for the Play Store and TestFlight steps. Google Play Developer and Apple Developer accounts are required for store builds. Push stays a log until `FCM_SERVER_KEY` or `APNS_KEY_ID` is set.

## Customer tracking and WhatsApp menu

A booking message includes `/track/<token>`. The same status is available from `/track` with the Comp. No, mobile and OTP. The WhatsApp webhook understands a small menu: book, status, or ask for a call back. Booking uses the same company rule as the desk. Without WhatsApp keys the replies are only logged.

## Power BI and Excel

Admins open **Power BI** and create a reporting key. The page shows the Web and OData addresses. Excel uses Data → From Web. Power BI uses Get data → OData or Web. Revoking a key stops that feed. The key is shown once.
