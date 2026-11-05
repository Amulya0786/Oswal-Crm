const SHELL = ["/field", "/brand/pumps-logo.png", "/brand/pumps-favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("oswal-field-v1").then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (!url.pathname.startsWith("/field") && !url.pathname.startsWith("/brand/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open("oswal-field-v1").then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
