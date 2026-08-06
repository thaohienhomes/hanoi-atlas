// Trạm sạc xe điện ở Hà Nội từ OpenStreetMap (amenity=charging_station).
const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const q = `[out:json][timeout:90];
(
  node["amenity"="charging_station"](20.85,105.60,21.25,106.05);
  way["amenity"="charging_station"](20.85,105.60,21.25,106.05);
);
out center tags;`;

let data = null;
for (const url of MIRRORS) {
  try {
    const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "HaNoiAtlas/1.0 (thaohienhomes@gmail.com)", Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const text = await r.text();
    if (text.trim().startsWith("<")) throw new Error("HTML thay vì JSON");
    data = JSON.parse(text);
    console.log("mirror OK:", url);
    break;
  } catch (e) {
    console.log("hỏng:", url, e.message);
    await new Promise((r) => setTimeout(r, 8000));
  }
}
if (!data) process.exit(1);

const els = data.elements || [];
console.log("tổng phần tử:", els.length);

const rows = els.map((e) => {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  const t = e.tags || {};
  return {
    lat, lon,
    name: t.name || t.operator || t.brand || "",
    operator: t.operator || t.brand || "",
    socket: Object.keys(t).filter((k) => k.startsWith("socket:")).join(","),
    capacity: t.capacity || "",
    access: t.access || "",
    motorcar: t.motorcar || "",
    motorcycle: t.motorcycle || "",
  };
}).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

console.log("có toạ độ:", rows.length);
const byOp = {};
rows.forEach((r) => { const k = r.operator || "(không ghi)"; byOp[k] = (byOp[k] || 0) + 1; });
console.log("theo đơn vị vận hành:");
Object.entries(byOp).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log("  ", String(v).padStart(4), k));
console.log("có tên riêng:", rows.filter((r) => r.name).length);
console.log("ghi motorcycle=yes:", rows.filter((r) => r.motorcycle === "yes").length);

(await import("node:fs")).default.writeFileSync("/tmp/charge.json", JSON.stringify(rows));
