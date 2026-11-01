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

## Serial numbers

A serial is optional at booking. If it is missing, tick **Serial not available** and choose a reason (sticker missing or damaged, customer not at site, scheme beneficiary, or other). The ticket is stored with a null serial and **Serial pending**. Junk such as `0`, `1234` or repeated digits is rejected and never stored.

With no serial, a duplicate is an open ticket with the same mobile, customer, product or capacity, and district. A same-day match warns and links to the existing Comp. No. Overriding either case needs a written reason, which is logged.

Closing still asks for the serial, a nameplate photo, or a reason. Closures without a number stay on the **Missing serial** report. The dashboard shows the share of tickets without a serial by state, technician and source. Test-account tickets stay out of those figures.

## Checks

```bash
npm test
```
