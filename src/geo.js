// Accurate-enough Hà Nội geography for the atlas, all coordinates [lat, lng].
// Traced to be recognizable: the Red River's sweep past Long Biên, Hồ Tây's
// kidney shape with the Quảng An peninsula, Hồ Gươm's small oval, the dyke
// roads. Building scatter is clipped to these polygons so nothing ever lands
// in the water.
//
// Frame: lat 20.985 → 21.098, lng 105.752 → 105.905 (~12.5 km × 15.8 km).

// ---- Riverbanks -------------------------------------------------------------

// West bank: the main city (Ba Đình, Hoàn Kiếm, Đống Đa, Cầu Giấy, Tây Hồ...).
// Runs down the Red River's right bank, then around the frame edges.
export const WEST_BANK = [
  // Red River right bank, north -> south
  [21.098, 105.8225], // north frame, Nhật Tân west approach
  [21.09, 105.8235], // Phú Thượng
  [21.082, 105.829], // Tứ Liên
  [21.073, 105.837], // Quảng Bá riverside
  [21.064, 105.842], // Nghi Tàm
  [21.056, 105.846], // Yên Phụ
  [21.048, 105.852], // An Dương
  [21.043, 105.8555], // Long Biên bridge west head
  [21.037, 105.858], // Chương Dương Độ
  [21.029, 105.8605], // Bạch Đằng
  [21.018, 105.8625], // Thanh Lương
  [21.008, 105.865], // Vĩnh Tuy west
  [21.004, 105.866],
  [20.995, 105.869],
  [20.985, 105.872],
  [20.958, 105.881], // runs past the south frame into the fog
  // Far frame edges, overshooting the visible area so no sea appears
  // beyond the city — just land dissolving into haze.
  [20.958, 105.69],
  [21.125, 105.69],
  [21.125, 105.8185], // river west bank, extrapolated north
];

// East bank: Long Biên / Gia Lâm across the river.
export const EAST_BANK = [
  // Red River left bank, north -> south
  [21.098, 105.833],
  [21.088, 105.836],
  [21.078, 105.844],
  [21.068, 105.852],
  [21.058, 105.858],
  [21.05, 105.864], // Ngọc Thụy
  [21.045, 105.869], // Long Biên bridge east head
  [21.038, 105.872], // Bồ Đề
  [21.028, 105.874],
  [21.018, 105.876],
  [21.008, 105.879],
  [20.998, 105.883],
  [20.985, 105.887],
  [20.958, 105.895], // past the south frame
  // Far frame edges, overshooting the visible area.
  [20.958, 105.965],
  [21.125, 105.965],
  [21.125, 105.831], // river east bank, extrapolated north
];

// Bãi giữa: the mid-river sandbar under Long Biên bridge — banana groves and
// vegetable plots in the middle of the city.
export const BAI_GIUA = [
  [21.057, 105.856],
  [21.052, 105.8595],
  [21.046, 105.8635],
  [21.04, 105.8665],
  [21.0365, 105.869],
  [21.0385, 105.8705],
  [21.044, 105.867],
  [21.05, 105.8625],
  [21.0555, 105.858],
];

// ---- Lakes (holes punched in the west-bank landmass; real animated water) --

export const HO_TAY = [
  [21.0428, 105.8375], // SE: Thanh Niên south end, lake side
  [21.0412, 105.832], // Thụy Khuê shore
  [21.0406, 105.825],
  [21.0418, 105.8175],
  [21.0448, 105.8115], // SW bend
  [21.0505, 105.8085],
  [21.057, 105.808], // west shore (Võ Chí Công side)
  [21.0638, 105.811], // NW (Xuân La / Nhật Tân)
  [21.0695, 105.8165],
  [21.0718, 105.8235], // north shore (Quảng Bá)
  [21.0672, 105.825], // in toward the Quảng An peninsula
  [21.0625, 105.8262], // peninsula tip (Phủ Tây Hồ)
  [21.0655, 105.8315], // east lobe behind the peninsula
  [21.0618, 105.835],
  [21.0552, 105.8352], // Nghi Tàm / Yên Phụ shore
  [21.0495, 105.835], // Thanh Niên north end, lake side
];

export const HO_TRUC_BACH = [
  [21.0435, 105.839], // Trấn Vũ (south)
  [21.047, 105.8378], // along Thanh Niên
  [21.049, 105.8395], // north (Yên Phụ end)
  [21.048, 105.842], // Ngũ Xã side
  [21.0448, 105.8425],
];

