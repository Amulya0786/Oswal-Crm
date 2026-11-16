# Restore a database backup into a scratch database

This checks that a DigitalOcean managed Postgres backup can be restored and that the main tables still have the same number of rows. It does not create a DigitalOcean database, cluster, or app. Use a database you already have, such as Postgres on your own machine.

## 1. Download the backup

In the DigitalOcean control panel, open the production database cluster, then Backups. Download the backup you want to test. Leave the production cluster as it is.

## 2. Restore it somewhere that is not production

Create an empty database on the machine that will hold the scratch copy:

```bash
createdb oswal_restore
pg_restore --no-owner --dbname oswal_restore /path/to/backup.dump
```

If the download is plain SQL, use `psql` instead of `pg_restore`.

## 3. Compare row counts

```bash
RESTORE_DATABASE_URL="postgresql://localhost/oswal_restore" \
EXPECT_DATABASE_URL="postgresql://..." \
node scripts/restore-test.mjs
```

`EXPECT_DATABASE_URL` is optional. Point it at a read-only copy of the source if you have one. You can also pass `EXPECT_COUNTS=./counts.json` with a JSON object of table names to numbers.

The script prints counts for Complaint, Customer, User, AuditLog, ComplaintEvent, and Engineer. It exits with an error when a count differs. It never prints the connection strings.

Do not set `RESTORE_DATABASE_URL` to the production database.
