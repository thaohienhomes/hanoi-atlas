// Rút gọn ranh giới 9 phường cho vừa một lớp deploy, mà vẫn đúng hình ở mức
// phóng người ta thực sự dùng (z11–z15). Douglas–Peucker theo mét, rồi làm
// tròn 4 chữ số (~11 m).
import fs from "node:fs";

const R = 6371000;
const toRad = Math.PI / 180;

function metres(a, b) {
  const dLat = (b[0] - a[0]) * toRad * R;
  const dLng = (b[1] - a[1]) * toRad * R * Math.cos(((a[0] + b[0]) / 2) * toRad);
  return Math.hypot(dLat, dLng);
}

function perpDist(p, a, b) {
  const ax = 0;
  const ay = 0;
  const bx = (b[1] - a[1]) * toRad * R * Math.cos(a[0] * toRad);
  const by = (b[0] - a[0]) * toRad * R;
  const px = (p[1] - a[1]) * toRad * R * Math.cos(a[0] * toRad);
  const py = (p[0] - a[0]) * toRad * R;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  if (len2 === 0) return Math.hypot(px, py);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

function simplify(points, tol) {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, idx + 1), tol).slice(0, -1),
    ...simplify(points.slice(idx), tol),
  ];
}

const raw = JSON.parse(fs.readFileSync("/tmp/lez-slim.json", "utf8"));
const tol = Number(process.argv[2] || 25);

const out = raw.map((ward) => {
  const ring = ward.r[0] ?? ward.r;
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring;
  const simple = simplify([...open, open[0]], tol);
  const rounded = simple.map(([lat, lng]) => [Number(lat.toFixed(4)), Number(lng.toFixed(4))]);
  // bỏ đỉnh trùng sau khi làm tròn
  const dedup = rounded.filter((p, i) => i === 0 || p[0] !== rounded[i - 1][0] || p[1] !== rounded[i - 1][1]);
  return { n: ward.n, r: dedup };
});

const before = raw.reduce((s, w) => s + (w.r[0] ?? w.r).length, 0);
const after = out.reduce((s, w) => s + w.r.length, 0);
console.log(`tol ${tol} m: ${before} → ${after} đỉnh`);
out.forEach((w) => console.log("  ", w.n.padEnd(24), w.r.length));

// literal gọn cho main.js: [lat,lng] nối liền, không khoảng trắng
const literal = out
  .map((w) => `  ["${w.n}", [${w.r.map(([a, b]) => `[${a},${b}]`).join(",")}]],`)
  .join("\n");
fs.writeFileSync("/tmp/lez-literal.txt", literal);
console.log("literal bytes:", Buffer.byteLength(literal));

// kiểm tra sai lệch hình: khoảng cách lớn nhất từ đỉnh gốc tới cạnh đã rút gọn
let worst = 0;
raw.forEach((ward, i) => {
  const ring = ward.r[0] ?? ward.r;
  const simple = out[i].r;
  ring.forEach((p) => {
    let best = Infinity;
    for (let k = 0; k < simple.length - 1; k += 1) best = Math.min(best, perpDist(p, simple[k], simple[k + 1]));
    worst = Math.max(worst, best);
  });
});
console.log("lệch tối đa so với ranh giới gốc:", Math.round(worst), "m");
