// Sinh ảnh og.jpg (1200×630) cho social preview ngay lúc build: bản đồ
// Hà Nội cách điệu + thẻ tiêu đề kính mờ. Nếu sharp không cài được trên
// máy build thì bỏ qua êm — site vẫn chạy bình thường.

const W = 1200;
const H = 630;

function pin(x, y, color, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="4" rx="9" ry="3.2" fill="#1b2430" opacity="0.18"/>
    <path d="M0 2 C-7 -8 -11 -13 -11 -19 A11 11 0 1 1 11 -19 C11 -13 7 -8 0 2 Z" fill="${color}" stroke="#ffffff" stroke-width="2.4"/>
    <circle cx="0" cy="-18.5" r="4" fill="#ffffff"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5a91ba"/>
      <stop offset="1" stop-color="#396d99"/>
    </linearGradient>
    <linearGradient id="landfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e0dccf"/>
      <stop offset="1" stop-color="#cfcaba"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#1b2430" flood-opacity="0.32"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#landfade)"/>

  <g stroke="#b9b3a0" stroke-width="2" opacity="0.5" transform="rotate(8 600 315)">
    ${Array.from({ length: 16 }, (_, i) => `<line x1="${-100 + i * 95}" y1="-120" x2="${-100 + i * 95}" y2="760"/>`).join("")}
    ${Array.from({ length: 10 }, (_, i) => `<line x1="-140" y1="${-60 + i * 85}" x2="1340" y2="${-60 + i * 85}"/>`).join("")}
  </g>

  <path d="M905 -40 C 830 120 850 260 950 400 C 1020 500 1030 570 1010 680 L 1240 680 L 1240 -40 Z" fill="url(#water)"/>
  <path d="M958 90 C 940 170 950 260 1000 350 C 1022 390 1030 430 1028 470 C 990 420 950 330 940 240 C 935 175 942 120 958 90 Z" fill="#c9c9a8"/>
  <path d="M962 120 C 955 170 958 230 985 300 C 972 250 962 180 968 128 Z" fill="#7fa866" opacity="0.85"/>

  <path d="M585 95 C 655 75 725 105 745 165 C 762 218 730 268 672 288 C 705 305 718 340 700 368 C 676 404 618 408 578 380 C 528 345 508 290 522 230 C 534 172 552 105 585 95 Z" fill="url(#water)"/>
  <ellipse cx="742" cy="330" rx="38" ry="30" fill="url(#water)"/>
  <ellipse cx="760" cy="505" rx="34" ry="24" fill="url(#water)"/>
  <circle cx="760" cy="505" r="5" fill="#a8352a"/>

  <ellipse cx="470" cy="565" rx="70" ry="34" fill="#7fa866" opacity="0.85"/>
  <ellipse cx="836" cy="180" rx="46" ry="30" fill="#7fa866" opacity="0.75"/>
  <ellipse cx="250" cy="70" rx="60" ry="30" fill="#7fa866" opacity="0.6"/>

  <g stroke-linecap="round" fill="none">
    <path d="M868 205 L 995 168" stroke="#6e6259" stroke-width="9"/>
    <path d="M868 205 L 995 168" stroke="#8a7d72" stroke-width="3" stroke-dasharray="10 7"/>
    <path d="M780 120 L 962 60" stroke="#c94f46" stroke-width="7"/>
    <path d="M905 330 L 1020 305" stroke="#9aa4ad" stroke-width="7"/>
    <path d="M330 500 C 470 460 610 450 700 470" stroke="#2e9e5b" stroke-width="6" opacity="0.9"/>
    <path d="M740 90 C 820 100 880 130 920 170" stroke="#d6336c" stroke-width="6" opacity="0.9"/>
  </g>

  ${pin(760, 150, "#1fa99b", 1.45)}
  ${pin(700, 480, "#1fa99b", 1.7)}
  ${pin(775, 560, "#dd9a1f", 1.5)}
  ${pin(845, 420, "#dd9a1f", 1.35)}
  ${pin(915, 525, "#2f9c65", 1.5)}
  ${pin(540, 525, "#dd9a1f", 1.3)}
  ${pin(1005, 240, "#1fa99b", 1.4)}
  ${pin(285, 550, "#2f9c65", 1.35)}
  ${pin(140, 545, "#dd9a1f", 1.25)}

  <g filter="url(#soft)">
    <rect x="56" y="104" width="640" height="356" rx="30" fill="#fdfdfb" opacity="0.94"/>
    <rect x="56" y="104" width="640" height="356" rx="30" fill="none" stroke="#ffffff" stroke-width="2"/>
  </g>
  <g transform="translate(96 150) scale(2.0)">
    <path fill="#2664ff" fill-rule="evenodd" d="M16 29.5 C12.2 23.5 7.5 17.5 7.5 12 A8.5 8.5 0 1 1 24.5 12 C24.5 17.5 19.8 23.5 16 29.5 Z M16 8.8 A3.2 3.2 0 1 0 16 15.2 A3.2 3.2 0 1 0 16 8.8 Z"/>
  </g>
  <text x="176" y="204" font-family="DejaVu Sans, sans-serif" font-size="60" font-weight="bold" fill="#1b2430">Hà Nội Atlas</text>
  <text x="98" y="266" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#3d4a61">Bản đồ 3D tương tác của Hà Nội</text>
  <text x="98" y="304" font-family="DejaVu Sans, sans-serif" font-size="23" fill="#6b7688">Thời tiết &amp; AQI theo thời gian thực · Interactive 3D map</text>
  <g font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="bold">
    <rect x="98" y="334" width="156" height="46" rx="23" fill="#f6e7c8"/>
    <circle cx="124" cy="357" r="8" fill="#dd9a1f"/>
    <text x="142" y="366" fill="#7a5510">Ẩm thực</text>
    <rect x="268" y="334" width="146" height="46" rx="23" fill="#d3edea"/>
    <circle cx="294" cy="357" r="8" fill="#1fa99b"/>
    <text x="312" y="366" fill="#0e5f57">Du lịch</text>
    <rect x="428" y="334" width="104" height="46" rx="23" fill="#d5ecdd"/>
    <circle cx="454" cy="357" r="8" fill="#2f9c65"/>
    <text x="472" y="366" fill="#175c38">BĐS</text>
  </g>
  <text x="98" y="428" font-family="DejaVu Sans, sans-serif" font-size="23" fill="#6b7688">52+ địa điểm · dữ liệu sửa bằng Google Sheet</text>
</svg>`;

// Icon cài về màn hình chính: cùng mark bản đồ, nền cobalt như favicon.
// Bản maskable chừa viền an toàn để Android bo tròn không cắt mất hình.
function iconSvg(size, maskable = false) {
  const pad = maskable ? 0.72 : 1;
  const s = 32 * pad;
  const off = (32 - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" ${maskable ? "" : 'rx="7"'} fill="#2664ff"/>
  <g transform="translate(${off} ${off}) scale(${pad})">
    <path fill="#ffffff" fill-rule="evenodd" d="M16 27.5 C12.6 22.2 8.5 16.8 8.5 12 A7.5 7.5 0 1 1 23.5 12 C23.5 16.8 19.4 22.2 16 27.5 Z M16 9.1 A2.9 2.9 0 1 0 16 14.9 A2.9 2.9 0 1 0 16 9.1 Z"/>
  </g>
</svg>`;
}

try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toFile("public/og.jpg");
  console.log("make-og: public/og.jpg OK");

  for (const [file, size, maskable] of [
    ["public/icon-180.png", 180, false],
    ["public/icon-192.png", 192, false],
    ["public/icon-512.png", 512, false],
    ["public/icon-maskable-512.png", 512, true],
  ]) {
    await sharp(Buffer.from(iconSvg(size, maskable))).png().toFile(file);
  }
  console.log("make-og: icon PWA OK");
} catch (error) {
  console.warn("make-og: bỏ qua (sharp không khả dụng):", error?.message);
}
