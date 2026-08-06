// Service worker cho Hà Nội Atlas: lưu sẵn khung ứng dụng để khách du lịch
// mở lại được cả khi 4G chập chờn. Dữ liệu sống (Sheet, thời tiết) luôn đi
// thẳng ra mạng — mất mạng thì app tự dùng dữ liệu đóng gói.
//
// A tiny app-shell cache so the map still opens on a flaky connection.
// Live data (Google Sheet, Open-Meteo) always goes straight to the network.

const CACHE = "hanoi-atlas-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isLive(url) {
  return (
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("docs.google.com") ||
    url.hostname.includes("script.google.com")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isLive(url)) return; // để trình duyệt tự lo

  // Trang HTML: ưu tiên bản mới, hỏng mạng thì lấy bản đã lưu.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html").then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // Tài nguyên build (JS/CSS/ảnh) có hash trong tên: lấy cache trước cho nhanh.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
