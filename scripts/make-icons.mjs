// Generates a small category-tinted SVG icon for every place id in
// src/data.js, written to public/logos/{id}.svg. The engine looks up marker
// and card artwork by id, exactly like the original atlas looked up logos.
//
// Run: npm run logos

import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARTUPS } from "../src/data.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "logos");

// Category background tints (slightly deeper than the pin colors so the
// white glyphs pop at 16 px).
const CATEGORY_BG = {
  "Ẩm thực": "#dd9a1f",
  "Du lịch": "#1fa99b",
  BĐS: "#2f9c65",
};

// ---- Glyphs (white, drawn in a 64×64 box) ----------------------------------

const GLYPHS = {
  bowl: `
    <path d="M13 30h38a2 2 0 0 1 2 2.2C52.2 41.5 45 48.6 36.5 50.4V53h-9v-2.6C19 48.6 11.8 41.5 11 32.2A2 2 0 0 1 13 30Z"/>
    <path d="M22 27.2 45.6 13l2.6 3.4L26.4 28.6Z" opacity="0.9"/>`,
  cup: `
    <path d="M16 24h26v13a11 11 0 0 1-11 11h-4a11 11 0 0 1-11-11Z"/>
    <path d="M42 27h3.5a6.5 6.5 0 0 1 0 13H42v-4.6h3a2 2 0 0 0 0-3.8h-3Z"/>
    <rect x="21" y="13" width="4" height="7" rx="2"/>
    <rect x="29" y="11" width="4" height="9" rx="2"/>`,
  beer: `
    <rect x="17" y="21" width="22" height="28" rx="3.5"/>
    <path d="M39 26h4a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6h-4v-5h4a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 43 31h-4Z"/>
    <circle cx="21.5" cy="18.5" r="4.5"/>
    <circle cx="29" cy="16" r="5"/>
    <circle cx="36" cy="18.5" r="4.5"/>`,
  icecream: `
    <circle cx="32" cy="22" r="10"/>
    <path d="M22.5 29h19L32 54Z"/>`,
  baguette: `
    <g transform="rotate(-38 32 32)"><rect x="12" y="24" width="40" height="16" rx="8"/></g>
    <g transform="rotate(-38 32 32)" fill="__BG__">
      <rect x="21" y="27" width="2.6" height="10" rx="1.3"/>
      <rect x="30" y="27" width="2.6" height="10" rx="1.3"/>
      <rect x="39" y="27" width="2.6" height="10" rx="1.3"/>
    </g>`,
  turtle: `
    <ellipse cx="30" cy="34" rx="15" ry="10.5"/>
    <circle cx="48" cy="30" r="4.6"/>
    <circle cx="18" cy="43" r="3.4"/>
    <circle cx="42" cy="43" r="3.4"/>
    <circle cx="15" cy="26" r="3.4"/>
    <path d="M13 34l-5 3 5 2.4Z"/>`,
  temple: `
    <path d="M14 24l18-11 18 11h-6v2H20v-2Z"/>
    <rect x="23" y="28" width="18" height="12"/>
    <path d="M12 46l8-4h24l8 4Z"/>
    <rect x="14" y="48" width="36" height="5" rx="1.5"/>`,
  pagodaTall: `
    <rect x="29" y="8" width="6" height="5"/>
    <path d="M22 17h20l-2.5-4h-15Z"/><rect x="26" y="17" width="12" height="5"/>
    <path d="M20 26h24l-2.5-4h-19Z"/><rect x="24.5" y="26" width="15" height="6"/>
    <path d="M18 36h28l-3-4h-22Z"/><rect x="23" y="36" width="18" height="7"/>
    <rect x="16" y="47" width="32" height="6" rx="1.5"/>`,
  gate: `
    <path fill-rule="evenodd" d="M12 50V26h40v24h-9V38a11 11 0 0 0-22 0v12Zm9-28v-5h22v5Z"/>
    <path d="M26 14h12l-6-6Z"/>`,
  church: `
    <rect x="14" y="26" width="10" height="26"/>
    <rect x="40" y="26" width="10" height="26"/>
    <path d="M14 26l5-7 5 7Zm26 0l5-7 5 7Z"/>
    <rect x="26" y="34" width="12" height="18"/>
    <rect x="30.6" y="12" width="2.8" height="12"/>
    <rect x="27" y="15.5" width="10" height="2.8"/>`,
  columns: `
    <path d="M10 24 32 12l22 12Z"/>
    <rect x="14" y="27" width="5" height="18"/>
    <rect x="24" y="27" width="5" height="18"/>
    <rect x="34" y="27" width="5" height="18"/>
    <rect x="44" y="27" width="5" height="18"/>
    <rect x="11" y="48" width="42" height="5" rx="1.5"/>`,
  market: `
    <path d="M11 20h42v6a5.2 5.2 0 0 1-10.4 0 5.2 5.2 0 0 1-10.5 0 5.2 5.2 0 0 1-10.5 0A5.2 5.2 0 0 1 11 26Z"/>
    <path d="M14 31v20h14V38h8v13h14V31a8 8 0 0 1-6-1.4 8.4 8.4 0 0 1-10.4 0 8.4 8.4 0 0 1-10.5 0A8 8 0 0 1 14 31Z"/>`,
  train: `
    <rect x="18" y="10" width="28" height="34" rx="6"/>
    <rect x="22" y="16" width="20" height="10" rx="2" fill="__BG__"/>
    <circle cx="25" cy="37" r="3" fill="__BG__"/>
    <circle cx="39" cy="37" r="3" fill="__BG__"/>
    <path d="M22 47l-5 8h6l4-6Zm20 0 5 8h-6l-4-6Z"/>`,
  bridge: `
    <path d="M10 40a11 11 0 0 1 22 0h-4a7 7 0 0 0-14 0Zm22 0a11 11 0 0 1 22 0h-4a7 7 0 0 0-14 0Z"/>
    <rect x="8" y="40" width="48" height="4.5" rx="2"/>
    <rect x="12" y="44" width="3.6" height="9"/>
    <rect x="30.2" y="44" width="3.6" height="9"/>
    <rect x="48.4" y="44" width="3.6" height="9"/>`,
  tree: `
    <circle cx="24" cy="26" r="10"/>
    <circle cx="38" cy="21" r="9"/>
    <circle cx="38" cy="33" r="8"/>
    <path d="M29.5 33h5L36 53h-8Z"/>`,
  stadium: `
    <path fill-rule="evenodd" d="M32 18c13.8 0 25 6.7 25 15s-11.2 15-25 15S7 41.3 7 33s11.2-15 25-15Zm0 7c-9.9 0-18 3.8-18 8s8.1 8 18 8 18-3.8 18-8-8.1-8-18-8Z"/>
    <ellipse cx="32" cy="33" rx="9" ry="4"/>`,
  flower: `
    <circle cx="32" cy="20" r="7"/>
    <circle cx="43.5" cy="28.5" r="7"/>
    <circle cx="39" cy="42" r="7"/>
    <circle cx="25" cy="42" r="7"/>
    <circle cx="20.5" cy="28.5" r="7"/>
    <circle cx="32" cy="32" r="6" fill="__BG__"/>
    <circle cx="32" cy="32" r="3.4"/>`,
  flag: `
    <path d="M14 46l8-30 3 .8-2.2 8.2H46l-6 8 6 8H21.4L18 47Z"/>
    <rect x="12" y="48" width="20" height="5" rx="2"/>`,
  tower: `
    <rect x="20" y="12" width="14" height="41"/>
    <rect x="37" y="24" width="10" height="29"/>
    <g fill="__BG__">
      <rect x="23" y="17" width="8" height="2.6"/>
      <rect x="23" y="24" width="8" height="2.6"/>
      <rect x="23" y="31" width="8" height="2.6"/>
      <rect x="23" y="38" width="8" height="2.6"/>
      <rect x="39.5" y="29" width="5" height="2.4"/>
      <rect x="39.5" y="35" width="5" height="2.4"/>
      <rect x="39.5" y="41" width="5" height="2.4"/>
    </g>
    <rect x="26" y="6" width="2.4" height="6"/>`,
  house: `
    <path d="M10 32 32 14l22 18h-7v18H37V38h-10v12H17V32Z"/>`,
  pyramidInv: `
    <path d="M10 14h44l-16 26v12h-12V40Z"/>
    <rect x="20" y="20" width="24" height="2.6" fill="__BG__"/>
    <rect x="24" y="27" width="16" height="2.6" fill="__BG__"/>`,
  mausoleum: `
    <rect x="12" y="44" width="40" height="6" rx="1"/>
    <rect x="16" y="38" width="32" height="5"/>
    <rect x="19" y="22" width="4.5" height="15"/>
    <rect x="27" y="22" width="4.5" height="15"/>
    <rect x="35" y="22" width="4.5" height="15"/>
    <rect x="42.5" y="22" width="4.5" height="15"/>
    <rect x="15" y="16" width="34" height="5" rx="1"/>`,
};

