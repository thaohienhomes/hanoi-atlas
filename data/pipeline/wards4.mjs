// Một cú lấy hết 126 ranh giới thì mirror nào cũng 504. Chia thành từng mẻ
// nhỏ theo id, nghỉ giữa các mẻ, ghi dần ra đĩa để chạy lại không mất công.
import fs from "node:fs";

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "HaNoiAtlas/1.0 (thaohienhomes@gmail.com)";
const BATCH = 12;
const OUT = "/tmp/wards-geom-parts.json";

const list = JSON.parse(fs.readFileSync("/tmp/wards-raw.json", "utf8")).elements;
const ids = list.map((e) => e.id);
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
console.log("cần lấy:", ids.length, "| đã có:", Object.keys(done).length);

let mirror = 0;
async function ask(query) {
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const url = MIRRORS[mirror % MIRRORS.length];
    mirror += 1;
    try {
      const r = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, Accept: "application/json" },
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      if (text.trim().startsWith("<")) throw new Error("HTML");
      return JSON.parse(text);
    } catch (e) {
      process.stdout.write(`  (${new URL(url).host}: ${e.message}) `);
      await new Promise((res) => setTimeout(res, 5000 + attempt * 3000));
    }
  }
  throw new Error("mẻ này chịu");
}

const todo = ids.filter((id) => !done[id]);
for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const q = `[out:json][timeout:300];rel(id:${chunk.join(",")});out geom;`;
  const d = await ask(q);
  (d.elements || []).forEach((e) => {
    done[e.id] = e;
  });
  fs.writeFileSync(OUT, JSON.stringify(done));
  console.log(`mẻ ${Math.floor(i / BATCH) + 1}: +${(d.elements || []).length} → tổng ${Object.keys(done).length}`);
  await new Promise((res) => setTimeout(res, 3000));
}
console.log("XONG", Object.keys(done).length, "đơn vị");
