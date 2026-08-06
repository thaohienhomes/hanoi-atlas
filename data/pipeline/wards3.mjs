// `out geom tags` bị hiểu là chế độ "chỉ tags" nên mất hình học.
// Dùng `out geom;` — nó in cả tags lẫn hình học.
import fs from "node:fs";

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "HaNoiAtlas/1.0 (thaohienhomes@gmail.com)";
const Q = `[out:json][timeout:900];rel(area:3600001903516)["admin_level"="6"]["boundary"="administrative"];out geom;`;

for (let round = 0; round < 3; round += 1) {
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(Q),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, Accept: "application/json" },
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      if (text.trim().startsWith("<")) throw new Error("HTML");
      fs.writeFileSync("/tmp/wards-geom.json", text);
      const d = JSON.parse(text);
      const els = d.elements || [];
      console.log(`OK ${new URL(url).host} ${(text.length / 1048576).toFixed(1)} MB, ${els.length} đơn vị`);
      const withGeom = els.filter((e) => (e.members || []).some((m) => Array.isArray(m.geometry)));
      console.log("có hình học:", withGeom.length);
      const pts = els.reduce((s, e) => s + (e.members || []).reduce((t, m) => t + (m.geometry?.length || 0), 0), 0);
      console.log("tổng đỉnh thô:", pts);
      process.exit(0);
    } catch (e) {
      console.log(`hỏng ${new URL(url).host}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 8000));
    }
  }
}
console.log("hết mirror");
process.exit(1);
