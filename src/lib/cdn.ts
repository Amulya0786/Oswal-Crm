/** Prefix a public path with the Spaces CDN. Unset CDN_BASE_URL leaves the path unchanged. */
export function cdnUrl(path: string) {
  const base = process.env.CDN_BASE_URL?.replace(/\/$/, "") || process.env.NEXT_PUBLIC_CDN_BASE_URL?.replace(/\/$/, "");
  if (!base || !path || path.startsWith("data:") || path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
