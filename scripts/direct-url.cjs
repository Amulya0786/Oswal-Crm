"use strict";

// prisma migrate deploy reads DIRECT_URL. Until the app spec sets it, use the direct DATABASE_URL.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