export const HO_GUOM = [
  [21.0322, 105.852], // north (Thê Húc / Ngọc Sơn)
  [21.0305, 105.8536], // Đinh Tiên Hoàng shore
  [21.0275, 105.8537],
  [21.0258, 105.8524], // Hàng Khay (south)
  [21.0262, 105.8508], // Lê Thái Tổ shore
  [21.029, 105.8503],
  [21.0312, 105.8508],
];

export const LAKES = [HO_TAY, HO_TRUC_BACH, HO_GUOM];

// Smaller lakes drawn as still-water ellipses on top of the land, plus the
// odd lawn: {lat, lng, rLat, rLng, kind}.
export const LAKE_FEATURES = [
  { lat: 21.0222, lng: 105.8442, rLat: 0.0016, rLng: 0.0013, kind: "water" }, // Hồ Thiền Quang
  { lat: 21.0158, lng: 105.8455, rLat: 0.0032, rLng: 0.0022, kind: "water" }, // Hồ Bảy Mẫu
  { lat: 21.0308, lng: 105.8058, rLat: 0.0016, rLng: 0.0018, kind: "water" }, // Hồ Thủ Lệ
  { lat: 21.0272, lng: 105.8188, rLat: 0.0012, rLng: 0.0012, kind: "water" }, // Hồ Giảng Võ
  { lat: 21.0198, lng: 105.8148, rLat: 0.0014, rLng: 0.0016, kind: "water" }, // Hồ Thành Công
  { lat: 21.0172, lng: 105.8222, rLat: 0.0013, rLng: 0.0014, kind: "water" }, // Hồ Hoàng Cầu
  { lat: 21.0288, lng: 105.8118, rLat: 0.0011, rLng: 0.0013, kind: "water" }, // Hồ Ngọc Khánh
  { lat: 21.0165, lng: 105.844, rLat: 0.0022, rLng: 0.0018, kind: "lawn" }, // Thống Nhất lawns
];

// ---- Parks ------------------------------------------------------------------

export const PARKS = [
  // Công viên Thống Nhất (around Hồ Bảy Mẫu)
  [
    [21.021, 105.8425],
    [21.0212, 105.8478],
    [21.017, 105.8492],
    [21.0122, 105.8478],
    [21.0118, 105.844],
    [21.0165, 105.842],
  ],
  // Vườn Bách Thảo
  [
    [21.0378, 105.8298],
    [21.0398, 105.829],
    [21.0408, 105.8318],
    [21.0388, 105.833],
  ],
  // Công viên Thủ Lệ (zoo, around the lake)
  [
    [21.029, 105.8035],
    [21.0322, 105.8028],
    [21.033, 105.8075],
    [21.03, 105.8085],
  ],
  // Công viên Cầu Giấy
  [
    [21.0295, 105.788],
    [21.032, 105.7872],
    [21.0328, 105.7915],
    [21.0302, 105.7922],
  ],
  // Công viên Nghĩa Đô
  [
    [21.0425, 105.7935],
    [21.0448, 105.7928],
    [21.0455, 105.7962],
    [21.043, 105.7968],
  ],
  // Vườn hoa Lý Thái Tổ (east of Hồ Gươm)
  [
    [21.029, 105.854],
    [21.0302, 105.8536],
    [21.0306, 105.8552],
    [21.0293, 105.8556],
  ],
  // Vườn hoa Lê-nin (facing the Flag Tower)
  [
    [21.0322, 105.8365],
    [21.0334, 105.8358],
    [21.034, 105.8378],
    [21.0328, 105.8384],
  ],
  // Quảng trường Ba Đình (the mausoleum lawns)
  [
    [21.0355, 105.835],
    [21.0381, 105.8343],
    [21.0386, 105.8371],
    [21.036, 105.8377],
  ],
  // Hoàng thành Thăng Long grounds (keeps scatter buildings off the citadel)
  [
    [21.0328, 105.8388],
    [21.0328, 105.8416],
    [21.0372, 105.842],
    [21.0372, 105.8392],
  ],
  // Văn Miếu – Quốc Tử Giám compound
  [
    [21.0276, 105.8346],
    [21.0276, 105.8364],
    [21.03, 105.8367],
    [21.03, 105.8349],
  ],
  // Công viên Tuổi Trẻ
  [
    [21.0075, 105.85],
    [21.0102, 105.8492],
    [21.011, 105.8532],
    [21.008, 105.854],
  ],
  // Times City central gardens
  [
    [21.0016, 105.8672],
    [21.004, 105.8666],
    [21.0046, 105.8702],
    [21.0022, 105.8708],
  ],
];

