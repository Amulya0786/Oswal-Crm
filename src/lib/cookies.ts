/** Secure is on in production and whenever COOKIE_SECURE=1. Local http stays usable. */
export function cookieFlags(httpOnly: boolean, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";
  return { httpOnly, sameSite: "lax" as const, secure, path: "/", maxAge };
}
