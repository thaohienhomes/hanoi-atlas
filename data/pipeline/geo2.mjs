import { STARTUPS } from "/home/user/hanoi-atlas/src/data.js";
import { writeFileSync } from "node:fs";
const UA = "HanoiAtlas/1.0 (open civic map; thaohienhomes@gmail.com)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const m = (a,b) => { const R=6371000,rad=Math.PI/180,dLa=(b.lat-a.lat)*rad,dLn=(b.lng-a.lng)*rad;
  const s=Math.sin(dLa/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLn/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s))); };

// Cụm từ tra cứu riêng cho những chỗ Nominatim hay khớp nhầm.
const HINT = {
  "kem-trang-tien": ["Kem Tràng Tiền, 35 Tràng Tiền, Hoàn Kiếm, Hà Nội"],
  "bia-ta-hien": ["Phố Tạ Hiện, Hoàn Kiếm, Hà Nội"],
  "xoi-yen": ["Xôi Yến, 35B Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội"],
  "quan-an-ngon": ["Quán Ăn Ngon, 18 Phan Bội Châu, Hà Nội"],
  "ho-guom": ["Hồ Hoàn Kiếm, Hà Nội", "Tháp Rùa, Hồ Hoàn Kiếm, Hà Nội"],
  "pho-duong-tau": ["Hanoi Train Street, Phùng Hưng, Hà Nội", "Phố đường tàu Phùng Hưng, Hà Nội"],
  "hoa-lo": ["Nhà tù Hỏa Lò, 1 Hoả Lò, Hà Nội", "Hoa Lo Prison Relic, Hanoi"],
  "phu-tay-ho": ["Phủ Tây Hồ, Quảng An, Tây Hồ, Hà Nội"],
  "duong-thanh-nien": ["Đường Thanh Niên, Tây Hồ, Hà Nội"],
  "bai-da-song-hong": ["Bãi đá sông Hồng, Nhật Tân, Tây Hồ, Hà Nội"],
  "keangnam-l72": ["Keangnam Hanoi Landmark Tower, Phạm Hùng, Hà Nội", "Landmark 72, Hà Nội"],
  "vin-times-city": ["Times City, 458 Minh Khai, Hai Bà Trưng, Hà Nội"],
  "vin-riverside": ["Vinhomes Riverside, Việt Hưng, Long Biên, Hà Nội"],
  "van-mieu": ["Văn Miếu Quốc Tử Giám, 58 Quốc Tử Giám, Hà Nội"],
  "nha-tho-lon": ["Nhà thờ Lớn Hà Nội, Nhà Chung, Hoàn Kiếm"],
  "nha-hat-lon": ["Nhà hát Lớn Hà Nội, 1 Tràng Tiền, Hoàn Kiếm"],
  "lotte-center": ["Lotte Center Hanoi, 54 Liễu Giai, Ba Đình, Hà Nội"],
  "ciputra": ["Khu đô thị Nam Thăng Long Ciputra, Phú Thượng, Tây Hồ, Hà Nội"],
  "sunshine-city": ["Sunshine City, Ciputra, Phú Thượng, Tây Hồ, Hà Nội"],
  "cho-dong-xuan": ["Chợ Đồng Xuân, Hoàn Kiếm, Hà Nội"],
  "hoang-thanh": ["Hoàng thành Thăng Long, 19C Hoàng Diệu, Hà Nội"],
  "cv-thong-nhat": ["Công viên Thống Nhất, Hà Nội"],
  "bao-tang-ha-noi": ["Bảo tàng Hà Nội, Phạm Hùng, Nam Từ Liêm, Hà Nội"],
  "vin-skylake": ["Vinhomes Skylake, Phạm Hùng, Nam Từ Liêm, Hà Nội"],
  "sun-thuy-khue": ["Sun Grand City Thuy Khue Residence, 69B Thụy Khuê, Hà Nội"],
};
// Loại bỏ ranh giới hành chính, ga tàu, trường học... khi không phải thứ mình tìm.
const BAD_CLASS = new Set(["boundary","place"]);
const BAD_TYPE = new Set(["administrative","city","town","suburb","quarter","neighbourhood","station","halt","school","college","kindergarten"]);

async function search(text) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=vn&viewbox=105.70,21.13,105.97,20.95&bounded=1&addressdetails=0&q=${encodeURIComponent(text)}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  await sleep(1150);
  return r.ok ? r.json() : [];
}

const out = [];
for (const s of STARTUPS) {
  const queries = [...(HINT[s.id] || []), s.address ? `${s.name}, ${s.address}, Hà Nội` : null, `${s.name}, Hà Nội`].filter(Boolean);
  let best = null;
  for (const q of queries) {
    for (const c of await search(q)) {
      if (BAD_CLASS.has(c.class) || BAD_TYPE.has(c.type)) continue;
      const d = m(s, { lat: +c.lat, lng: +c.lon });
      if (d > 900) continue;                       // xa hơn cả khu phố -> chắc chắn nhầm
      if (!best || d < best.d) best = { lat: +c.lat, lng: +c.lon, d, cls: c.class, type: c.type, nm: c.display_name };
    }
    if (best && best.d < 300) break;               // đủ tốt thì dừng, đỡ gọi thêm
  }
  out.push({ id: s.id, name: s.name, old: [s.lat, s.lng], real: best ? [+best.lat.toFixed(5), +best.lng.toFixed(5)] : null,
             off: best ? Math.round(best.d) : null, kind: best ? best.cls + "/" + best.type : null, matched: best?.nm.slice(0,48) ?? null });
  const line = out.at(-1);
  console.log(String(out.length).padStart(2), (line.off == null ? "  --" : String(line.off).padStart(4)) + "m",
              s.name.slice(0,26).padEnd(26), line.kind ?? "giữ toạ độ cũ");
}
writeFileSync("/tmp/geo2.json", JSON.stringify(out, null, 1));
const got = out.filter(o => o.real);
console.log(`\nXác nhận được ${got.length}/${out.length} · giữ nguyên ${out.length - got.length} · lệch trung bình ${Math.round(got.reduce((a,b)=>a+b.off,0)/got.length)}m`);