// ---- Districts (for building height + density) -----------------------------
// Lattice districts (no flag) fill the French-grid core cell by cell.
// `scatter` districts place free-standing solid buildings with a shared
// orientation. `faded` districts render pale ghost blocks across the river.
// Heights in world units; ~1 unit ≈ 94 m. Keangnam ≈ 3.6, Lotte ≈ 2.9.
export const DISTRICTS = [
  // Lattice core — the walkable Hanoi of tube houses and French blocks.
  { name: "Phố cổ", bbox: [21.0295, 21.0408, 105.845, 105.856], count: 0, h: [0.2, 0.48], tall: 0, slim: true },
  { name: "Hồ Gươm & Phố Pháp", bbox: [21.013, 21.0295, 105.842, 105.8615], count: 0, h: [0.28, 0.85], tall: 0.03 },
  { name: "Ba Đình", bbox: [21.0295, 21.043, 105.828, 105.845], count: 0, h: [0.26, 0.66], tall: 0.02 },
  { name: "Văn Miếu / Đống Đa Đông", bbox: [21.013, 21.0295, 105.824, 105.842], count: 0, h: [0.3, 1.0], tall: 0.06 },
  { name: "Hai Bà Trưng", bbox: [20.999, 21.013, 105.84, 105.866], count: 0, h: [0.3, 1.05], tall: 0.06 },
  // Scatter districts — solid, denser city beyond the grid.
  { name: "Thụy Khuê", bbox: [21.038, 21.048, 105.808, 105.834], count: 190, h: [0.24, 0.6], tall: 0.01, scatter: true, rot: -0.35 },
  { name: "Quảng An", bbox: [21.048, 21.072, 105.823, 105.846], count: 230, h: [0.24, 0.72], tall: 0.02, scatter: true, rot: -0.55 },
  { name: "Xuân La / Ciputra", bbox: [21.048, 21.09, 105.79, 105.823], count: 300, h: [0.28, 0.95], tall: 0.05, scatter: true, rot: -0.2 },
  { name: "Cầu Giấy", bbox: [21.008, 21.048, 105.775, 105.808], count: 430, h: [0.35, 1.5], tall: 0.1, scatter: true, rot: 0.12 },
  { name: "Kim Mã / Ba Đình Tây", bbox: [21.023, 21.038, 105.808, 105.828], count: 250, h: [0.3, 1.15], tall: 0.08, scatter: true, rot: -0.08 },
  { name: "Mỹ Đình", bbox: [20.998, 21.033, 105.752, 105.775], count: 330, h: [0.35, 1.8], tall: 0.14, scatter: true, rot: 0.05 },
  { name: "Thanh Xuân", bbox: [20.985, 21.013, 105.79, 105.824], count: 330, h: [0.3, 1.3], tall: 0.09, scatter: true, rot: 0.45 },
  { name: "Đống Đa Tây", bbox: [21.013, 21.023, 105.808, 105.824], count: 190, h: [0.3, 1.1], tall: 0.07, scatter: true, rot: 0.3 },
  { name: "Nam Hai Bà Trưng", bbox: [20.985, 20.999, 105.824, 105.872], count: 280, h: [0.28, 1.0], tall: 0.06, scatter: true, rot: 0.1 },
  // Across the river: sketched, faded.
  { name: "Long Biên", bbox: [21.018, 21.09, 105.862, 105.904], count: 620, h: [0.22, 0.55], tall: 0, faded: true },
  { name: "Gia Lâm Nam", bbox: [20.985, 21.018, 105.87, 105.904], count: 300, h: [0.22, 0.5], tall: 0, faded: true },
];

