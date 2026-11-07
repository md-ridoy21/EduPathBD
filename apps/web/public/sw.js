const SHELL_CACHE = "edupath-shell-v7";
const ASSET_CACHE = "edupath-assets-v7";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/media/edupath-admission-guide-en.mp4"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/graphql") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone(); caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)); return response;
    }).catch(async () => (await caches.match("/")) || new Response("EduPath BD is offline. Reconnect once to prepare the app shell.", { headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)); }
    return response;
  })));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/#deadlines";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows[0];
    if (existing) return existing.focus().then(() => existing.navigate(target));
    return clients.openWindow(target);
  }));
});