// ---- Per-place glyph assignment --------------------------------------------

const GLYPH_BY_ID = {
  "pho-bat-dan": "bowl",
  "pho-10-ly-quoc-su": "bowl",
  "pho-thin-lo-duc": "bowl",
  "bun-cha-huong-lien": "bowl",
  "bun-cha-dac-kim": "bowl",
  "cha-ca-la-vong": "bowl",
  "ca-phe-giang": "cup",
  "ca-phe-dinh": "cup",
  "cong-ca-phe": "cup",
  "kem-trang-tien": "icecream",
  "bia-ta-hien": "beer",
  "banh-mi-25": "baguette",
  "xoi-yen": "bowl",
  "bun-thang-ba-duc": "bowl",
  "pho-cuon-ngu-xa": "bowl",
  "banh-tom-ho-tay": "bowl",
  "quan-an-ngon": "bowl",

  "ho-guom": "turtle",
  "den-ngoc-son": "temple",
  "cho-dong-xuan": "market",
  "o-quan-chuong": "gate",
  "nha-tho-lon": "church",
  "pho-duong-tau": "train",
  "nha-hat-lon": "columns",
  "hoa-lo": "mausoleum",
  "bao-tang-phu-nu": "columns",
  "lang-bac": "mausoleum",
  "chua-mot-cot": "temple",
  "hoang-thanh": "gate",
  "cot-co": "flag",
  "van-mieu": "temple",
  "chua-tran-quoc": "pagodaTall",
  "phu-tay-ho": "temple",
  "duong-thanh-nien": "tree",
  "cau-long-bien": "bridge",
  "bai-da-song-hong": "flower",
  "cv-thong-nhat": "tree",
  "svd-my-dinh": "stadium",
  "bao-tang-dan-toc-hoc": "house",
  "bao-tang-ha-noi": "pyramidInv",

  "vin-metropolis": "tower",
  "lotte-center": "tower",
  "keangnam-l72": "tower",
  "vin-skylake": "tower",
  ciputra: "house",
  "sunshine-city": "tower",
  "dle-roi-soleil": "tower",
  "sun-thuy-khue": "tower",
  "vin-times-city": "tower",
  "vin-royal-city": "tower",
  "vin-riverside": "house",
  "mipec-riverside": "tower",
};