// ---- Metro + rail -----------------------------------------------------------
// mode: "viaduct" — fully elevated urban metro (2A and Line 3 are real viaducts).
//       "rail"    — national railway: ground ribbon, climbs onto Long Biên
//                   bridge to cross the river.
export const METRO_LINES = [
  {
    name: "2A Cát Linh – Hà Đông",
    shortName: "2A",
    color: 0x2e9e5b, // Line 2A green
    mode: "viaduct",
    stops: [
      [21.0293, 105.8237], // Cát Linh
      [21.025, 105.8218], // Hào Nam
      [21.0165, 105.8192], // Thái Hà
      [21.0068, 105.818], // Láng
      [21.0028, 105.8195], // Ngã Tư Sở
      [20.9975, 105.8085], // Thượng Đình
      [20.99, 105.7955], // Hạ Đình
      [20.9852, 105.787], // toward Hà Đông (frame edge)
    ],
  },
  {
    name: "Line 3 Nhổn – Cầu Giấy",
    shortName: "L3",
    color: 0xd6336c, // Line 3 pink
    mode: "viaduct",
    stops: [
      [21.0302, 105.8012], // Cầu Giấy / Voi Phục
      [21.0335, 105.7942], // Chùa Hà
      [21.037, 105.784], // ĐH Quốc Gia
      [21.039, 105.777], // Mai Dịch
      [21.0412, 105.766], // Cầu Diễn
      [21.0428, 105.7545], // toward Nhổn (frame edge)
    ],
  },
  {
    name: "Đường sắt qua cầu Long Biên",
    shortName: "Rail",
    color: 0x5a6b85, // weathered VNR blue-grey
    mode: "rail",
    stops: [
      [21.0208, 105.841], // toward Giải Phóng
      [21.0245, 105.8412], // Ga Hà Nội
      [21.0295, 105.843], // Điện Biên Phủ crossing
      [21.034, 105.8448], // Phùng Hưng (train street)
      [21.0408, 105.8495], // Ga Long Biên
      [21.0428, 105.8548], // bridge west head
      [21.0452, 105.864], // over bãi giữa
      [21.0478, 105.873], // bridge east head
      [21.0505, 105.88], // Ga Gia Lâm
    ],
  },
];

// ---- Boulevards -------------------------------------------------------------
// Major roads outside the lattice: drawn as subtle ribbons and used as
// traffic paths, so motorbikes flow along the dyke road, Thanh Niên, and the
// radial boulevards. All points stay on land.
export const BOULEVARDS = [
  {
    name: "Đê sông Hồng (Yên Phụ – Trần Quang Khải)",
    path: [
      [21.056, 105.8452],
      [21.048, 105.8515],
      [21.043, 105.855],
      [21.037, 105.8582],
      [21.029, 105.8605],
      [21.018, 105.8625],
      [21.008, 105.865],
      [21.0, 105.868],
    ],
  },
  {
    name: "Đường Thanh Niên",
    path: [
      [21.0424, 105.8386],
      [21.0448, 105.8372],
      [21.047, 105.836],
      [21.0492, 105.8346],
    ],
  },
  {
    name: "Âu Cơ / Nghi Tàm",
    path: [
      [21.05, 105.8345],
      [21.056, 105.833],
      [21.064, 105.829],
      [21.07, 105.826],
      [21.076, 105.8225],
    ],
  },
  {
    name: "Võ Chí Công",
    path: [
      [21.048, 105.8098],
      [21.056, 105.8105],
      [21.066, 105.8118],
      [21.074, 105.814],
      [21.079, 105.818],
      [21.08, 105.8212],
    ],
  },
  {
    name: "Kim Mã – Nguyễn Thái Học",
    path: [
      [21.0303, 105.802],
      [21.032, 105.814],
      [21.0338, 105.83],
      [21.033, 105.836],
    ],
  },
  {
    name: "Cầu Giấy – Xuân Thủy – Hồ Tùng Mậu",
    path: [
      [21.0302, 105.8012],
      [21.0335, 105.7942],
      [21.037, 105.784],
      [21.0395, 105.7745],
      [21.042, 105.762],
    ],
  },
  {
    name: "Nguyễn Trãi",
    path: [
      [21.0035, 105.8205],
      [20.9985, 105.809],
      [20.993, 105.7985],
      [20.986, 105.7875],
    ],
  },
  {
    name: "Giải Phóng",
    path: [
      [21.0208, 105.841],
      [21.013, 105.8415],
      [21.002, 105.8408],
      [20.987, 105.84],
    ],
  },
  {
    name: "Đường Láng",
    path: [
      [21.004, 105.8195],
      [21.012, 105.811],
      [21.021, 105.8035],
      [21.029, 105.799],
    ],
  },
];

