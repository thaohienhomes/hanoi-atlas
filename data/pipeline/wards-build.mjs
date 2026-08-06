// Overpass trả các đoạn way rời của quan hệ ranh giới; phải nối lại thành
// vòng kín trước khi dùng. Sau đó rút gọn và mã hoá delta cho gọn.
import fs from "node:fs";

const R = 6371000;
const toRad = Math.PI / 180;

function perpDist(p, a, b) {
  const bx = (b[1] - a[1]) * toRad * R * Math.cos(a[0] * toRad);
  const by = (b[0] - a[0]) * toRad * R;
  const px = (p[1] - a[1]) * toRad * R * Math.cos(a[0] * toRad);
  const py = (p[0] - a[0]) * toRad * R;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  let t = (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - t * bx, py - t * by);
}

function simplify(points, tol) {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, idx + 1), tol).slice(0, -1), ...simplify(points.slice(idx), tol)];
}

const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;

// Nối các đoạn thành vòng: bám đuôi, thử cả chiều xuôi lẫn chiều ngược.
function stitch(segments) {
  const pool = segments.filter((s) => s.length > 1).map((s) => s.slice());
  const rings = [];
  while (pool.length) {
    let ring = pool.shift();
    let grew = true;
    while (grew) {
      grew = false;
      const head = key(ring[0]);
      const tail = key(ring[ring.length - 1]);
      if (head === tail) break;
      for (let i = 0; i < pool.length; i += 1) {
        const seg = pool[i];
        const a = key(seg[0]);
        const b = key(seg[seg.length - 1]);
        if (a === tail) { ring = ring.concat(seg.slice(1)); }
        else if (b === tail) { ring = ring.concat(seg.slice(0, -1).reverse()); }
        else if (b === head) { ring = seg.slice(0, -1).concat(ring); }
        else if (a === head) { ring = seg.slice(1).reverse().concat(ring); }
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

const parts = JSON.parse(fs.readFileSync("/tmp/wards-geom-parts.json", "utf8"));
const tol = Number(process.argv[2] || 40);
const out = [];
let dropped = 0;

for (const el of Object.values(parts)) {
  const name = el.tags?.name || "";
  const outer = (el.members || []).filter((m) => m.type === "way" && m.role !== "inner" && Array.isArray(m.geometry));
  const rings = stitch(outer.map((m) => m.geometry));
  rings.sort((a, b) => b.length - a.length);
  const best = rings[0];
  if (!best || best.length < 4) { dropped += 1; continue; }
  const closed = key(best[0]) === key(best[best.length - 1]);
  const pts = (closed ? best : [...best, best[0]]).map((p) => [p.lat, p.lon]);
  const simple = simplify(pts, tol).map(([a, b]) => [Number(a.toFixed(4)), Number(b.toFixed(4))]);
  const dedup = simple.filter((p, i) => i === 0 || p[0] !== simple[i - 1][0] || p[1] !== simple[i - 1][1]);
  out.push({
    n: name.replace(/^(Phường|Xã|Thị trấn)\s+/, ""),
    k: /^Phường/.test(name) ? "p" : /^Xã/.test(name) ? "x" : "t",
    pop: Number(el.tags?.population) || 0,
    r: dedup,
  });
}

out.sort((a, b) => a.n.localeCompare(b.n, "vi"));
const totalPts = out.reduce((s, w) => s + w.r.length, 0);
console.log(`tol ${tol} m · ${out.length} đơn vị · ${totalPts} đỉnh · bỏ ${dropped}`);
console.log("loại:", JSON.stringify(out.reduce((m, w) => ({ ...m, [w.k]: (m[w.k] || 0) + 1 }), {})));
console.log("dân số tổng:", out.reduce((s, w) => s + w.pop, 0).toLocaleString("vi-VN"));

// Mã hoá: mỗi dòng "tên|loại|dân số|dlat,dlng dlat,dlng ..." (delta 1e-4 độ)
const lines = out.map((w) => {
  let la = 0;
  let ln = 0;
  const ring = w.r.map(([a, b]) => {
    const ia = Math.round(a * 1e4);
    const ib = Math.round(b * 1e4);
    const s = `${ia - la},${ib - ln}`;
    la = ia;
    ln = ib;
    return s;
  }).join(" ");
  return `${w.n}|${w.k}|${w.pop}|${ring}`;
});
const packed = lines.join("\n");
fs.writeFileSync("/tmp/wards-packed.txt", packed);
console.log("gói bytes:", Buffer.byteLength(packed), "| chars:", packed.length);

// kiểm tra giải mã lại
const back = packed.split("\n").map((line) => {
  const [n, k, pop, ring] = line.split("|");
  let la = 0;
  let ln = 0;
  return { n, k, pop: Number(pop), r: ring.split(" ").map((t) => {
    const [da, db] = t.split(",").map(Number);
    la += da; ln += db;
    return [la / 1e4, ln / 1e4];
  }) };
});
const same = JSON.stringify(back.map((w) => [w.n, w.k, w.pop, w.r])) === JSON.stringify(out.map((w) => [w.n, w.k, w.pop, w.r]));
console.log("giải mã khớp:", same);
fs.writeFileSync("/tmp/wards-final.json", JSON.stringify(out));
