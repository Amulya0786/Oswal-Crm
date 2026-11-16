/** Public site address used in links. Set APP_URL to the live site. */
export function publicOrigin() {
  const value = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  return value.replace(/\/$/, "");
}