// ---- Landmarks ---------------------------------------------------------------
export const LANDMARKS = {
  thapRua: { lat: 21.0276, lng: 105.8522 }, // Tháp Rùa islet
  ngocSon: { lat: 21.031, lng: 105.8524 }, // Đền Ngọc Sơn islet
  theHucShore: { lat: 21.0318, lng: 105.8533 }, // Thê Húc bridge shore end
  operaHouse: { lat: 21.0243, lng: 105.8578 }, // Nhà hát Lớn
  stJoseph: { lat: 21.0287, lng: 105.8489 }, // Nhà thờ Lớn
  flagTower: { lat: 21.0325, lng: 105.8398 }, // Cột cờ Hà Nội
  mausoleum: { lat: 21.0368, lng: 105.8347 }, // Lăng Chủ tịch Hồ Chí Minh
  onePillar: { lat: 21.0359, lng: 105.8334 }, // Chùa Một Cột
  citadel: { lat: 21.0348, lng: 105.8402 }, // Hoàng thành Thăng Long (Đoan Môn)
  parliament: { lat: 21.0378, lng: 105.8328 }, // Nhà Quốc hội
  vanMieu: { lat: 21.0287, lng: 105.8356 }, // Văn Miếu (Khuê Văn Các)
  tranQuoc: { lat: 21.048, lng: 105.8355 }, // Chùa Trấn Quốc
  phuTayHo: { lat: 21.0632, lng: 105.8288 }, // Phủ Tây Hồ
  dongXuan: { lat: 21.0382, lng: 105.8494 }, // Chợ Đồng Xuân
  oQuanChuong: { lat: 21.0368, lng: 105.8527 }, // Ô Quan Chưởng
  gaHaNoi: { lat: 21.0245, lng: 105.8412 }, // Ga Hà Nội
  hoaLo: { lat: 21.0253, lng: 105.8465 }, // Hỏa Lò
  keangnam: { lat: 21.017, lng: 105.7827 }, // Keangnam Landmark 72
  lotte: { lat: 21.0318, lng: 105.812 }, // Lotte Center
  metropolis: { lat: 21.0308, lng: 105.814 }, // Vinhomes Metropolis
  timesCity: { lat: 21.0028, lng: 105.8687 }, // Vinhomes Times City
  royalCity: { lat: 21.0022, lng: 105.8155 }, // Vinhomes Royal City
  myDinhStadium: { lat: 21.0205, lng: 105.7638 }, // SVĐ Quốc gia Mỹ Đình
  hanoiMuseum: { lat: 21.0107, lng: 105.7797 }, // Bảo tàng Hà Nội
  westLakeIntercon: { lat: 21.0555, lng: 105.8332 }, // InterContinental Westlake
  aeonLongBien: { lat: 21.0275, lng: 105.8985 }, // Aeon Mall Long Biên
  lotteMallTayHo: { lat: 21.0705, lng: 105.8125 }, // Lotte Mall Tây Hồ
};

// Bridges over the Red River: deck polylines (west -> east).
// type: "truss"  — Long Biên's cantilever humps
//       "cable"  — Nhật Tân's five cable-stayed pylons
//       "girder" — plain modern box-girder decks
export const BRIDGES = [
  {
    name: "Cầu Long Biên",
    deck: [
      [21.0428, 105.8545],
      [21.044, 105.859],
      [21.0452, 105.864],
      [21.0465, 105.869],
      [21.0478, 105.873],
    ],
    towers: [],
    type: "truss",
  },
  {
    name: "Cầu Chương Dương",
    deck: [
      [21.0325, 105.86],
      [21.0335, 105.8655],
      [21.0345, 105.871],
    ],
    towers: [],
    type: "girder",
  },
  {
    name: "Cầu Vĩnh Tuy",
    deck: [
      [21.0035, 105.8655],
      [21.0048, 105.872],
      [21.0062, 105.879],
    ],
    towers: [],
    type: "girder",
  },
  {
    name: "Cầu Nhật Tân",
    deck: [
      [21.079, 105.821],
      [21.0825, 105.828],
      [21.086, 105.8355],
      [21.0895, 105.843],
    ],
    towers: [
      [21.08, 105.8232],
      [21.0817, 105.8266],
      [21.0834, 105.83],
      [21.0851, 105.8334],
      [21.0868, 105.8368],
    ],
    type: "cable",
  },
];

// ---- Helpers --------------------------------------------------------------

// Ray-casting point-in-polygon, coords as [lat, lng].
export function pointInPoly(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function inEllipse(lat, lng, c) {
  const dy = (lat - c.lat) / c.rLat;
  const dx = (lng - c.lng) / c.rLng;
  return dx * dx + dy * dy <= 1;
}

// True when a point sits in open water: in the river channel (outside both
// banks and the bãi giữa) or inside one of the big lake holes.
export function inWater(lat, lng) {
  for (const lake of LAKES) {
    if (pointInPoly(lat, lng, lake)) return true;
  }
  return (
    !pointInPoly(lat, lng, WEST_BANK) &&
    !pointInPoly(lat, lng, EAST_BANK) &&
    !pointInPoly(lat, lng, BAI_GIUA)
  );
}
