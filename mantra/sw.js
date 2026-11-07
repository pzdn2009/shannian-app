/* 离线缓存：手冊內容不大，整站預緩存，寺院裡沒網也能用。 */

const VERSION = "shurangama-v3";
const ASSETS = [
  "./",
  "index.html",
  "read.html",
  "assets/base.css",
  "assets/core.js",
  "assets/home.js",
  "assets/reader.js",
  "assets/handbook.js",
  "assets/icon.svg",
  "manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航走网络优先，改版后能立刻看到新内容；断网时回退到缓存。
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((cached) => cached || caches.match(new URL("index.html", self.registration.scope).href))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        // 背景更新，下一次造訪即為新版
        fetch(request)
          .then((response) => {
            if (response.ok) caches.open(VERSION).then((cache) => cache.put(request, response));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(new URL("index.html", self.registration.scope).href));
    })
  );
});