function iconSvg(place) {
  const bg = CATEGORY_BG[place.stage] || "#5b6472";
  const glyphKey = GLYPH_BY_ID[place.id] || (place.stage === "Ẩm thực" ? "bowl" : place.stage === "BĐS" ? "tower" : "temple");
  const glyph = (GLYPHS[glyphKey] || GLYPHS.temple).replaceAll("__BG__", bg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${place.name}">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <g fill="#ffffff">${glyph}</g>
</svg>
`;
}

await mkdir(outDir, { recursive: true });

// Clear stale icons so the folder mirrors the dataset exactly.
for (const file of await readdir(outDir)) {
  if (file.endsWith(".svg")) await unlink(path.join(outDir, file));
}

let written = 0;
for (const place of STARTUPS) {
  await writeFile(path.join(outDir, `${place.id}.svg`), iconSvg(place), "utf8");
  written += 1;
}

// Category fallback icons: places added live from the Google Sheet have no
// per-id SVG yet, so the app swaps their <img> to /logos/_cat-{...}.svg.
const FALLBACKS = [
  ["_cat-am-thuc", { id: "_cat-am-thuc", name: "Ẩm thực", stage: "Ẩm thực" }],
  ["_cat-du-lich", { id: "_cat-du-lich", name: "Du lịch", stage: "Du lịch" }],
  ["_cat-bds", { id: "_cat-bds", name: "BĐS", stage: "BĐS" }],
  ["_cat-default", { id: "_cat-default", name: "Địa điểm", stage: "" }],
];
for (const [file, fake] of FALLBACKS) {
  await writeFile(path.join(outDir, `${file}.svg`), iconSvg(fake), "utf8");
  written += 1;
}

console.log(`Wrote ${written} icons to public/logos/ (incl. ${FALLBACKS.length} category fallbacks)`);
