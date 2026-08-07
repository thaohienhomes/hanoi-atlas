import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AREAS, CONTEXT_POINTS, COMPANY_INFO, DATA_SOURCES, STARTUPS } from "./data.js";
import {
  WEST_BANK,
  EAST_BANK,
  BAI_GIUA,
  HO_TAY,
  HO_TRUC_BACH,
  HO_GUOM,
  LAKES,
  LAKE_FEATURES,
  PARKS,
  DISTRICTS,
  METRO_LINES,
  BOULEVARDS,
  LANDMARKS,
  BRIDGES,
  pointInPoly,
  inEllipse,
  inWater,
} from "./geo.js";

/* ---------- Hệ toạ độ ---------- */

// Gốc đặt ở Hồ Gươm. Hệ số kinh tuyến bị nén lại theo cos(21°) — vĩ độ của
// Hà Nội — nếu không thì thành phố sẽ bị kéo ngang ra méo hẳn.
const CENTER = { lat: 21.033, lng: 105.833 };
const SCALE = { lat: 1180, lng: 1101 };
const AREA_BY_ID = Object.fromEntries(AREAS.map((area) => [area.id, area]));

const state = {
  activeAreaId: "all",
  selectedId: null,
  labelsMode: window.matchMedia("(max-width: 54rem)").matches ? "key" : "all",
  flight: null,
};

/* ---------- Các nút bấm và khung chứa trên trang ---------- */

const canvas = document.querySelector("#scene");
const labelsLayer = document.querySelector("#labelsLayer");
const areaList = document.querySelector("#areaList");
const detailCard = document.querySelector("#detailCard");
const miniMapPoints = document.querySelector("#miniMapPoints");
const searchInput = document.querySelector("#companySearch");
const searchResults = document.querySelector("#searchResults");
const searchTrigger = document.querySelector("#searchTrigger");
const searchModal = document.querySelector("#searchModal");
const pinLegend = document.querySelector("#pinLegend");
let searchActiveIndex = -1;

// Dòng mô tả khu vực, chèn xuống ngay dưới mục đang chọn trong thanh bên.
const areaDescEl = document.createElement("p");
areaDescEl.className = "area-desc";

/* ---------- Bầu trời và sương ---------- */

// Trời Hà Nội hiếm khi xanh thẫm. Độ ẩm cao quanh năm cộng bụi mịn làm bầu
// trời gần như lúc nào cũng đục sữa, nhất là mùa nồm và mùa đốt rơm. Nên
// dải màu này nhạt và ngả ấm hơn một bầu trời ôn đới, và sương mù phía chân
// trời cũng dày hơn — nhìn xa là thành phố tan ngay vào mù.
const HORIZON = 0xd6e6ee;
const SKY_STOPS = [
  [0, "#7fb0d4"],
  [0.42, "#a8cbe0"],
  [0.78, "#d6e6ee"],
  [1, "#e9f1f3"],
];

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of SKY_STOPS) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const scene = new THREE.Scene();
scene.background = makeSkyTexture();
scene.fog = new THREE.FogExp2(HORIZON, 0.0052);

/* ---------- Máy quay và bộ dựng hình ---------- */

// Điện thoại được cấp ngân sách GPU nhẹ hơn: chặn tỉ lệ điểm ảnh và thu nhỏ
// bản đồ bóng, kẻo máy nóng ran mà khung hình vẫn giật.
const smallScreen = window.matchMedia("(max-width: 54rem)").matches;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 18;
controls.maxDistance = 140;
// Chặn không cho hạ máy xuống dưới đường chân trời, kẻo nhìn thấy mặt dưới
// của mặt đất.
controls.maxPolarAngle = Math.PI * 0.47;
controls.screenSpacePanning = false;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const UP = new THREE.Vector3(0, 1, 0);

/* ---------- Sổ ghi những gì đã dựng ---------- */

const markerMeshes = [];
const startupMarkers = new Map();
const labelElements = new Map();
const labelDims = new Map();
const landmarkLabelElements = [];
const waterSurfaces = [];

// Các đoàn phương tiện, mỗi đoàn một vòng cập nhật riêng mỗi khung hình.
const vehicleFleet = [];
const ferryFleet = [];
const planeFleet = [];
const subwayFleet = [];
const birdFleet = [];
const pedFleet = [];
let birdMesh = null;
let pedMesh = null;
let pedRect = null;

// Tâm các ô phố, do createBuildings điền vào; người đi bộ men theo mép chúng.
const sidewalkPlates = [];
// Hàng đợi cây: { x, z, type: "conifer" | "round", scale, rot, colorIndex }
const treeBuffer = [];

let hoverCandidate = null;
// Ghi lại lúc đặt ngón tay xuống, để phân biệt cú chạm chọn địa điểm với cú
// kéo xoay bản đồ: { x, y, item }
let pointerDown = null;

// Sắc lá cây Hà Nội: xà cừ, sấu, bằng lăng, phượng — mỗi cây bốc một sắc.
const GREEN_PALETTE = [
  0x3d6b39, 0x4a7d45, 0x557f42, 0x5e8a4c, 0x6d9a58, 0x7fa866, 0x4f7237,
].map((hex) => new THREE.Color(hex));

// Bảng màu của cảnh 3D, lấy đúng ba sắc nhóm trong tokens.css để pin trên
// bản đồ và chấm trong chú thích không bao giờ lệch nhau. Phần còn lại lấy
// từ vật liệu thật của Hà Nội: vữa xám ngả vàng, ngói, nhựa đường bạc nắng.
const colors = {
  accent: new THREE.Color(0x006956),
  food: new THREE.Color(0xd69727),
  sight: new THREE.Color(0x0085b5),
  home: new THREE.Color(0xb25634),
  red: new THREE.Color(0xc9302d),
  graphite: new THREE.Color(0x201c15),
  land: new THREE.Color(0xd4cfc0),
  land2: new THREE.Color(0xc8c2ae),
  road: new THREE.Color(0x38352e),
  building: new THREE.Color(0xdbd7c9),
  buildingDark: new THREE.Color(0x94958b),
};

// Nền đất trần trông rất giả nếu để một mảng bê tông phẳng lì. Lớp vân này
// nhân lên trên các mảng nền để phá sự phẳng đó: nhiễu giá trị hai tầng
// (tầng thô tạo mảng loang cỡ một khu phố, tầng mịn tạo lấm tấm), rồi rắc
// thêm ít hạt sạn. Sinh một lần lúc khởi động, chạy khung hình không tốn gì.
function valueNoiseCanvas(size, cells, seed, warm) {
  const rand = seededRandom(seed);
  const grid = Array.from({ length: cells + 1 }, () => Array.from({ length: cells + 1 }, () => rand()));
  // Nối viền để vân lặp được không thấy đường ghép.
  for (let i = 0; i <= cells; i += 1) {
    grid[i][cells] = grid[i][0];
    grid[cells][i] = grid[0][i];
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const step = size / cells;
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const gy = Math.floor(y / step);
    const fy = smooth((y - gy * step) / step);
    for (let x = 0; x < size; x += 1) {
      const gx = Math.floor(x / step);
      const fx = smooth((x - gx * step) / step);
      const top = grid[gy][gx] * (1 - fx) + grid[gy][gx + 1] * fx;
      const bottom = grid[gy + 1][gx] * (1 - fx) + grid[gy + 1][gx + 1] * fx;
      data[y * size + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { data, warm };
}

function makeGroundTexture() {
  const SIZE = 512;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(SIZE, SIZE);
  const coarse = valueNoiseCanvas(SIZE, 8, 20260806, true);
  const fine = valueNoiseCanvas(SIZE, 46, 19541010, false);
  const grit = seededRandom(1010);
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    // Quanh mức trắng: vân chỉ được làm tối đi tối đa vài phần trăm, nếu
    // không thì màu vật liệu bên dưới bị lệch hẳn.
    const shade = 1 - (coarse.data[i] - 0.5) * 0.075 - (fine.data[i] - 0.5) * 0.05;
    const speck = grit() < 0.006 ? 0.9 + grit() * 0.06 : 1;
    const v = shade * speck;
    const p = i * 4;
    // Mảng loang ngả ấm một chút ở chỗ sáng, ngả xám ở chỗ tối — giống vệt
    // nắng mưa trên vỉa hè hơn là một lớp xám đều.
    image.data[p] = Math.min(255, Math.round(255 * v * 1.008));
    image.data[p + 1] = Math.min(255, Math.round(255 * v));
    image.data[p + 2] = Math.min(255, Math.round(255 * v * 0.986));
    image.data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.22, 0.22);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const groundTexture = makeGroundTexture();

// Vật liệu dùng lại cho cả cảnh, gom theo thứ bậc: mặt đất trước, rồi thứ
// đặt trên đất, rồi thứ chuyển động. Bảng này từng có bảy vật liệu không
// chỗ nào dùng tới — đã bỏ.
const surface = (color, roughness, extra) =>
  new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide, ...extra });
const solid = (color, roughness, extra) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

const materials = {
  // --- mặt nước ---
  // Ba loại nước, ba màu khác nhau, và khác nhau là có lý do:
  //   river — sông Hồng, đúng nghĩa đen là sông màu hồng. Nước quanh năm đục
  //           phù sa, ngả nâu đất. Vẽ xanh nước biển thì đẹp nhưng sai hẳn
  //           với thứ ai đứng trên cầu Long Biên cũng nhìn thấy.
  //   pond  — Hồ Tây, Hồ Gươm: nước tù, nhiều tảo, xanh lục. Hồ Gươm còn
  //           được gọi là hồ Lục Thuỷ chính vì cái màu ấy.
  //   water — mặt nước nền trải rộng ra ngoài khung hình, chỉ làm nền cho
  //           thành phố tan vào sương. Giữ xanh nhạt, không phải sông.
  water: solid(0x35637e, 0.42, { metalness: 0.16 }),
  river: surface(0x8a7350, 0.44, { metalness: 0.22 }),
  pond: surface(0x3f7f74, 0.46, { metalness: 0.04 }),

  // --- mặt đất ---
  asphalt: surface(0x7c7d7c, 0.95, { map: groundTexture }),
  landAlt: surface(colors.land2, 0.9, { map: groundTexture }),
  park: surface(0x5f9a52, 0.9),
  parkLight: surface(0x82ab68, 0.92),
  hill: solid(0x5d8b4b, 0.96, { flatShading: true }),

  // --- kết cấu đặt trên đất ---
  road: solid(colors.road, 0.84),
  rail: solid(0xb4bcc0, 0.6),
  bridge: solid(0xd3c5a4, 0.66),
  seawall: solid(0xcdc3a4, 0.8),
  building: solid(colors.building, 0.72),
  roofColored: solid(0xffffff, 0.74),
  window: solid(0x384a5a, 0.38, { metalness: 0.08, emissive: new THREE.Color(0x07121b) }),
  glass: solid(0x8fb2bb, 0.26, { metalness: 0.1, transparent: true, opacity: 0.9 }),
  landmark: solid(0xcdc6b5, 0.55),
  copper: solid(0x5aa781, 0.62, { metalness: 0.04 }),
  ghost: solid(colors.buildingDark, 0.95),
  treeLeaf: solid(0xffffff, 0.92, { flatShading: true }),
  treeTrunk: solid(0x67492e, 0.9),

  // --- thứ chuyển động ---
  ferry: solid(0xf2efe6, 0.48),
  plane: solid(0xeef2f5, 0.4),
};

// Toạ độ địa lý → toạ độ cảnh. Trục z đảo dấu vì vĩ độ tăng về phía bắc còn
// z trong Three.js tăng về phía người xem — không đảo thì thành phố lộn ngược
// nam bắc.
function project(lat, lng, y = 0) {
  return new THREE.Vector3((lng - CENTER.lng) * SCALE.lng, y, -(lat - CENTER.lat) * SCALE.lat);
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };

// Mọi chuỗi do người khác nhập — tên địa điểm lấy từ Google Sheet chẳng hạn —
// đều phải đi qua đây trước khi ghép vào innerHTML.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Chỉ cho qua http và https. Thiếu bước này thì một ô "website" trong Sheet
// ghi javascript:... là chạy được mã lạ ngay trên trang.
function safeUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const full = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(full);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function logoPath(item) {
  return `/logos/${item.id}.svg`;
}

function sourceLabel(item) {
  if (item.source === "approx") return "Vị trí xấp xỉ · Approximate";
  return "Chọn lọc thủ công · Curated";
}

function areaItems(areaId) {
  if (areaId === "all") return STARTUPS;
  return STARTUPS.filter((startup) => startup.area === areaId);
}

function stageColor(stage) {
  if (stage === "Ẩm thực") return colors.food;
  if (stage === "Du lịch") return colors.sight;
  if (stage === "BĐS") return colors.home;
  return colors.accent;
}

// Compact tag shown on labels: ăn / chơi / ở.
function stageTag(stage) {
  if (stage === "Ẩm thực") return "Ăn";
  if (stage === "Du lịch") return "Chơi";
  if (stage === "BĐS") return "Ở";
  return "";
}

// Bộ sinh số giả ngẫu nhiên có hạt giống. Cả thành phố này dựng bằng thuật
// toán chứ không đặt tay từng khối, nên bắt buộc phải tái lập được: cùng một
// hạt giống thì lần nào mở trang cũng ra đúng thành phố ấy. Dùng sfc32 của
// PractRand — chu kỳ dài, phân bố đều, gọn trong mấy dòng.
function seededRandom(seed) {
  let a = seed >>> 0;
  let b = (seed ^ 0x9e3779b9) >>> 0;
  let c = (seed ^ 0x85ebca6b) >>> 0;
  let d = 1;
  const step = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i += 1) step();
  return function random() {
    return step() / 4294967296;
  };
}

// Toạ độ địa lý → điểm trong cảnh. Gom riêng vì ba hàm dựng hình dưới đây
// đều cần, và trước kia mỗi hàm tự lặp lại một vòng map giống hệt nhau.
function toScenePoints(coords, y = 0) {
  return coords.map(([lat, lng]) => project(lat, lng, y));
}

function makeShape(coords, material, y = 0, shadow = false, holes = []) {
  const outline = new THREE.Shape();
  toScenePoints(coords).forEach((p, index) => {
    if (index === 0) outline.moveTo(p.x, p.z);
    else outline.lineTo(p.x, p.z);
  });
  outline.closePath();
  // Hồ lớn được khoét thủng hẳn qua mảng đất, để mặt nước động ở lớp dưới
  // lộ lên thành nước thật chứ không phải một mảng xanh vẽ đè.
  for (const holeCoords of holes) {
    const hole = new THREE.Path();
    toScenePoints(holeCoords).forEach((p, index) => {
      if (index === 0) hole.moveTo(p.x, p.z);
      else hole.lineTo(p.x, p.z);
    });
    hole.closePath();
    outline.holes.push(hole);
  }
  const geometry = new THREE.ShapeGeometry(outline);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = shadow;
  scene.add(mesh);
  return mesh;
}

// Ống bám theo một đường: dùng cho kè, ray, dây văng, mép đường. Nhận thẳng
// điểm trong cảnh, nên hai hàm bọc dưới đây chỉ khác nhau ở khâu đổi toạ độ.
function tubeThroughPoints(points, radius, material, segments) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 8, false),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeTube(coords, radius, material, y = 0.05, segments = 80) {
  const points = toScenePoints(coords, y);
  return { mesh: tubeThroughPoints(points, radius, material, segments), points };
}

function makeCurveTube(points, radius, material, segments = 48) {
  return tubeThroughPoints(points, radius, material, segments);
}

/* ---------- Ánh sáng ---------- */

// Hà Nội ở vĩ độ 21° Bắc nên mặt trời lên rất cao, bóng đổ ngắn và gắt hơn
// nhiều so với thành phố ôn đới. Góc nắng dưới đây dựng theo buổi chiều
// tháng mười: chếch tây nam, đủ xiên để khối nhà có mặt sáng mặt tối.
const SUN_AIM = { x: -4, z: -10 };
const SUN_OFFSET = { x: -52, y: 46, z: 40 };
// Khung đổ bóng phải trùm hết mặt bằng thành phố, khoảng x [-90, 80],
// z [-77, 57]. Rộng quá thì bóng vỡ hạt, hẹp quá thì mất bóng ở rìa.
const SHADOW_EXTENT = { x: 100, z: 95 };

function createLights() {
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x4a4335, 2.75));

  const sun = new THREE.DirectionalLight(0xffedc9, 3.45);
  sun.target.position.set(SUN_AIM.x, 0, SUN_AIM.z);
  sun.position.set(SUN_AIM.x + SUN_OFFSET.x, SUN_OFFSET.y, SUN_AIM.z + SUN_OFFSET.z);
  sun.castShadow = true;

  const shadow = sun.shadow;
  const res = smallScreen ? 1024 : 2048;
  shadow.mapSize.set(res, res);
  shadow.camera.near = 2;
  shadow.camera.far = 220;
  shadow.camera.left = -SHADOW_EXTENT.x;
  shadow.camera.right = SHADOW_EXTENT.x;
  shadow.camera.top = SHADOW_EXTENT.z;
  shadow.camera.bottom = -SHADOW_EXTENT.z;
  // Cặp bias này khử vằn bóng trên mặt tường và hiện tượng bóng rời chân nhà.
  shadow.bias = -0.00035;
  shadow.normalBias = 0.02;

  scene.add(sun.target);
  scene.add(sun);
  createSunGlow();
}

// Một sprite cộng sáng treo về phía mặt trời. Không chiếu sáng gì cả, chỉ để
// bầu trời có nguồn sáng nhìn thấy được và lớp mù có cớ tồn tại — đổi lại
// đúng một sprite, rẻ hơn mọi cách làm loá ống kính khác.
function createSunGlow() {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const mid = SIZE / 2;
  const halo = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  for (const [stop, color] of [
    [0, "rgba(255, 248, 227, 0.94)"],
    [0.24, "rgba(255, 239, 203, 0.48)"],
    [0.58, "rgba(255, 229, 186, 0.15)"],
    [1, "rgba(255, 229, 186, 0)"],
  ]) {
    halo.addColorStop(stop, color);
  }
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  // Cùng hướng với đèn mặt trời nhưng hạ thấp gần chân trời, để lúc xoay
  // camera vẫn bắt được nó phía trên sông Hồng.
  sprite.position.set(-200, 82, 128);
  sprite.scale.setScalar(170);
  scene.add(sprite);
}

/* ---------- Vài khối dựng sẵn ---------- */

function createShoreline(coords) {
  const closed = [...coords, coords[0]];
  makeTube(closed, 0.045, materials.seawall, 0.12, Math.max(48, coords.length * 14));
}

function createPier(lat, lng, width, depth, rotation = 0) {
  const group = new THREE.Group();
  group.position.copy(project(lat, lng, 0.08));
  group.rotation.y = rotation;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), materials.seawall);
  deck.position.y = 0.1;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Bốn cọc chống, thụt vào trong mép sàn cho ra dáng cầu cảng.
  const postGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8);
  for (const x of [-width * 0.38, width * 0.38]) {
    for (const z of [-depth * 0.36, depth * 0.36]) {
      const post = new THREE.Mesh(postGeometry, materials.bridge);
      post.position.set(x, -0.04, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  scene.add(group);
}

function ellipseCoords(lat, lng, latRadius, lngRadius, steps = 28) {
  const coords = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    coords.push([lat + Math.sin(angle) * latRadius, lng + Math.cos(angle) * lngRadius]);
  }
  return coords;
}

function createBlockAt(lat, lng, width, depth, height, material, rotation = 0, y = 0) {
  const p = project(lat, lng, y);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(p.x, y + height / 2, p.z);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addLandmarkLabel(name, lat, lng, y = 3) {
  const el = document.createElement("div");
  el.className = "landmark-label";
  el.textContent = name;
  labelsLayer.appendChild(el);
  landmarkLabelElements.push({ el, point: { lat, lng, y } });
}

/* ---------- Cây xanh ---------- */

// Cây không dựng ngay mà xếp vào hàng đợi, cuối cùng gộp thành vài lưới
// instanced. Vài nghìn cái cây mà mỗi cái một mesh riêng thì trình duyệt
// chết ngay từ lúc mở trang.
function queueTree(x, z, random, { type, scale, spread = 0 } = {}) {
  treeBuffer.push({
    x: x + (spread ? (random() - 0.5) * spread : 0),
    z: z + (spread ? (random() - 0.5) * spread : 0),
    type: type || (random() < 0.42 ? "conifer" : "round"),
    scale,
    rot: random() * Math.PI,
    colorIndex: Math.floor(random() * GREEN_PALETTE.length),
  });
}

function addTree(lat, lng, random, { type, scaleBase = 1 } = {}) {
  const p = project(lat, lng);
  queueTree(p.x, p.z, random, { type, scale: scaleBase * (0.62 + random() * 0.7) });
}

// Rải cây vào trong một đa giác cho tới khi đủ số lượng. `guard` chặn vòng
// lặp vô tận với những đa giác gầy quá, hộp bao rộng mà lòng thì hẹp — bốc
// điểm ngẫu nhiên mãi mà chẳng trúng vào trong.
function scatterTreesInPoly(poly, count, random, opts = {}) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of poly) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  let placed = 0;
  for (let guard = 0; placed < count && guard < count * 20; guard += 1) {
    const lat = minLat + random() * (maxLat - minLat);
    const lng = minLng + random() * (maxLng - minLng);
    if (!pointInPoly(lat, lng, poly)) continue;
    if (opts.avoidWater && LAKE_FEATURES.some((f) => f.kind === "water" && inEllipse(lat, lng, f))) continue;
    addTree(lat, lng, random, opts);
    placed += 1;
  }
}

// Những hàng cây mà người Hà Nội mặc định phải có. Đây là các con phố nổi
// tiếng vì bóng cây chứ không phải vì kiến trúc: sấu Phan Đình Phùng, xà cừ
// Hoàng Diệu, hàng cây ven Hồ Tây đường Thanh Niên, và hàng cây trên đê.
const TREE_ROWS = [
  { from: [21.0402, 105.8392], to: [21.0426, 105.8472], step: 0.42 }, // Phan Đình Phùng
  { from: [21.0398, 105.8397], to: [21.0422, 105.8477], step: 0.42 }, // Phan Đình Phùng, hàng bên kia
  { from: [21.0302, 105.8372], to: [21.0398, 105.8382], step: 0.5 }, // Hoàng Diệu
  { from: [21.0424, 105.8388], to: [21.0492, 105.8348], step: 0.45 }, // Thanh Niên
  { from: [21.0304, 105.8028], to: [21.0338, 105.8298], step: 0.7 }, // Kim Mã
  { from: [21.0555, 105.8458], to: [21.0295, 105.8598], step: 0.8 }, // đê Yên Phụ – Trần Quang Khải
  { from: [21.0175, 105.842], to: [21.0255, 105.8408], step: 0.55 }, // Lê Duẩn
];

function createStreetTrees() {
  const random = seededRandom(9001);
  for (const row of TREE_ROWS) {
    const a = project(row.from[0], row.from[1]);
    const b = project(row.to[0], row.to[1]);
    const count = Math.max(2, Math.floor(a.distanceTo(b) / row.step));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const lat = row.from[0] + (row.to[0] - row.from[0]) * t;
      const lng = row.from[1] + (row.to[1] - row.from[1]) * t;
      // Bỏ qua cây rơi xuống nước hoặc ra ngoài bờ hữu.
      if (!pointInPoly(lat, lng, WEST_BANK)) continue;
      if (LAKES.some((lake) => pointInPoly(lat, lng, lake))) continue;
      const p = project(lat, lng);
      // Hàng cây thẳng tắp trông giả, xô lệch mỗi cây một chút cho tự nhiên.
      queueTree(p.x, p.z, random, { type: "round", scale: 0.48 + random() * 0.24, spread: 0.16 });
    }
  }
}

// Dựng toàn bộ hàng đợi thành lưới instanced: cây lá kim một lưới, cây tán
// tròn tách làm hai lưới thân và tán vì hai vật liệu khác nhau.
function buildTrees() {
  if (!treeBuffer.length) return;

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tint = new THREE.Color();

  const instanced = (geometry, material, count) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    return mesh;
  };

  const conifers = treeBuffer.filter((t) => t.type === "conifer");
  if (conifers.length) {
    const mesh = instanced(new THREE.ConeGeometry(0.16, 0.62, 6), materials.treeLeaf, conifers.length);
    conifers.forEach((tree, i) => {
      pos.set(tree.x, 0.31 * tree.scale + 0.05, tree.z);
      quat.setFromAxisAngle(UP, tree.rot);
      scl.setScalar(tree.scale);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.copy(GREEN_PALETTE[tree.colorIndex]));
    });
    scene.add(mesh);
  }

  const rounds = treeBuffer.filter((t) => t.type === "round");
  if (rounds.length) {
    const leaves = instanced(new THREE.IcosahedronGeometry(0.24, 0), materials.treeLeaf, rounds.length);
    const trunks = instanced(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 5), materials.treeTrunk, rounds.length);
    rounds.forEach((tree, i) => {
      const trunkHeight = 0.2 * tree.scale;

      pos.set(tree.x, trunkHeight / 2 + 0.05, tree.z);
      quat.identity();
      scl.setScalar(tree.scale);
      matrix.compose(pos, quat, scl);
      trunks.setMatrixAt(i, matrix);

      pos.set(tree.x, trunkHeight + 0.2 * tree.scale + 0.05, tree.z);
      quat.setFromAxisAngle(UP, tree.rot);
      // Bẹt tán xuống một chút: khối hai mươi mặt tròn xoe trông như quả bóng.
      scl.set(tree.scale, tree.scale * 0.92, tree.scale);
      matrix.compose(pos, quat, scl);
      leaves.setMatrixAt(i, matrix);
      leaves.setColorAt(i, tint.copy(GREEN_PALETTE[tree.colorIndex]));
    });
    scene.add(trunks);
    scene.add(leaves);
  }
}

// Gò cỏ ít mặt, tạo địa hình gợn nhẹ trong công viên. Đặt xích đạo của khối
// cầu trùng mặt cỏ nên chỉ phần chỏm nhô lên thành gò.
function createHill(lat, lng, radius, height, tint = 0) {
  const material = materials.hill.clone();
  if (tint) material.color.offsetHSL(0, 0, tint);
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material);
  const p = project(lat, lng);
  mesh.scale.set(radius, height, radius);
  mesh.position.set(p.x, 0.05, p.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Thống Nhất park, the bãi giữa river islet, and the lakeside greens.
function createParkDetails() {
  const random = seededRandom(930);

  // Gentle mounds in the bigger parks.
  createHill(21.0145, 105.8432, 1.6, 0.22, 0.03); // Thống Nhất
  createHill(21.0195, 105.8468, 1.3, 0.18, 0.0); // Thống Nhất bắc
  createHill(21.0392, 105.8312, 1.2, 0.2, 0.04); // Bách Thảo

  // Small lakes + lawns drawn as still water/light green on the land.
  LAKE_FEATURES.forEach((f) => {
    const coords = ellipseCoords(f.lat, f.lng, f.rLat, f.rLng, 30);
    if (f.kind === "water") makeShape(coords, materials.pond, 0.085, true);
    else makeShape(coords, materials.parkLight, 0.07, true);
  });

  // Bãi giữa: banana groves and vegetable plots on the sandbar.
  makeShape(BAI_GIUA, materials.parkLight, 0.04, true);
  scatterTreesInPoly(BAI_GIUA, 130, random, { type: "round", scaleBase: 0.9 });

  // Canopy in the parks around the lakes.
  scatterTreesInPoly(
    [
      [21.0435, 105.8378],
      [21.0495, 105.8345],
      [21.0492, 105.8398],
      [21.0448, 105.843],
    ],
    26,
    random,
    { type: "round", scaleBase: 1.05 },
  ); // Thanh Niên strip + Trúc Bạch banks

  // Quảng An peninsula gardens.
  scatterTreesInPoly(
    [
      [21.059, 105.8265],
      [21.0655, 105.8255],
      [21.0668, 105.831],
      [21.0605, 105.8322],
    ],
    40,
    random,
    { type: "round" },
  );
}

function createParks() {
  PARKS.forEach((coords) => makeShape(coords, materials.park, 0.05, true));

  const random = seededRandom(311);
  PARKS.filter((p) => p.length >= 4).forEach((poly) => scatterTreesInPoly(poly, 18, random));
}

// Lòng sông Hồng, ghép từ chính hai bờ đã vẽ: mép sông của bờ hữu chạy từ
// bắc xuống nam, rồi mép sông của bờ tả chạy ngược lên. Dựng từ hai mảng gốc
// chứ không chép toạ độ ra, để sửa bờ là lòng sông tự khớp theo.
//
// Nới mỗi mép ra ngoài một quãng: mảng phù sa cố ý thò sang dưới hai bờ.
// Hai bờ nằm ở cao độ 0 còn mảng này ở -0.16 nên phần thò ra bị che hết,
// đổi lại không bao giờ hở một sợi nước xanh ở mép do sai số làm tròn.
const RIVER_OVERLAP = 0.005;
const nudge = (coords, delta) => coords.map(([lat, lng]) => [lat, lng + delta]);
const RIVER_CHANNEL = [
  [21.125, 105.8185 - RIVER_OVERLAP],
  ...nudge(WEST_BANK.slice(0, 16), -RIVER_OVERLAP),
  ...nudge(EAST_BANK.slice(0, 14), RIVER_OVERLAP).toReversed(),
  [21.125, 105.831 + RIVER_OVERLAP],
];

function createBaseMap() {
  const waterGeo = new THREE.PlaneGeometry(260, 230, 80, 72);
  const water = new THREE.Mesh(waterGeo, materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.18;
  water.receiveShadow = true;
  water.userData.baseZ = waterGeo.attributes.position.array.slice();
  scene.add(water);
  waterSurfaces.push(water);

  // Phù sa phủ lên mặt nước nền, chỉ trong đúng lòng sông. Cao độ -0.03 là
  // tính toán chứ không phải chọn bừa: mặt nước nền ở -0.18 nhưng gợn sóng
  // nhô lên tới +0.09, nên bất cứ chỗ nào thấp hơn -0.09 là sóng xanh sẽ
  // đâm xuyên qua thành từng vệt. Trên -0.03 thì lại chạm hai bờ ở cao độ 0.
  makeShape(RIVER_CHANNEL, materials.river, -0.03, true);

  // Main city with the three big lakes punched out as real water.
  makeShape(WEST_BANK, materials.asphalt, 0, true, LAKES);
  createShoreline(WEST_BANK);
  LAKES.forEach((lake) => createShoreline(lake));

  makeShape(EAST_BANK, materials.landAlt, 0, true);
  createShoreline(EAST_BANK);

  makeShape(BAI_GIUA, materials.landAlt, 0.01, true);
  createShoreline(BAI_GIUA);

  createParks();
  createParkDetails();

  // Sông Hồng landings: Chương Dương Độ + Bát Tràng-bound jetties.
  createPier(21.0375, 105.8595, 1.6, 0.4, -0.55);
  createPier(21.0165, 105.864, 1.5, 0.38, -0.5);
  createPier(21.0475, 105.8665, 1.4, 0.36, 2.6);
}

// The French-quarter grid is rotated only a few degrees off north. Build it
// in a local frame and clip every segment to the west bank so streets never
// run out over the water.
const GRID = (() => {
  const theta = (8 * Math.PI) / 180;
  const k = Math.cos((21.03 * Math.PI) / 180); // lng compression
  // unit vectors (in lat/lng degrees) for "north-south" and "east-west" streets
  const av = { dlat: Math.cos(theta), dlng: Math.sin(theta) / k }; // along Phố Huế axis
  const st = { dlat: Math.cos(theta + Math.PI / 2), dlng: Math.sin(theta + Math.PI / 2) / k };
  const origin = { lat: 21.025, lng: 105.846 }; // Hỏa Lò corner
  return { av, st, origin };
})();

// Bước lưới dùng chung cho nhà, tấm lát vỉa hè và mạng giao thông, để xe
// chạy đúng vào những khe mà các ô phố chừa ra.
// Ô phố Hà Nội nhỏ hơn hẳn ô phố các thành phố quy hoạch bàn cờ phương Tây:
// phố cổ chia lô theo chiều sâu thửa ruộng cũ, ngang chỉ vài mét.
const CELL_U = 0.0009; // ~100 m giữa hai phố chạy đông–tây
const CELL_V = 0.0016; // ~170 m giữa hai phố chạy bắc–nam
// Hai véc-tơ cạnh của một ô phố, đo một lần lúc khởi động rồi dùng lại khắp
// nơi: nhà, tấm lát vỉa hè, làn xe và người đi bộ đều bám theo chúng, nên
// mọi thứ tự khớp vào cùng một lưới phố mà không phải tính lại.
const GRID_METRICS = (() => {
  const origin = project(GRID.origin.lat, GRID.origin.lng);
  const edge = (d, step) => project(GRID.origin.lat + d.dlat * step, GRID.origin.lng + d.dlng * step).sub(origin);
  const uVec = edge(GRID.av, CELL_U); // cạnh ngắn: từ phố này sang phố kia
  const vVec = edge(GRID.st, CELL_V); // cạnh dài: từ đại lộ này sang đại lộ kia
  return {
    uVec,
    vVec,
    uLen: uVec.length(),
    vLen: vVec.length(),
    rot: Math.atan2(uVec.x, uVec.z),
  };
})();

// Long Biên rust for the old steel bridge; pale concrete elsewhere.
const longBienSteel = new THREE.MeshStandardMaterial({ color: 0x6e6259, roughness: 0.72, metalness: 0.18 });

function createBridgeDetails() {
  const deckHeight = 0.62;
  BRIDGES.forEach((bridge) => {
    const isTruss = bridge.type === "truss";
    const deckMaterial = isTruss ? longBienSteel : materials.bridge;

    // Roadway / rail deck
    const deckPts = bridge.deck.map(([lat, lng]) => project(lat, lng, deckHeight));
    makeCurveTube(deckPts, isTruss ? 0.055 : 0.07, deckMaterial, 60);

    // Piers under every deck vertex.
    deckPts.forEach((p, index) => {
      if (index === 0 || index === deckPts.length - 1) return;
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, deckHeight + 0.18, 8), deckMaterial);
      pier.position.set(p.x, (deckHeight - 0.18) / 2, p.z);
      pier.castShadow = true;
      scene.add(pier);
    });

    if (isTruss) {
      // Long Biên's cantilever humps: an arched top chord over each span,
      // plus a lower parallel chord, sketching the famous silhouette.
      for (let s = 0; s < deckPts.length - 1; s += 1) {
        const a = deckPts[s].clone();
        const b = deckPts[s + 1].clone();
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        mid.y = deckHeight + 0.42;
        makeCurveTube([a, mid, b], 0.03, longBienSteel, 26);
        // Verticals tying the hump to the deck.
        for (const t of [0.3, 0.5, 0.7]) {
          const base = new THREE.Vector3().lerpVectors(a, b, t);
          const arcY = deckHeight + 0.42 * Math.sin(Math.PI * t) * 0.92 + 0.02;
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.014, 0.014, arcY - deckHeight, 6),
            longBienSteel,
          );
          post.position.set(base.x, deckHeight + (arcY - deckHeight) / 2, base.z);
          scene.add(post);
        }
      }
    }

    if (bridge.type === "cable") {
      // Nhật Tân: five A-shaped pylons with fanned stays.
      const pylonHeight = 1.7;
      bridge.towers.forEach(([lat, lng]) => {
        const p = project(lat, lng);
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.11, pylonHeight, 6), materials.landmark);
        pylon.position.set(p.x, deckHeight + pylonHeight / 2, p.z);
        pylon.castShadow = true;
        scene.add(pylon);
        const top = new THREE.Vector3(p.x, deckHeight + pylonHeight, p.z);
        // Fan of stays fore and aft along the deck direction.
        const dir = new THREE.Vector3()
          .subVectors(deckPts[deckPts.length - 1], deckPts[0])
          .normalize();
        for (const along of [-1.6, -0.9, 0.9, 1.6]) {
          const anchor = new THREE.Vector3(p.x, deckHeight + 0.02, p.z).addScaledVector(dir, along);
          makeCurveTube([top, anchor], 0.008, materials.rail, 6);
        }
      });
    }
  });
}

/* ---------- Đường sắt đô thị ---------- */

// Ba toa nối nhau, thân trắng có dải màu theo tuyến. Không cần chi tiết hơn
// vì ở cỡ này đoàn tàu chỉ dài chừng hai centimet trên màn hình.
function createSubwayTrainMesh(color = 0x169b62) {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xe6eaec, roughness: 0.34, metalness: 0.1 });
  const stripe = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: new THREE.Color(color).multiplyScalar(0.2),
  });
  const CARS = 3;
  const GAP = 0.66;
  for (let i = 0; i < CARS; i += 1) {
    const z = (i - (CARS - 1) / 2) * GAP;
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.62), shell);
    car.position.set(0, 0.14, z);
    car.castShadow = true;
    group.add(car);

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.5), stripe);
    band.position.set(0, 0.2, z);
    group.add(band);
  }
  group.scale.setScalar(0.7);
  return group;
}

// Hai tuyến metro của Hà Nội chạy trên cao suốt tuyến; đường sắt quốc gia
// thì bò dưới đất rồi leo lên mặt cầu Long Biên để vượt sông.
const VIADUCT_Y = 0.58;
const RAIL_BRIDGE_Y = 0.68;
const TRACK_STEP = 0.9;

function trackY(line, lat, lng, baseY) {
  if (line.mode === "viaduct") return VIADUCT_Y;
  return inWater(lat, lng) ? RAIL_BRIDGE_Y : baseY;
}

// Lấy mẫu dày dọc tuyến để có mặt cắt đứng thật: đoạn nào trên cao thì giữ
// lại riêng, vì còn phải dựng trụ đỡ bên dưới.
function subwayProfile(line, baseY) {
  const points = [];
  const elevated = [];
  const stops = line.stops;
  const push = (lat, lng) => {
    const y = trackY(line, lat, lng, baseY);
    const point = project(lat, lng, y);
    points.push(point);
    if (y === VIADUCT_Y) elevated.push(point);
  };
  for (let s = 0; s < stops.length - 1; s += 1) {
    const [aLat, aLng] = stops[s];
    const [bLat, bLng] = stops[s + 1];
    const span = project(aLat, aLng).distanceTo(project(bLat, bLng));
    const segs = Math.max(2, Math.round(span / TRACK_STEP));
    for (let k = 0; k < segs; k += 1) {
      const t = k / segs;
      push(aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t);
    }
  }
  const [lastLat, lastLng] = stops[stops.length - 1];
  push(lastLat, lastLng);
  return { points, elevated };
}

function createSubwayLayer() {
  // Nhà ga vẽ theo lối sơ đồ tàu điện: đĩa trắng viền sẫm nằm trên vạch màu
  // của tuyến, đọc được ngay cả khi thu nhỏ hết cỡ.
  const diskFace = new THREE.MeshStandardMaterial({
    color: 0xf6f7f4,
    roughness: 0.4,
    emissive: new THREE.Color(0x1a1a1a),
  });
  const diskRim = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6 });
  const diskGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.05, 16);
  const rimGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.036, 16);
  const pierGeo = new THREE.CylinderGeometry(0.032, 0.05, 1, 8);
  const pierMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5158, roughness: 0.7 });

  METRO_LINES.forEach((line, lineIndex) => {
    const rail = new THREE.MeshStandardMaterial({
      color: line.color,
      roughness: 0.45,
      emissive: new THREE.Color(line.color).multiplyScalar(0.3),
    });
    // Nhích mỗi tuyến lên một chút để chỗ hai tuyến chồng nhau không tranh
    // nhau chiều sâu rồi nhấp nháy.
    const baseY = 0.05 + lineIndex * 0.007;
    const { points, elevated } = subwayProfile(line, baseY);

    const track = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 3, 0.04, 8, false),
      rail,
    );
    track.castShadow = true;
    track.receiveShadow = true;
    scene.add(track);

    // Trụ đỡ đoạn trên cao, cách một điểm dựng một cái cho đỡ dày.
    elevated.forEach((point, index) => {
      if (index % 2 !== 0) return;
      const pier = new THREE.Mesh(pierGeo, pierMaterial);
      pier.scale.y = point.y;
      pier.position.set(point.x, point.y / 2, point.z);
      pier.castShadow = true;
      scene.add(pier);
    });

    for (const [lat, lng] of line.stops) {
      const stationY = trackY(line, lat, lng, baseY);
      // Không cắm đĩa nhà ga giữa lòng sông.
      if (stationY < 0 || inWater(lat, lng)) continue;
      const p = project(lat, lng, stationY + 0.035);
      const rim = new THREE.Mesh(rimGeo, diskRim);
      rim.position.copy(p);
      scene.add(rim);
      const face = new THREE.Mesh(diskGeo, diskFace);
      face.position.copy(p);
      face.position.y += 0.02;
      scene.add(face);
    }

    // Mỗi tuyến một đoàn tàu, tuyến dài thì hai. Tàu chạy trên đúng mặt cắt
    // vừa dựng, nên metro lướt trên cầu cạn còn tàu hoả cũ thì leo cầu Long
    // Biên y như ngoài đời.
    const trains = line.stops.length >= 8 ? 2 : 1;
    for (let i = 0; i < trains; i += 1) {
      const train = createSubwayTrainMesh(line.color);
      scene.add(train);
      subwayFleet.push({
        mesh: train,
        path: points,
        t: lineIndex * 0.27 + i * 0.5,
        speed: 0.016 + lineIndex * 0.002,
      });
    }
  });

  addLandmarkLabel("Ga Hà Nội", 21.0245, 105.8412, 1.6);
  addLandmarkLabel("Ga Cát Linh", 21.0293, 105.8237, 1.5);
}

/* ---------- Thuyền bè trên sông và hồ ---------- */

function createFerryMesh(accent = 0x2e6cff) {
  const group = new THREE.Group();
  const hullPaint = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 1.3), hullPaint);
  hull.position.y = 0.12;
  hull.castShadow = true;
  group.add(hull);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.6), materials.ferry);
  cabin.position.y = 0.34;
  cabin.castShadow = true;
  group.add(cabin);

  // Mũi thuyền: khối chóp bốn mặt xoay 45° để hai cạnh chụm thành mũi nhọn.
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.42, 4), hullPaint);
  bow.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  bow.position.set(0, 0.12, 0.82);
  group.add(bow);

  group.scale.setScalar(0.86);
  return group;
}

const BOAT_ROUTES = [
  {
    // Xà lan chở cát ngược dòng chính sông Hồng, phía tây bãi giữa.
    color: 0x8a5f46,
    scale: 1,
    path: [
      [20.988, 105.876], [21.008, 105.87], [21.025, 105.8655], [21.038, 105.8618],
      [21.048, 105.856], [21.058, 105.85], [21.066, 105.844],
    ],
  },
  {
    // Thuyền du lịch lượn vòng nhánh đông, qua chân cầu Long Biên.
    color: 0x2e6cff,
    scale: 0.8,
    path: [
      [21.033, 105.864], [21.039, 105.869], [21.0445, 105.8695], [21.0505, 105.8645],
      [21.056, 105.8575], [21.052, 105.8545], [21.0455, 105.8595], [21.038, 105.8625],
      [21.033, 105.864],
    ],
  },
  {
    // Thiên nga đạp vịt lững thững trên Hồ Tây.
    color: 0xf4f1e8,
    scale: 0.55,
    path: [
      [21.052, 105.818], [21.056, 105.824], [21.06, 105.829], [21.056, 105.832],
      [21.05, 105.83], [21.047, 105.824], [21.052, 105.818],
    ],
  },
];

function createFerries() {
  BOAT_ROUTES.forEach((route, index) => {
    const mesh = createFerryMesh(route.color);
    mesh.add(createWake());
    mesh.scale.setScalar(0.86 * (route.scale ?? 1));
    scene.add(mesh);
    ferryFleet.push({
      mesh,
      path: route.path.map(([lat, lng]) => project(lat, lng, 0.1)),
      t: index * 0.43,
      speed: 0.009 + index * 0.003,
      lane: 0,
    });
  });
}

// Vệt nước trắng kéo sau đuôi thuyền. Là con của chính con thuyền nên nó tự
// đi theo, không phải cập nhật gì mỗi khung hình.
function createWake() {
  const W = 64;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  // Sau khi tấm phẳng được lật nằm ngang (rotation.x = -PI/2), cạnh dưới của
  // canvas quay về phía đuôi thuyền, nên đầu đậm của vệt nằm ở y = H.
  const fade = ctx.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(0.65, "rgba(255,255,255,0.3)");
  fade.addColorStop(1, "rgba(255,255,255,0.75)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 1.7),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, -0.05, -1.25);
  return wake;
}

/* ---------- Máy bay lên xuống Nội Bài ---------- */

function createPlaneMesh() {
  const group = new THREE.Group();
  for (const [w, h, d, y, z, shadow] of [
    [0.22, 0.22, 1.6, 0, 0, true], // thân
    [1.45, 0.05, 0.34, 0, -0.08, false], // cánh chính
    [0.65, 0.05, 0.22, 0.16, -0.66, false], // cánh đuôi
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.plane);
    part.position.set(0, y, z);
    part.castShadow = shadow;
    group.add(part);
  }
  group.scale.setScalar(0.9);
  return group;
}

function createPlanes() {
  // Approach and departure paths for Nội Bài, following the river valley.
  const flightPaths = [
    [
      [20.988, 105.885, 16],
      [21.03, 105.858, 18],
      [21.07, 105.828, 20],
      [21.097, 105.812, 22],
    ],
    [
      [21.097, 105.862, 24],
      [21.05, 105.82, 22],
      [20.988, 105.788, 20],
    ],
  ];
  flightPaths.forEach((path, index) => {
    const mesh = createPlaneMesh();
    scene.add(mesh);
    planeFleet.push({
      mesh,
      path: path.map(([lat, lng, y]) => project(lat, lng, y)),
      t: index * 0.48,
      speed: 0.01 + index * 0.003,
    });
  });
}

  // Đường CHÍNH LÀ khe hở giữa các tấm lát vỉa hè, nên tuyến xe chạy được
  // sinh trên đúng cái lưới mà nhà cửa bám vào: mọi đại lộ có đủ đất bên
  // dưới, các phố ngang lớn, hai trục ven sông, và mặt cầu. Mọi tuyến đều bị
  // cắt theo ranh đất, nhờ vậy xe không bao giờ chạy xuyên nhà, xuyên công
  // viên hay lao xuống nước.
const ROAD_Y = 0.055;

function streetAllowed(lat, lng) {
  if (!pointInPoly(lat, lng, WEST_BANK)) return false;
  for (const lake of LAKES) {
    if (pointInPoly(lat, lng, lake)) return false;
  }
  for (const park of PARKS) {
    if (pointInPoly(lat, lng, park)) return false;
  }
  for (const f of LAKE_FEATURES) {
    if (f.kind === "water" && inEllipse(lat, lng, f)) return false;
  }
  return true;
}

function gridStreetPoint(u, v, y) {
  const lat = GRID.origin.lat + GRID.av.dlat * u + GRID.st.dlat * v;
  const lng = GRID.origin.lng + GRID.av.dlng * u + GRID.st.dlng * v;
  return { lat, lng, point: project(lat, lng, y) };
}

function createStreetNetwork() {
  const paths = [];
  const flushRun = (run, minLength) => {
    if (run.length >= minLength) paths.push(run);
    return [];
  };

  // North-south lattice streets, broken at lakes, parks, and water.
  for (let j = -18; j <= 18; j += 1) {
    let run = [];
    for (let i = -34; i <= 26; i += 1) {
      const { lat, lng, point } = gridStreetPoint(i * CELL_U, j * CELL_V, ROAD_Y);
      if (streetAllowed(lat, lng)) run.push(point);
      else run = flushRun(run, 6);
    }
    flushRun(run, 6);
  }

  // Major east-west streets: Đại Cồ Việt, Trần Hưng Đạo, Tràng Thi,
  // Hàng Bông, Hàng Mã, Phan Đình Phùng.
  for (const i of [-26, -16, -8, 0, 7, 13, 18]) {
    let run = [];
    for (let j = -18; j <= 18; j += 0.5) {
      const { lat, lng, point } = gridStreetPoint(i * CELL_U, j * CELL_V, ROAD_Y);
      if (streetAllowed(lat, lng)) run.push(point);
      else run = flushRun(run, 5);
    }
    flushRun(run, 5);
  }

  // Boulevards: the dyke road, Thanh Niên, and the big radials. Drawn as
  // subtle ribbons so the scatter districts read as connected city, and
  // used as traffic paths so motorbikes flow along them.
  BOULEVARDS.forEach((boulevard) => {
    makeTube(boulevard.path, 0.055, materials.road, 0.028, Math.max(40, boulevard.path.length * 10));
    paths.push(boulevard.path.map(([lat, lng]) => project(lat, lng, ROAD_Y)));
  });

  // Mặt cầu có luồng xe riêng, chạy ở cao độ của mặt cầu chứ không phải mặt đất.
  BRIDGES.forEach((bridge) => {
    paths.push(bridge.deck.map(([lat, lng]) => project(lat, lng, 0.72)));
  });

  createBridgeDetails();
  return paths;
}

// Nhà chỉ được mọc trên đất khô của bờ hữu, không đè lên hồ, không đè lên
// công viên hay khuôn viên di tích. Ba phép loại này chạy cho từng ô lưới
// nên viết theo kiểu thoát sớm, kiểm tra rẻ trước, đắt sau.
function buildingAllowed(lat, lng) {
  // Phải đứng trên đất thật của một trong hai bờ. Bãi giữa cố ý không tính:
  // ngoài đời đó là đất bãi trồng chuối trồng rau, không có nhà.
  if (!pointInPoly(lat, lng, WEST_BANK) && !pointInPoly(lat, lng, EAST_BANK)) return false;
  if (LAKES.some((lake) => pointInPoly(lat, lng, lake))) return false;
  if (LAKE_FEATURES.some((f) => f.kind === "water" && inEllipse(lat, lng, f))) return false;
  if (PARKS.some((park) => pointInPoly(lat, lng, park))) return false;
  return true;
}

// Nướng sẵn dải tối chân tường vào một khối hộp đơn vị: đỉnh nào gần mặt
// đất thì màu đỉnh sẫm hơn. Màu này nhân với màu riêng của từng nhà, cho ra
// hiệu ứng bóng đổ góc phố miễn phí — không tốn gì mỗi khung hình, mà cả
// dãy phố lập tức có chân, thay vì trông như hộp dán lên nền.
function bakeBaseShade(geometry, floor = 0.78) {
  const pos = geometry.attributes.position;
  const shades = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    // Hộp đơn vị chạy từ y = -0.5 tới 0.5; chỉ 45% phía dưới bị tối dần.
    const t = Math.min(1, Math.max(0, (pos.getY(i) + 0.5) / 0.45));
    const shade = floor + (1 - floor) * t;
    shades[i * 3] = shade;
    shades[i * 3 + 1] = shade;
    shades[i * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(shades, 3));
  return geometry;
}

function createBuildings() {
  const random = seededRandom(43);
  const instances = [];

  // Nhà nằm BÊN TRONG các ô phố, bám đúng cái lưới mà mạng đường vẽ ra.
  // Chính việc dùng chung một lưới đó làm cảnh này đọc ra thành phố thật,
  // chứ không phải một đống hộp rải bừa.
  const { uVec, vVec, uLen, vLen, rot: gridRot } = GRID_METRICS;

  const filledCells = new Set();
  const blockPlates = []; // mỗi ô phố một tấm lát vỉa hè nhô lên

  // Chiều cao nhà bốc theo phân bố lệch: đa số thấp, thi thoảng mới có một
  // cái vọt lên. Dùng luỹ thừa thay vì random đều, vì random đều cho ra một
  // thành phố mà nhà nào cũng cao ngang nhau, nhìn giả ngay.
  const pickHeight = (district, tall, { bias, curve, ceiling }) => {
    const [base, top] = district.h;
    const span = top - base;
    // Nhà "cao" bốc trong khoảng trên của quận; nhà thường bị luỹ thừa kéo
    // xuống đáy và còn bị chặn trần, nên không bao giờ chạm nóc quận.
    return tall
      ? base + (bias + random() * (1 - bias)) * span
      : base + random() ** curve * span * ceiling;
  };
  const LOT_HEIGHT = { bias: 0.55, curve: 1.7, ceiling: 0.7 };
  const SCATTER_HEIGHT = { bias: 0.6, curve: 1.6, ceiling: 0.72 };

  // Nhà ống Hà Nội: phố cổ nhồi bốn năm lô gầy trên một ô, khu phố Pháp chỉ
  // hai ba lô rộng hơn. Cứ khoảng mười lô thì một lô để trống — sân, ngõ,
  // hoặc nhà đã đập chưa xây lại.
  const VACANT_ODDS = 0.09;

  DISTRICTS.filter((district) => !district.faded && !district.scatter).forEach((district) => {
    const [latMin, latMax, lngMin, lngMax] = district.bbox;
    for (let i = -34; i <= 26; i += 1) {
      for (let j = -18; j <= 18; j += 1) {
        const u = (i + 0.5) * CELL_U;
        const v = (j + 0.5) * CELL_V;
        const lat = GRID.origin.lat + GRID.av.dlat * u + GRID.st.dlat * v;
        const lng = GRID.origin.lng + GRID.av.dlng * u + GRID.st.dlng * v;
        if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) continue;

        // Hai quận có thể chồng hộp bao lên nhau; ô nào lấp rồi thì thôi,
        // không dựng đè lần hai.
        const cell = `${i}:${j}`;
        if (filledCells.has(cell)) continue;
        if (!buildingAllowed(lat, lng)) continue;
        filledCells.add(cell);

        const center = project(lat, lng);
        blockPlates.push({ x: center.x, z: center.z });

        const lots = district.slim ? 4 + (random() < 0.5 ? 1 : 0) : random() < 0.3 ? 3 : 2;
        for (let slot = 0; slot < lots; slot += 1) {
          if (random() < VACANT_ODDS) continue;
          const tall = random() < district.tall;
          // Chia đều mặt tiền cho từng lô dọc cạnh dài của ô phố, rồi xê
          // dịch chút theo chiều sâu cho hàng nhà không thẳng băng.
          const alongFront = (slot + 0.5) / lots - 0.5;
          const p = center
            .clone()
            .addScaledVector(vVec, alongFront * 0.8)
            .addScaledVector(uVec, (random() - 0.5) * 0.08);
          const grow = tall ? 1.12 : 1;
          instances.push({
            x: p.x,
            z: p.z,
            h: pickHeight(district, tall, LOT_HEIGHT),
            w: Math.min(vLen * 0.42, ((vLen * 0.78) / lots) * (0.68 + random() * 0.24) * grow),
            d: uLen * (0.5 + random() * 0.15) * grow,
            rot: gridRot,
            shade: random(),
            roof: random(),
            faded: false,
          });
        }
      }
    }
  });

  // Ra ngoài vùng có lưới phố thì rải nhà tự do: cùng một hướng phố, xê dịch
  // nhẹ, và không được chồng lên nhau. Bên kia sông cũng vậy nhưng dựng thành
  // khối mờ. `guard` chặn vòng lặp chạy mãi khi quận gần như hết chỗ trống.
  DISTRICTS.filter((district) => district.faded || district.scatter).forEach((district) => {
    const [latMin, latMax, lngMin, lngMax] = district.bbox;
    const taken = [];
    const clashes = (x, z, r) =>
      taken.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < ((q.r + r) * (q.r + r)) * 0.62);

    let placed = 0;
    for (let guard = 0; placed < district.count && guard < district.count * 16; guard += 1) {
      const lat = latMin + random() * (latMax - latMin);
      const lng = lngMin + random() * (lngMax - lngMin);
      if (!buildingAllowed(lat, lng)) continue;

      const p = project(lat, lng);
      const w = 0.3 + random() * 0.55;
      const d = 0.3 + random() * 0.6;
      const radius = Math.max(w, d) * 0.72;
      if (clashes(p.x, p.z, radius)) continue;
      taken.push({ x: p.x, z: p.z, r: radius });

      const tall = random() < (district.tall ?? 0);
      const grow = tall ? 1.15 : 1;
      instances.push({
        x: p.x,
        z: p.z,
        h: pickHeight(district, tall, SCATTER_HEIGHT),
        w: w * grow,
        d: d * grow,
        rot: gridRot + (district.rot ?? 0) + (random() - 0.5) * 0.1,
        shade: random(),
        roof: random(),
        faded: Boolean(district.faded),
      });
      placed += 1;
    }
  });

  // Nhà ở rìa bản đồ dựng thành khối "mờ": phẳng, nhạt, không cửa sổ không
  // mái. Mắt hiểu ngay đó là thành phố tiếp diễn ra xa chứ không phải chỗ
  // bản đồ hết, mà chi phí gần như bằng không.
  const fadedBoxes = instances.filter((b) => b.faded);
  const solidBoxes = instances.filter((b) => !b.faded);
  if (fadedBoxes.length) {
    // Nhân bản vật liệu chứ không dùng chung: các khối mốc kiến trúc cũng
    // xài materials.ghost nhưng với hình học không có thuộc tính màu đỉnh,
    // mà bật vertexColors lên hình học như thế thì nó ra đen sì.
    const ghostMaterial = materials.ghost.clone();
    ghostMaterial.vertexColors = true;
    const ghostMesh = new THREE.InstancedMesh(
      bakeBaseShade(new THREE.BoxGeometry(1, 1, 1), 0.88),
      ghostMaterial,
      fadedBoxes.length,
    );
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    fadedBoxes.forEach((box, i) => {
      pos.set(box.x, box.h / 2, box.z);
      quat.setFromAxisAngle(UP, box.rot);
      scale.set(box.w, box.h, box.d);
      matrix.compose(pos, quat, scale);
      ghostMesh.setMatrixAt(i, matrix);
    });
    ghostMesh.renderOrder = 1;
    scene.add(ghostMesh);
  }

  // Nhà "đặc" — phần thành phố dựng đủ chi tiết: màu tường, mái, cửa sổ,
  // đồ đạc trên sân thượng. Nhà "mờ" bên kia sông đã dựng xong ở trên.
  instances.length = 0;
  instances.push(...solidBoxes);

  const geometry = bakeBaseShade(new THREE.BoxGeometry(1, 1, 1));
  const buildingMaterial = materials.building.clone();
  buildingMaterial.vertexColors = true;
  const mesh = new THREE.InstancedMesh(geometry, buildingMaterial, instances.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  // Màu tường Hà Nội, xếp theo thời kỳ xây chứ không theo chiều cao:
  //   0–1 vàng thuộc địa, hai sắc đậm nhạt của các biệt thự thời Pháp
  //   2   vôi kem, màu mặc định của nhà ống xây thập niên 90
  //   3   bê tông bạc màu, khu tập thể
  //   4   kính tháp mới
  //   5   xanh bạc hà nhạt, cái màu sơn rất hay gặp ở nhà phố
  const WALL_TONES = [0xe8d79c, 0xdec98f, 0xe9e2cd, 0xb8bcb2, 0xa6b4bf, 0xcfd8c4].map(
    (hex) => new THREE.Color(hex),
  );
  // Mái nhìn từ trên cao mới là thứ làm Hà Nội ra Hà Nội: quá nửa thành phố
  // lợp tôn, và tôn ở đây có màu — xanh, đỏ, bạc — chứ không phải mái nhựa
  // đường xám như phố Mỹ. Ngói ta và ngói cũ lên rêu lo phần phố cổ.
  const ROOF_TONES = {
    tonXanh: new THREE.Color(0x3f6f73),
    tonDo: new THREE.Color(0x9c4b34),
    ngoiTa: new THREE.Color(0xa85a3c),
    ngoiReu: new THREE.Color(0x6b6a4e),
    tonBac: new THREE.Color(0xa9adaa),
    xiMang: new THREE.Color(0x8b8c88),
  };
  const LOW_ROOFS = [ROOF_TONES.tonXanh, ROOF_TONES.tonDo, ROOF_TONES.ngoiTa, ROOF_TONES.ngoiReu];
  const TALL_ROOFS = [ROOF_TONES.xiMang, ROOF_TONES.tonBac];

  const wallColor = new THREE.Color();
  const roofColor = new THREE.Color();

  const roofMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.roofColored, instances.length);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  let roofCount = 0;

  const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.window, instances.length * 22);
  windowMesh.castShadow = false;
  windowMesh.receiveShadow = true;
  let windowCount = 0;

  const storefrontMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.35, metalness: 0.08 }),
    instances.length,
  );
  storefrontMesh.castShadow = false;
  storefrontMesh.receiveShadow = true;
  let storefrontCount = 0;

  // Thu thập trong lượt chạy chính rồi mới dựng hàng loạt ở cuối: phần cơi
  // nới trên nóc, bồn nước inox, cục nóng điều hoà.
  const addOns = [];
  const tanks = [];
  const acUnits = [];
  const offset = new THREE.Vector3();

  const placeInstanced = (target, index, x, y, z, rot, sx, sy, sz) => {
    pos.set(x, y, z);
    quat.setFromAxisAngle(UP, rot);
    scale.set(sx, sy, sz);
    matrix.compose(pos, quat, scale);
    target.setMatrixAt(index, matrix);
  };

  // Dải cửa sổ chạy ngang một mặt tường. Gom lại vì bốn mặt chỉ khác nhau ở
  // hướng đẩy ra và kích thước, trước kia bốn khối lệnh gần như giống hệt.
  const addWindowBand = (box, y, dir, along, lift) => {
    const across = new THREE.Vector3(Math.sin(box.rot), 0, Math.cos(box.rot));
    const side = new THREE.Vector3(Math.cos(box.rot), 0, -Math.sin(box.rot));
    const axis = along === "w" ? across : side;
    pos.set(box.x, y + lift, box.z).addScaledVector(axis, dir * ((along === "w" ? box.d : box.w) / 2 + 0.018));
    quat.setFromAxisAngle(UP, box.rot);
    if (along === "w") scale.set(box.w * 0.72, 0.035, 0.02);
    else scale.set(0.02, 0.035, box.d * 0.7);
    matrix.compose(pos, quat, scale);
    windowMesh.setMatrixAt(windowCount, matrix);
    windowCount += 1;
  };

  instances.forEach((box, index) => {
    placeInstanced(mesh, index, box.x, box.h / 2, box.z, box.rot, box.w, box.h, box.d);

    // Nhà càng cao càng ngả về kính và bê tông lạnh; nhà thấp giữ vôi vàng
    // và tường bạc màu. Trộn thêm chút sáng tối theo từng nhà cho khỏi đều.
    let tone;
    if (box.h > 2.4) tone = WALL_TONES[box.shade < 0.5 ? 4 : 2];
    else if (box.h > 1.3) tone = WALL_TONES[[2, 4, 0, 5][Math.floor(box.shade * 4) % 4]];
    else tone = WALL_TONES[[0, 1, 3, 5][Math.floor(box.shade * 4) % 4]];
    wallColor.copy(tone).offsetHSL(0, 0, (box.shade - 0.5) * 0.06);
    mesh.setColorAt(index, wallColor);

    // Cơi nới trên nóc. Nhà ống Hà Nội hay đội thêm một cái tum lệch hẳn về
    // một bên — chỗ để thang, phơi đồ, nuôi chim — chứ không giật cấp cân
    // đối kiểu tháp Mỹ. Chỉ tháp thật cao mới thu vào đều bốn phía.
    const isTower = box.h > 3.4;
    const hasAddOn = box.roof > 0.35 && (isTower || (box.h > 1.9 && box.shade > 0.45));
    let topY = box.h;
    let topW = box.w;
    let topD = box.d;
    if (hasAddOn) {
      const shrink = isTower ? 0.62 : 0.55;
      const rise = isTower ? Math.min(1.6, box.h * 0.28) : 0.3 + box.roof * 0.26;
      // Tháp thu vào giữa; nhà ống đẩy tum lệch về phía sau.
      offset.set(0, 0, isTower ? 0 : box.d * (0.5 - shrink / 2) * 0.8).applyAxisAngle(UP, box.rot);
      addOns.push({
        x: box.x + offset.x,
        z: box.z + offset.z,
        rot: box.rot,
        w: box.w * shrink,
        d: box.d * shrink,
        y: box.h,
        h: rise,
        color: wallColor.clone().offsetHSL(0, 0, isTower ? 0.03 : -0.04),
      });
      topY = box.h + rise;
      topW = box.w * shrink;
      topD = box.d * shrink;
    }

    if (box.roof > 0.5 || box.h > 4.4) {
      // Nhà thấp lợp tôn màu hoặc ngói; nhà cao đổ mái bằng xi măng.
      const low = box.h < 2.4;
      const palette = low ? LOW_ROOFS : TALL_ROOFS;
      roofColor.copy(palette[Math.floor(box.roof * palette.length) % palette.length]);
      roofMesh.setColorAt(roofCount, roofColor);
      placeInstanced(
        roofMesh,
        roofCount,
        box.x + (hasAddOn && !isTower ? offset.x : 0),
        topY + 0.08,
        box.z + (hasAddOn && !isTower ? offset.z : 0),
        box.rot,
        topW * (0.46 + box.roof * 0.28),
        0.12,
        topD * (0.44 + box.roof * 0.26),
      );
      roofCount += 1;
    }

    // Bồn inox trên nóc nhà tầm trung, cục nóng điều hoà trên hầu hết mọi
    // nóc: hai thứ vặt vãnh này mới làm Hà Nội nhìn từ trên cao ra Hà Nội.
    if (!isTower && box.h > 1.05 && box.h <= 2.6 && box.roof > 0.58) {
      offset.set(box.w * 0.2, 0, box.d * 0.16).applyAxisAngle(UP, box.rot);
      tanks.push({ x: box.x + offset.x, z: box.z + offset.z, y: box.h, s: 0.8 + box.shade * 0.5 });
    }
    if (box.h > 0.85 && box.shade > 0.42) {
      offset.set(-box.w * 0.21, 0, box.d * 0.2).applyAxisAngle(UP, box.rot);
      acUnits.push({ x: box.x + offset.x, z: box.z + offset.z, y: topY, rot: box.rot });
      if (box.shade > 0.78 && !hasAddOn) {
        offset.set(box.w * 0.24, 0, -box.d * 0.18).applyAxisAngle(UP, box.rot);
        acUnits.push({ x: box.x + offset.x, z: box.z + offset.z, y: box.h, rot: box.rot + 0.5 });
      }
    }

    // Dải cửa sổ: nhà tầm trung hai mặt, nhà cao đủ bốn mặt.
    if (box.h > 1.7) {
      const floors = Math.min(5, Math.floor(box.h / 1.05));
      const allFaces = box.h > 2.2;
      for (let floor = 1; floor <= floors; floor += 1) {
        const y = Math.min(box.h - 0.35, floor * (box.h / (floors + 1)));
        addWindowBand(box, y, 1, "w", 0);
        addWindowBand(box, y, 1, "d", 0.1);
        if (allFaces) {
          addWindowBand(box, y, -1, "w", 0.05);
          addWindowBand(box, y, -1, "d", 0.15);
        }
      }
    }

    // Mặt kính tầng trệt phía quay ra đường lớn — hàng quán Hà Nội gần như
    // nhà nào cũng có, tầng một là chỗ buôn bán.
    if (box.h > 0.55 && box.shade > 0.25) {
      const across = new THREE.Vector3(Math.sin(box.rot), 0, Math.cos(box.rot));
      pos.set(box.x, 0.13, box.z).addScaledVector(across, box.d / 2 + 0.012);
      quat.setFromAxisAngle(UP, box.rot);
      scale.set(box.w * 0.78, 0.22, 0.02);
      matrix.compose(pos, quat, scale);
      storefrontMesh.setMatrixAt(storefrontCount, matrix);
      storefrontCount += 1;
    }
  });

  scene.add(mesh);
  for (const [target, count] of [
    [roofMesh, roofCount],
    [windowMesh, windowCount],
    [storefrontMesh, storefrontCount],
  ]) {
    target.count = count;
    scene.add(target);
  }

  // Giữ lại tâm các ô phố: người đi bộ đi vòng quanh mép chúng.
  sidewalkPlates.length = 0;
  sidewalkPlates.push(...blockPlates);

  // Ô phố lát vỉa hè, nhấc cao hơn mặt nhựa một chút để đường chính là các
  // khe giữa chúng. Khe dọc theo đại lộ rộng hơn khe ngang, như ngoài đời.
  if (blockPlates.length) {
    const plateMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.06, 1),
      new THREE.MeshStandardMaterial({ color: 0xd7d3c7, roughness: 0.9 }),
      blockPlates.length,
    );
    plateMesh.receiveShadow = true;
    const plateColor = new THREE.Color();
    blockPlates.forEach((plate, i) => {
      placeInstanced(plateMesh, i, plate.x, 0, plate.z, gridRot, vLen - 0.26, 1, uLen - 0.12);
      // Băm chỉ số ra một chút sáng tối, để dãy ô phố không đều tăm tắp.
      plateColor.setHSL(0.09, 0.06, 0.8 + (((i * 2654435761) % 100) / 100) * 0.05);
      plateMesh.setColorAt(i, plateColor);
    });
    scene.add(plateMesh);
  }

  if (addOns.length) {
    const addOnMesh = new THREE.InstancedMesh(geometry, buildingMaterial, addOns.length);
    addOnMesh.castShadow = true;
    addOnMesh.receiveShadow = true;
    addOns.forEach((part, i) => {
      placeInstanced(addOnMesh, i, part.x, part.y + part.h / 2, part.z, part.rot, part.w, part.h, part.d);
      addOnMesh.setColorAt(i, part.color);
    });
    scene.add(addOnMesh);
  }

  if (tanks.length) {
    // Bồn inox: cái trống thép nằm trên nóc cứ hai nhà thì một.
    const barrel = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.15, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9cfd4, roughness: 0.35, metalness: 0.55 }),
      tanks.length,
    );
    const lid = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.062, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xb8bfc5, roughness: 0.4, metalness: 0.5 }),
      tanks.length,
    );
    barrel.castShadow = true;
    lid.castShadow = true;
    tanks.forEach((tank, i) => {
      placeInstanced(barrel, i, tank.x, tank.y + 0.075 * tank.s, tank.z, 0, tank.s, tank.s, tank.s);
      placeInstanced(lid, i, tank.x, tank.y + 0.15 * tank.s, tank.z, 0, tank.s, tank.s, tank.s);
    });
    scene.add(barrel);
    scene.add(lid);
  }

  if (acUnits.length) {
    const acMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.095, 0.05, 0.075),
      new THREE.MeshStandardMaterial({ color: 0xc3c8ce, roughness: 0.7 }),
      acUnits.length,
    );
    acUnits.forEach((unit, i) => {
      placeInstanced(acMesh, i, unit.x, unit.y + 0.025, unit.z, unit.rot, 1, 1, 1);
    });
    scene.add(acMesh);
  }
}

// Xếp chồng các tầng khối để thành một toà tháp thu dần. Trả về cao độ đỉnh
// để chỗ gọi còn biết đặt chóp, ăng-ten hay nhãn tên lên đâu.
function stackTower(lat, lng, levels, material, rotation = 0) {
  const p = project(lat, lng);
  let y = 0;
  levels.forEach((lvl) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(lvl.w, lvl.h, lvl.d), lvl.material || material);
    box.position.set(p.x, y + lvl.h / 2, p.z);
    box.rotation.y = rotation;
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    y += lvl.h;
  });
  return { p, top: y };
}

// Hanoi accent materials.
// Landmark towers need deeper glass than the shared material, or they wash
// out against the fog when seen from across the city.
const towerGlass = new THREE.MeshStandardMaterial({
  color: 0x4f7d9c,
  roughness: 0.24,
  metalness: 0.3,
  emissive: new THREE.Color(0x0d1e2a),
});
const templeRed = new THREE.MeshStandardMaterial({ color: 0xa8352a, roughness: 0.55 });
const templeRedBright = new THREE.MeshStandardMaterial({
  color: 0xc4382b,
  roughness: 0.4,
  emissive: new THREE.Color(0x380d08),
});
const lacquerYellow = new THREE.MeshStandardMaterial({ color: 0xd9b358, roughness: 0.5 });
const graniteDark = new THREE.MeshStandardMaterial({ color: 0x5c6058, roughness: 0.62 });
const brickAncient = new THREE.MeshStandardMaterial({ color: 0x9b5a41, roughness: 0.78 });

// A little Vietnamese temple/pagoda block: walls + oversailing tiled roof.
function addTempleBlock(x, z, w, d, wallH, material, roofMaterial, rotation = 0, y = 0) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), material);
  wall.position.y = y + wallH / 2;
  wall.castShadow = true;
  group.add(wall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.001, Math.max(w, d) * 0.78, wallH * 0.55, 4), roofMaterial);
  roof.position.y = y + wallH + wallH * 0.27;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  roof.castShadow = true;
  group.add(roof);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
  return group;
}

function createLandmarks() {
  const stone = materials.landmark;
  const glass = materials.glass;

  // --- Tháp Rùa: tiny islet + the Turtle Tower, alone in Hồ Gươm ---
  {
    const tp = project(LANDMARKS.thapRua.lat, LANDMARKS.thapRua.lng);
    const islet = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 12), materials.park);
    islet.position.set(tp.x, 0.0, tp.z);
    scene.add(islet);
    let ty = 0.05;
    const tiers = [
      { w: 0.16, h: 0.11, d: 0.2 },
      { w: 0.125, h: 0.1, d: 0.16 },
      { w: 0.09, h: 0.09, d: 0.12 },
    ];
    tiers.forEach((tier) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(tier.w, tier.h, tier.d), brickAncient);
      box.position.set(tp.x, ty + tier.h / 2, tp.z);
      box.castShadow = true;
      scene.add(box);
      ty += tier.h + 0.012;
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.075, 0.06, 4), templeRed);
    cap.position.set(tp.x, ty + 0.03, tp.z);
    cap.rotation.y = Math.PI / 4;
    scene.add(cap);
  }

  // --- Đền Ngọc Sơn + cầu Thê Húc: island temple and the scarlet bridge ---
  {
    const np = project(LANDMARKS.ngocSon.lat, LANDMARKS.ngocSon.lng);
    const islet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 12), materials.park);
    islet.position.set(np.x, 0.0, np.z);
    scene.add(islet);
    addTempleBlock(np.x, np.z, 0.26, 0.2, 0.14, materials.landmark, templeRed, 0.2, 0.05);
    // Thê Húc: an arched crimson footbridge back to the shore.
    const sp = project(LANDMARKS.theHucShore.lat, LANDMARKS.theHucShore.lng, 0.06);
    const mid = new THREE.Vector3((np.x + sp.x) / 2, 0.24, (np.z + sp.z) / 2);
    makeCurveTube([new THREE.Vector3(np.x, 0.08, np.z), mid, sp], 0.028, templeRedBright, 24);
  }

  // --- Nhà hát Lớn: colonial opera house with a copper dome ---
  {
    createBlockAt(LANDMARKS.operaHouse.lat, LANDMARKS.operaHouse.lng, 0.5, 0.36, 0.3, stone, 0.14);
    const op = project(LANDMARKS.operaHouse.lat, LANDMARKS.operaHouse.lng);
    const portico = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.1), lacquerYellow);
    portico.position.set(op.x, 0.12, op.z + 0.2);
    portico.rotation.y = 0.14;
    portico.castShadow = true;
    scene.add(portico);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), materials.copper);
    dome.scale.set(1.5, 0.85, 1);
    dome.position.set(op.x, 0.3, op.z - 0.04);
    dome.rotation.y = 0.14;
    dome.castShadow = true;
    scene.add(dome);
  }

  // --- Nhà thờ Lớn: neo-Gothic cathedral, twin dark towers ---
  {
    const cp = project(LANDMARKS.stJoseph.lat, LANDMARKS.stJoseph.lng);
    const nave = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.4), graniteDark);
    nave.position.set(cp.x, 0.13, cp.z);
    nave.rotation.y = 0.1;
    nave.castShadow = true;
    scene.add(nave);
    for (const off of [-0.09, 0.09]) {
      const anchor = new THREE.Vector3(off, 0, 0.17).applyAxisAngle(UP, 0.1);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), graniteDark);
      tower.position.set(cp.x + anchor.x, 0.25, cp.z + anchor.z);
      tower.castShadow = true;
      scene.add(tower);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.055, 0.1, 4), graniteDark);
      spire.position.set(cp.x + anchor.x, 0.55, cp.z + anchor.z);
      scene.add(spire);
    }
  }

  // --- Cột cờ Hà Nội: three-tier base + octagonal flag tower ---
  {
    const fp = project(LANDMARKS.flagTower.lat, LANDMARKS.flagTower.lng);
    let fy = 0;
    for (const [w, h] of [
      [0.42, 0.08],
      [0.32, 0.08],
      [0.22, 0.1],
    ]) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), brickAncient);
      tier.position.set(fp.x, fy + h / 2, fp.z);
      tier.castShadow = true;
      scene.add(tier);
      fy += h;
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.42, 8), brickAncient);
    shaft.position.set(fp.x, fy + 0.21, fp.z);
    shaft.castShadow = true;
    scene.add(shaft);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), materials.rail);
    pole.position.set(fp.x, fy + 0.42 + 0.1, fp.z);
    scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xd21f24, side: THREE.DoubleSide, emissive: new THREE.Color(0x3a0000) }),
    );
    flag.position.set(fp.x + 0.08, fy + 0.48, fp.z);
    scene.add(flag);
  }

  // --- Lăng Chủ tịch Hồ Chí Minh: stepped granite mausoleum + colonnade ---
  {
    const mp = project(LANDMARKS.mausoleum.lat, LANDMARKS.mausoleum.lng);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.52), graniteDark);
    plinth.position.set(mp.x, 0.05, mp.z);
    plinth.receiveShadow = true;
    scene.add(plinth);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), graniteDark);
    hall.position.set(mp.x, 0.2, mp.z);
    hall.castShadow = true;
    scene.add(hall);
    // Colonnade: a lighter band of columns around the hall.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), stone);
    band.position.set(mp.x, 0.37, mp.z);
    band.castShadow = true;
    scene.add(band);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), graniteDark);
    roof.position.set(mp.x, 0.47, mp.z);
    roof.castShadow = true;
    scene.add(roof);
  }

  // --- Chùa Một Cột: the lotus pagoda on its single pillar ---
  {
    const op = project(LANDMARKS.onePillar.lat, LANDMARKS.onePillar.lng);
    const pond = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.22), materials.pond);
    pond.position.set(op.x, 0.03, op.z);
    scene.add(pond);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 8), brickAncient);
    pillar.position.set(op.x, 0.1, op.z);
    scene.add(pillar);
    addTempleBlock(op.x, op.z, 0.1, 0.1, 0.06, templeRed, templeRed, 0, 0.16);
  }

  // --- Hoàng thành Thăng Long: Đoan Môn gate + Kính Thiên platform ---
  {
    const hp = project(LANDMARKS.citadel.lat, LANDMARKS.citadel.lng);
    // Đoan Môn: long wall with a central watch pavilion.
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.12), brickAncient);
    gate.position.set(hp.x, 0.07, hp.z + 0.16);
    gate.castShadow = true;
    scene.add(gate);
    addTempleBlock(hp.x, hp.z + 0.16, 0.16, 0.1, 0.09, lacquerYellow, templeRed, 0, 0.14);
    // Kính Thiên: raised platform behind.
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), stone);
    platform.position.set(hp.x, 0.04, hp.z - 0.12);
    scene.add(platform);
    addTempleBlock(hp.x, hp.z - 0.12, 0.22, 0.14, 0.1, lacquerYellow, templeRed, 0, 0.08);
  }

  // --- Nhà Quốc hội: glass cube with the round debating chamber ---
  {
    const pp = project(LANDMARKS.parliament.lat, LANDMARKS.parliament.lng);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), glass);
    cube.position.set(pp.x, 0.12, pp.z);
    cube.castShadow = true;
    scene.add(cube);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 18), stone);
    drum.position.set(pp.x, 0.14, pp.z);
    scene.add(drum);
  }

  // --- Văn Miếu: walled compound + Khuê Văn Các pavilion ---
  {
    const vp = project(LANDMARKS.vanMieu.lat, LANDMARKS.vanMieu.lng);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.44), brickAncient);
    wall.position.set(vp.x, 0.055, vp.z);
    wall.receiveShadow = true;
    scene.add(wall);
    // Khuê Văn Các: two-storey pavilion on four brick pillars.
    const kv = { x: vp.x, z: vp.z + 0.1 };
    for (const [dx, dz] of [
      [-0.03, -0.03],
      [0.03, -0.03],
      [-0.03, 0.03],
      [0.03, 0.03],
    ]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), brickAncient);
      pillar.position.set(kv.x + dx, 0.12, kv.z + dz);
      scene.add(pillar);
    }
    addTempleBlock(kv.x, kv.z, 0.09, 0.09, 0.06, templeRed, templeRed, 0, 0.16);
    // Main sanctuary at the compound's north end.
    addTempleBlock(vp.x, vp.z - 0.14, 0.2, 0.1, 0.08, lacquerYellow, templeRed, 0, 0.08);
  }

  // --- Chùa Trấn Quốc: the red 11-tier stupa on its West Lake islet ---
  {
    const tq = project(LANDMARKS.tranQuoc.lat, LANDMARKS.tranQuoc.lng);
    const islet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 12), materials.park);
    islet.position.set(tq.x, 0.0, tq.z);
    scene.add(islet);
    let sy = 0.06;
    for (let i = 0; i < 8; i += 1) {
      const r = 0.085 - i * 0.009;
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 0.075, 8), templeRedBright);
      tier.position.set(tq.x, sy + 0.037, tq.z);
      tier.castShadow = true;
      scene.add(tier);
      sy += 0.082;
    }
    const lotus = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), lacquerYellow);
    lotus.position.set(tq.x, sy + 0.04, tq.z);
    scene.add(lotus);
    addTempleBlock(tq.x + 0.14, tq.z + 0.05, 0.12, 0.09, 0.07, lacquerYellow, templeRed, -0.5, 0.06);
  }

  // --- Phủ Tây Hồ on the Quảng An peninsula ---
  {
    const pt = project(LANDMARKS.phuTayHo.lat, LANDMARKS.phuTayHo.lng);
    addTempleBlock(pt.x, pt.z, 0.18, 0.12, 0.09, lacquerYellow, templeRed, -0.55, 0.02);
    addTempleBlock(pt.x + 0.1, pt.z + 0.08, 0.1, 0.08, 0.07, templeRed, templeRed, -0.55, 0.02);
  }

  // --- Chợ Đồng Xuân: triple-vaulted market hall ---
  {
    const dx = project(LANDMARKS.dongXuan.lat, LANDMARKS.dongXuan.lng);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.3), stone);
    hall.position.set(dx.x, 0.07, dx.z);
    hall.rotation.y = 0.1;
    hall.castShadow = true;
    scene.add(hall);
    for (const off of [-0.11, 0, 0.11]) {
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 10, 1, false, 0, Math.PI), stone);
      const anchor = new THREE.Vector3(off, 0, 0).applyAxisAngle(UP, 0.1);
      vault.position.set(dx.x + anchor.x, 0.14, dx.z + anchor.z);
      vault.rotation.z = Math.PI / 2;
      vault.rotation.y = 0.1;
      vault.castShadow = true;
      scene.add(vault);
    }
  }

  // --- Ô Quan Chưởng: the last old city gate ---
  {
    const oq = project(LANDMARKS.oQuanChuong.lat, LANDMARKS.oQuanChuong.lng);
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.08), brickAncient);
    gate.position.set(oq.x, 0.05, oq.z);
    gate.castShadow = true;
    scene.add(gate);
    addTempleBlock(oq.x, oq.z, 0.08, 0.06, 0.05, brickAncient, templeRed, 0, 0.1);
  }

  // --- Ga Hà Nội: the old station hall ---
  createBlockAt(LANDMARKS.gaHaNoi.lat, LANDMARKS.gaHaNoi.lng, 0.34, 0.16, 0.22, lacquerYellow, 0.14);

  // --- Hỏa Lò: low dark walls ---
  createBlockAt(LANDMARKS.hoaLo.lat, LANDMARKS.hoaLo.lng, 0.22, 0.18, 0.12, brickAncient, 0.14);

  // --- Keangnam Landmark 72 + its two residential towers ---
  {
    const kp = project(LANDMARKS.keangnam.lat, LANDMARKS.keangnam.lng);
    const main = new THREE.Mesh(new THREE.BoxGeometry(0.62, 3.6, 0.5), towerGlass);
    main.position.set(kp.x, 1.8, kp.z);
    main.rotation.y = 0.05;
    main.castShadow = true;
    scene.add(main);
    for (const [dx, dz] of [
      [0.55, 0.35],
      [-0.5, 0.42],
    ]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.9, 0.3), materials.building);
      tower.position.set(kp.x + dx, 0.95, kp.z + dz);
      tower.rotation.y = 0.05;
      tower.castShadow = true;
      scene.add(tower);
    }
  }

  // --- Lotte Center: tapered slab with the sliced notch ---
  {
    const lp = project(LANDMARKS.lotte.lat, LANDMARKS.lotte.lng);
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.9, 4), towerGlass);
    slab.position.set(lp.x, 1.45, lp.z);
    slab.rotation.y = Math.PI / 4 + 0.08;
    slab.scale.set(1.25, 1, 0.72);
    slab.castShadow = true;
    scene.add(slab);
  }

  // --- Vinhomes Metropolis: three matching towers ---
  {
    const vp = project(LANDMARKS.metropolis.lat, LANDMARKS.metropolis.lng);
    for (const [dx, dz] of [
      [-0.3, 0.1],
      [0.05, -0.12],
      [0.4, 0.08],
    ]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.7, 0.22), towerGlass);
      tower.position.set(vp.x + dx, 0.85, vp.z + dz);
      tower.rotation.y = -0.08;
      tower.castShadow = true;
      scene.add(tower);
    }
  }

  // --- Vinhomes Times City: a phalanx of cream towers on a podium ---
  {
    const tp = project(LANDMARKS.timesCity.lat, LANDMARKS.timesCity.lng);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.2), stone);
    podium.position.set(tp.x, 0.07, tp.z);
    podium.receiveShadow = true;
    scene.add(podium);
    const rand = seededRandom(52);
    for (let gx = 0; gx < 4; gx += 1) {
      for (let gz = 0; gz < 3; gz += 1) {
        const h = 1.15 + rand() * 0.3;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.18), materials.building);
        tower.position.set(tp.x - 0.6 + gx * 0.4, h / 2 + 0.14, tp.z - 0.4 + gz * 0.4);
        tower.rotation.y = 0.1;
        tower.castShadow = true;
        scene.add(tower);
      }
    }
  }

  // --- Vinhomes Royal City: European-style crescent of towers ---
  {
    const rp = project(LANDMARKS.royalCity.lat, LANDMARKS.royalCity.lng);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.9), stone);
    podium.position.set(rp.x, 0.06, rp.z);
    podium.receiveShadow = true;
    scene.add(podium);
    for (let i = 0; i < 5; i += 1) {
      const angle = -0.5 + i * 0.25;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.2), materials.building);
      tower.position.set(rp.x - 0.55 + i * 0.28, 0.79, rp.z + Math.sin(angle) * 0.22);
      tower.rotation.y = angle * 0.4;
      tower.castShadow = true;
      scene.add(tower);
    }
  }

  // --- SVĐ Mỹ Đình: elliptical bowl with two white roof crescents ---
  {
    const sp = project(LANDMARKS.myDinhStadium.lat, LANDMARKS.myDinhStadium.lng);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.16, 24), stone);
    bowl.scale.set(1.3, 1, 0.9);
    bowl.position.set(sp.x, 0.08, sp.z);
    bowl.castShadow = true;
    scene.add(bowl);
    const pitch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.17, 24), materials.park);
    pitch.scale.set(1.25, 1, 0.85);
    pitch.position.set(sp.x, 0.085, sp.z);
    scene.add(pitch);
    for (const side of [-0.42, 0.42]) {
      const roof = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 20, Math.PI * 0.8), materials.ferry);
      roof.position.set(sp.x, 0.3, sp.z + side);
      roof.rotation.x = side > 0 ? -0.5 : 0.5 + Math.PI;
      roof.castShadow = true;
      scene.add(roof);
    }
  }

  // --- Bảo tàng Hà Nội: the inverted pyramid ---
  {
    const bp = project(LANDMARKS.hanoiMuseum.lat, LANDMARKS.hanoiMuseum.lng);
    let by = 0.08;
    for (let i = 0; i < 4; i += 1) {
      const w = 0.16 + i * 0.09;
      const layer = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, w), i === 3 ? glass : stone);
      layer.position.set(bp.x, by + 0.045, bp.z);
      layer.rotation.y = 0.2;
      layer.castShadow = true;
      scene.add(layer);
      by += 0.09;
    }
  }

  // --- Hotels & malls with recognizable massing ---
  createBlockAt(LANDMARKS.westLakeIntercon.lat, LANDMARKS.westLakeIntercon.lng, 0.3, 0.14, 0.2, stone, -0.5);
  createBlockAt(LANDMARKS.aeonLongBien.lat, LANDMARKS.aeonLongBien.lng, 0.6, 0.4, 0.18, materials.ghost, 0.1);
  createBlockAt(LANDMARKS.lotteMallTayHo.lat, LANDMARKS.lotteMallTayHo.lng, 0.44, 0.34, 0.22, stone, -0.2);
  addLandmarkLabel("Hồ Tây", 21.0575, 105.818, 0.8);
  addLandmarkLabel("Bãi giữa", 21.0405, 105.8665, 0.7);
  addLandmarkLabel("Cầu Nhật Tân", 21.0845, 105.832, 2.4);
  addLandmarkLabel("Sông Hồng", 21.02, 105.869, 0.6);
}

// Gắn dữ liệu địa điểm vào mọi mặt lưới con, để bấm trúng bất kỳ phần nào
// của cái pin cũng ra đúng địa điểm ấy.
function tagPart(mesh, item, extra) {
  mesh.userData.item = item;
  if (extra) Object.assign(mesh.userData, extra);
  return mesh;
}

function createMarker(item) {
  const color = stageColor(item.stage);
  const body = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.36,
    emissive: color.clone().multiplyScalar(0.12),
  });

  const group = new THREE.Group();
  const p = project(item.lat, item.lng);
  group.position.set(p.x, 0.18, p.z);
  group.userData.item = item;

  // Cây kim: cột mảnh, đầu tròn, vòng sáng dưới chân cho biết nó cắm ở đâu
  // khi nhìn chếch từ trên xuống.
  const stem = tagPart(
    new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.05, 10), body),
    item,
  );
  stem.position.y = 0.52;
  stem.castShadow = true;

  const head = tagPart(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), body), item);
  head.position.y = 1.12;
  head.castShadow = true;

  const halo = tagPart(
    new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
      }),
    ),
    item,
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.08;

  // Quả cầu trong suốt bọc ngoài, chỉ để bắt chuột: cột pin quá mảnh, không
  // có nó thì trên điện thoại gần như không bấm trúng.
  const hitArea = tagPart(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    ),
    item,
    { hitArea: true },
  );
  hitArea.position.y = 1.05;

  const parts = [stem, head, halo, hitArea];
  parts.forEach((part) => group.add(part));
  scene.add(group);
  markerMeshes.push(...parts);
  startupMarkers.set(item.id, { group, item, halo });
}

// Điểm nền: khách sạn, trường, chợ. Cố tình để màu nhạt và trầm hơn ba nhóm
// chính, để mắt vẫn phân biệt được đâu là địa điểm của bản đồ, đâu là mốc
// định hướng cho dễ hình dung.
const CONTEXT_STYLE = {
  "Khách sạn": { color: 0xc79a3e, shape: "octa" },
  "Đại học": { color: 0xb5644f, shape: "box" },
  "Chợ & TTTM": { color: 0x6f9d78, shape: "box" },
};
const CONTEXT_FALLBACK = { color: 0xb2bcc2, shape: "box" };

function createContextMarker(item) {
  const style = CONTEXT_STYLE[item.category] || CONTEXT_FALLBACK;
  const marker = new THREE.Mesh(
    style.shape === "octa" ? new THREE.OctahedronGeometry(0.56) : new THREE.BoxGeometry(0.82, 0.82, 0.82),
    new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 0.48,
      emissive: new THREE.Color(style.color).multiplyScalar(0.06),
    }),
  );
  const p = project(item.lat, item.lng);
  marker.position.set(p.x, 0.72, p.z);
  marker.castShadow = true;
  marker.userData.context = item;
  scene.add(marker);
}

function createMarkers() {
  STARTUPS.forEach(createMarker);
  CONTEXT_POINTS.forEach(createContextMarker);
}

/* ---------------------------------------------------------------- */
/* Hiệu ứng lúc chọn một địa điểm: cột sáng, vòng lan, siết ống kính  */
/* ---------------------------------------------------------------- */

const FOG_BASE = scene.fog.density;
const FOG_FOCUS = FOG_BASE * 1.38;
const FOV_BASE = camera.fov;
const FOV_FOCUS = FOV_BASE - 3;
const FOCUS_COLOR = 0x18a184;
let fogTarget = FOG_BASE;
let fovTarget = FOV_BASE;
let focusFx = null;

// Vân dọc cho cột sáng: đặc ở chân, tan dần lên đỉnh. Rộng 4px là đủ vì
// nó chỉ bị kéo giãn ngang quanh thân trụ.
function makeBeamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const fade = ctx.createLinearGradient(0, 128, 0, 0);
  fade.addColorStop(0, "rgba(255,255,255,0.85)");
  fade.addColorStop(0.55, "rgba(255,255,255,0.26)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
}

const glowMaterial = (extra) =>
  new THREE.MeshBasicMaterial({
    color: FOCUS_COLOR,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    ...extra,
  });

function ensureFocusFx() {
  if (focusFx) return focusFx;
  const group = new THREE.Group();
  group.visible = false;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.4, 7.5, 20, 1, true),
    glowMaterial({ map: makeBeamTexture(), opacity: 0.5 }),
  );
  beam.position.y = 3.75;
  group.add(beam);

  // Hai vòng loang dưới đất, lệch pha nửa nhịp, để nhịp đập liền mạch chứ
  // không có quãng nghỉ giữa hai lần lan.
  const rings = [0, 0.5].map((phase) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 40), glowMaterial({ opacity: 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.userData.phase = phase;
    group.add(ring);
    return ring;
  });

  scene.add(group);
  focusFx = { group, beam, rings };
  return focusFx;
}

function engageFocus(startup) {
  const fx = ensureFocusFx();
  const p = project(startup.lat, startup.lng);
  fx.group.position.set(p.x, 0.05, p.z);
  fx.group.visible = true;
  fogTarget = FOG_FOCUS;
  fovTarget = FOV_FOCUS;
}

function releaseFocus() {
  if (focusFx) focusFx.group.visible = false;
  fogTarget = FOG_BASE;
  fovTarget = FOV_BASE;
}

function updateFocusFx(elapsed, delta) {
  // Sương và góc ống kính bò dần về đích, cho ra cú đẩy máy mềm chứ không
  // giật. Ngưỡng 0.0004 tránh gọi updateProjectionMatrix mỗi khung hình khi
  // đã gần như đứng yên.
  scene.fog.density += (fogTarget - scene.fog.density) * Math.min(1, delta * 2.6);
  const fovStep = (fovTarget - camera.fov) * Math.min(1, delta * 3);
  if (Math.abs(fovStep) > 0.0004) {
    camera.fov += fovStep;
    camera.updateProjectionMatrix();
  }

  if (!focusFx || !focusFx.group.visible) return;
  focusFx.beam.material.opacity = 0.42 + Math.sin(elapsed * 2.1) * 0.1;
  focusFx.beam.rotation.y = elapsed * 0.4;
  for (const ring of focusFx.rings) {
    const t = (elapsed * 0.62 + ring.userData.phase) % 1;
    ring.scale.setScalar(1 + t * 2.3);
    // Mờ theo bình phương để vòng tan nhanh ở cuối, giống sóng nước lan ra.
    ring.material.opacity = 0.5 * (1 - t) ** 2;
  }
}

/* ---------------------------------------------------------------- */
/* Xe cộ                                                             */
/* ---------------------------------------------------------------- */

function createCarMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.02 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ec6d4,
    roughness: 0.18,
    metalness: 0.04,
    transparent: true,
    opacity: 0.88,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.72 });
  const lamp = (base, tint, strength) =>
    new THREE.MeshStandardMaterial({
      color: base,
      emissive: new THREE.Color(tint).multiplyScalar(strength),
      roughness: 0.34,
    });

  // Thân xe: ba khối chồng lên nhau — sàn, mui trước, ca-bin kính.
  for (const [w, h, d, y, z, material] of [
    [0.44, 0.18, 0.72, 0.16, 0, paint],
    [0.38, 0.1, 0.24, 0.22, 0.24, paint],
    [0.31, 0.18, 0.34, 0.32, -0.05, glass],
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.set(0, y, z);
    part.castShadow = true;
    group.add(part);
  }

  const wheel = new THREE.CylinderGeometry(0.08, 0.08, 0.075, 14);
  wheel.rotateZ(Math.PI / 2);
  for (const x of [-0.26, 0.26]) {
    for (const z of [-0.24, 0.24]) {
      const tyre = new THREE.Mesh(wheel, rubber);
      tyre.position.set(x, 0.08, z);
      tyre.castShadow = true;
      group.add(tyre);
    }
  }

  const lampGeometry = new THREE.BoxGeometry(0.08, 0.045, 0.025);
  const headMaterial = lamp(0xfff4c8, 0xffd56f, 0.45);
  const tailMaterial = lamp(0xe13c36, 0xe13c36, 0.25);
  for (const x of [-0.12, 0.12]) {
    for (const [z, material] of [[0.374, headMaterial], [-0.374, tailMaterial]]) {
      const light = new THREE.Mesh(lampGeometry, material);
      light.position.set(x, 0.17, z);
      group.add(light);
    }
  }

  group.scale.setScalar(0.92);
  return group;
}

// Xe máy: the soul of Hanoi traffic. A scooter body, a rider, a helmet.
function createBikeMesh(bodyColor, helmetColor = 0xf4f1e8) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.08 });
  const riderMaterial = new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.7 });
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.35 });
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.72 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.42), bodyMaterial);
  deck.position.y = 0.11;
  deck.castShadow = true;
  group.add(deck);

  const front = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.07), bodyMaterial);
  front.position.set(0, 0.19, 0.17);
  group.add(front);

  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.1), riderMaterial);
  rider.position.set(0, 0.24, -0.06);
  rider.castShadow = true;
  group.add(rider);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), helmetMaterial);
  helmet.position.set(0, 0.35, -0.06);
  group.add(helmet);

  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.045, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const z of [-0.17, 0.19]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
    wheel.position.set(0, 0.055, z);
    group.add(wheel);
  }
  return group;
}

// Xe buýt Hà Nội: thân vàng kem, dải đỏ chạy dọc — bộ nhận diện của
// Transerco, nhìn thoáng qua là biết ngay xe buýt chứ không phải xe tải.
function createBusMesh() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xf0dfa6, roughness: 0.5 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xc03a2e, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ec6d4,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88,
  });

  for (const [w, h, d, y, material, shadow] of [
    [0.42, 0.32, 1.5, 0.26, paint, true],
    [0.43, 0.07, 1.5, 0.18, stripe, false],
    [0.43, 0.09, 1.3, 0.34, glass, false],
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.y = y;
    part.castShadow = shadow;
    group.add(part);
  }
  addWheels(group, [-0.22, 0.22], [-0.52, 0.52]);
  return group;
}

function createTruckMesh(color) {
  const group = new THREE.Group();
  const cabPaint = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const boxPaint = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.6 });

  for (const [w, h, d, y, z, material] of [
    [0.4, 0.26, 0.34, 0.21, 0.5, cabPaint],
    [0.44, 0.4, 0.86, 0.28, -0.12, boxPaint],
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.set(0, y, z);
    part.castShadow = true;
    group.add(part);
  }
  addWheels(group, [-0.22, 0.22], [-0.4, 0.48]);
  return group;
}

// Bốn bánh đặt ở bốn góc. Hình trụ xoay 90° quanh trục Z để nằm ngang.
function addWheels(group, xs, zs) {
  const geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.075, 12);
  geometry.rotateZ(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.72 });
  for (const x of xs) {
    for (const z of zs) {
      const wheel = new THREE.Mesh(geometry, rubber);
      wheel.position.set(x, 0.08, z);
      group.add(wheel);
    }
  }
}

function pathWorldLength(path) {
  let length = 0;
  for (let i = 1; i < path.length; i += 1) length += path[i].distanceTo(path[i - 1]);
  return length;
}

/* ---------- Đổ xe ra đường ---------- */

// Giao thông Hà Nội là một dòng xe máy, ô tô bơi lẫn trong đó. Tỉ lệ dưới
// đây cố ý cho xe máy áp đảo: cứ ba xe thì hai là xe máy, thi thoảng mới
// chen một cái buýt hoặc xe tải.
const TRAFFIC_MIX = { bus: 13, truck: 17, car: 3 };
const CAR_COLORS = [0x2fb8ac, 0xf4f1e8, 0x3c414b, 0x2fb8ac, 0xe54c42, 0x2e6cff, 0xf4f1e8, 0x30b37c, 0x2fb8ac, 0xd7b96a];
const BIKE_COLORS = [0x30343c, 0x00b14f, 0xc03a2e, 0x2e6cff, 0x00b14f, 0x6b7280, 0xd7b96a, 0x00b14f, 0x8c3f5d, 0x394856];
const HELMET_COLORS = [0xf4f1e8, 0x2e343c, 0xd21f24, 0x2e6cff, 0xf7b500];
const TRUCK_COLORS = [0x8a4b3a, 0x3c5a48, 0x39424e];
const TRAFFIC_CAP = 132;

function kindOf(index) {
  if (index % TRAFFIC_MIX.bus === 6) return "bus";
  if (index % TRAFFIC_MIX.truck === 9) return "truck";
  return index % TRAFFIC_MIX.car === 0 ? "car" : "bike";
}

function buildVehicleMesh(kind, index) {
  const pick = (list) => list[index % list.length];
  if (kind === "bus") return createBusMesh();
  if (kind === "truck") return createTruckMesh(pick(TRUCK_COLORS));
  if (kind === "car") return createCarMesh(pick(CAR_COLORS));
  return createBikeMesh(pick(BIKE_COLORS), pick(HELMET_COLORS));
}

function createVehicles(roadPaths) {
  const random = seededRandom(700);
  let built = 0;
  for (const path of roadPaths) {
    const length = pathWorldLength(path);
    // Đại lộ dài thì nhiều xe hơn mặt cầu ngắn, chia theo chiều dài thật.
    const count = Math.max(1, Math.round(length / 11));
    for (let i = 0; i < count && built < TRAFFIC_CAP; i += 1) {
      const kind = kindOf(built);
      const mesh = buildVehicleMesh(kind, built);
      // Thu nhỏ cho xe lọt vừa khe đường giữa các ô phố.
      mesh.scale.setScalar(kind === "car" ? 0.55 : kind === "bike" ? 0.62 : 0.58);
      scene.add(mesh);
      vehicleFleet.push({
        mesh,
        path,
        t: random(),
        // Chia cho chiều dài đường để tốc độ ngoài đời như nhau ở mọi tuyến,
        // bất kể tuyến dài hay ngắn. Xe máy lách nhanh hơn ô tô một chút.
        speed: ((kind === "bike" ? 0.78 : 0.6) + random() * 0.5) / Math.max(4, length),
        lane: (random() - 0.5) * (kind === "bike" ? 0.14 : 0.08),
      });
      built += 1;
    }
  }
}

// Lấy vị trí, hướng đi và pháp tuyến tại tham số t trên một đường gấp khúc.
// Pháp tuyến để dịch xe sang làn mà không phải tính lại góc.
function samplePath(path, t) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * (path.length - 1);
  const index = Math.floor(scaled);
  const a = path[index];
  const b = path[Math.min(index + 1, path.length - 1)];
  const point = new THREE.Vector3().lerpVectors(a, b, scaled - index);
  const tangent = new THREE.Vector3().subVectors(b, a).normalize();
  return { point, tangent, normal: new THREE.Vector3(-tangent.z, 0, tangent.x) };
}

function updateVehicles(delta) {
  for (const vehicle of vehicleFleet) {
    vehicle.t += delta * vehicle.speed;
    const { point, tangent, normal } = samplePath(vehicle.path, vehicle.t);
    vehicle.mesh.position.copy(point).addScaledVector(normal, vehicle.lane);
    // Nhấc lên 0.02 để bánh chạm mặt nhựa (hoặc mặt cầu) chứ không lún xuống.
    vehicle.mesh.position.y = point.y + 0.02;
    vehicle.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
  }
}

// Tàu, thuyền, máy bay đều chạy chung một kiểu: tiến theo tham số t, lấy
// điểm và hướng trên tuyến, quay mũi theo hướng đó. Khác nhau chỉ ở cao độ
// và chút nghiêng cánh của máy bay, nên gom lại một hàm.
function advanceFleet(fleet, delta, settle) {
  for (const unit of fleet) {
    unit.t += delta * unit.speed;
    const { point, tangent } = samplePath(unit.path, unit.t);
    unit.mesh.position.copy(point);
    unit.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    settle(unit, point);
  }
}

function updateTransit(delta) {
  // Tàu chạy trên ray, nhấc khỏi tim tuyến một chút.
  advanceFleet(subwayFleet, delta, (unit, point) => {
    unit.mesh.position.y = point.y + 0.09;
  });
  // Thuyền luôn nổi ở mặt nước, bất kể tuyến vẽ ở cao độ nào.
  advanceFleet(ferryFleet, delta, (unit) => {
    unit.mesh.position.y = 0.16;
  });
  // Máy bay giữ nguyên cao độ của tuyến, thêm cái lắc cánh nhẹ cho có sức sống.
  advanceFleet(planeFleet, delta, (unit) => {
    unit.mesh.rotation.z = Math.sin(unit.t * Math.PI * 2) * 0.08;
  });
}

// Chim lượn vòng trên hồ và bãi giữa. Mỗi con chỉ là hai tam giác xếp thành
// hình chữ V — ở độ cao đó mắt không phân biệt được gì hơn, mà cả đàn gói
// trong một lệnh vẽ duy nhất.
const BIRD_WING = new Float32Array([
  0, 0, 0.16, -0.5, 0.12, -0.12, -0.05, 0, -0.06, // cánh trái
  0, 0, 0.16, 0.05, 0, -0.06, 0.5, 0.12, -0.12, // cánh phải
]);

const BIRD_FLOCKS = [
  { lat: 21.058, lng: 105.82, alt: 6.4, radius: 4.8, count: 5 }, // Hồ Tây
  { lat: 21.047, lng: 105.861, alt: 5.4, radius: 3.4, count: 4 }, // bãi giữa sông Hồng
  { lat: 21.0287, lng: 105.8523, alt: 5.0, radius: 2.4, count: 3 }, // Hồ Gươm
];

function createBirds() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(BIRD_WING, 3));
  const material = new THREE.MeshBasicMaterial({ color: 0x2b3038, side: THREE.DoubleSide });
  const flocks = BIRD_FLOCKS;
  const random = seededRandom(77);
  for (const flock of flocks) {
    const center = project(flock.lat, flock.lng, flock.alt);
    for (let i = 0; i < flock.count; i += 1) {
      birdFleet.push({
        center,
        radius: flock.radius * (0.72 + random() * 0.5),
        alt: flock.alt + (random() - 0.5) * 1.6,
        // Dấu của speed quyết định chiều bay, nên nửa đàn lượn ngược lại.
        speed: (0.24 + random() * 0.2) * (random() < 0.5 ? 1 : -1),
        phase: random() * Math.PI * 2,
        flapHz: 5 + random() * 2.5,
        size: 0.44 + random() * 0.22,
      });
    }
  }

  birdMesh = new THREE.InstancedMesh(geo, material, birdFleet.length);
  // Đàn chim bay cao và rộng hơn hộp bao của lưới gốc, tắt frustum culling
  // kẻo cả đàn biến mất khi camera hạ thấp.
  birdMesh.frustumCulled = false;
  scene.add(birdMesh);
}

const birdMatrix = new THREE.Matrix4();
const birdQuat = new THREE.Quaternion();
const birdEuler = new THREE.Euler();
const birdPos = new THREE.Vector3();
const birdScale = new THREE.Vector3();

function updateBirds(elapsed) {
  if (!birdMesh) return;
  birdFleet.forEach((bird, i) => {
    const dir = Math.sign(bird.speed);
    const theta = bird.phase + elapsed * Math.abs(bird.speed) * dir;
    birdPos.set(
      bird.center.x + Math.cos(theta) * bird.radius,
      bird.alt + Math.sin(elapsed * 1.1 + bird.phase) * 0.5,
      bird.center.z + Math.sin(theta) * bird.radius,
    );
    // Quay mũi theo tiếp tuyến vòng lượn, nghiêng cánh nhẹ vào phía trong.
    const heading = Math.atan2(-Math.sin(theta) * dir, Math.cos(theta) * dir) + Math.PI / 2;
    birdEuler.set(0, heading, 0.3 * dir, "YXZ");
    birdQuat.setFromEuler(birdEuler);
    // Vỗ cánh bằng cách bóp giãn chiều cao hình chữ V — không cần xương cốt gì.
    const flap = 0.25 + Math.abs(Math.sin(elapsed * bird.flapHz + bird.phase)) * 1.35;
    birdScale.set(bird.size, bird.size * flap, bird.size);
    birdMatrix.compose(birdPos, birdQuat, birdScale);
    birdMesh.setMatrixAt(i, birdMatrix);
  });
  birdMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- Mây ---------- */

const CLOUD_COUNT = 8;
const CLOUD_DRIFT_LIMIT = 78;

function createClouds() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f1e8,
    roughness: 0.92,
    transparent: true,
    opacity: 0.72,
  });
  const random = seededRandom(12);
  for (let i = 0; i < CLOUD_COUNT; i += 1) {
    const cloud = new THREE.Group();
    // Mỗi đám là mấy quả cầu bẹt chồng lệch nhau, rẻ hơn mọi cách khác mà
    // nhìn từ xa vẫn ra hình khối mây.
    const puffs = 3 + Math.floor(random() * 4);
    for (let j = 0; j < puffs; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + random() * 1.5, 12, 8), material);
      puff.scale.y = 0.38;
      puff.position.set((random() - 0.5) * 5, (random() - 0.5) * 0.6, (random() - 0.5) * 2);
      cloud.add(puff);
    }
    cloud.position.set(-62 + random() * 130, 26 + random() * 12, -70 + random() * 55);
    cloud.userData.speed = 0.45 + random() * 0.5;
    scene.add(cloud);
  }
}

function updateClouds(delta) {
  for (const child of scene.children) {
    if (!child.userData.speed) continue;
    child.position.x += delta * child.userData.speed;
    if (child.position.x > CLOUD_DRIFT_LIMIT) child.position.x = -CLOUD_DRIFT_LIMIT;
  }
}

/* ---------- Mù phủ rìa bản đồ ---------- */

// Mấy tấm mờ nằm là là trên các vùng ngoài tiêu điểm — Long Biên, Gia Lâm,
// rìa nam, rìa tây. Đây là cách làm nhoè hậu cảnh rẻ nhất: giữ trung tâm Hà
// Nội nét căng còn mép bản đồ tan vào không khí. Pin ở ngoài đó vẫn nhô lên
// trên lớp mù nên không mất địa điểm nào.
function makeHazeTexture() {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const mid = SIZE / 2;
  const fade = ctx.createRadialGradient(mid, mid, 24, mid, mid, mid);
  fade.addColorStop(0, "rgba(226, 236, 243, 0.8)");
  fade.addColorStop(0.65, "rgba(226, 236, 243, 0.45)");
  fade.addColorStop(1, "rgba(226, 236, 243, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const HAZE_PADS = [
  { lat: 21.052, lng: 105.888, w: 40, d: 42 }, // Long Biên
  { lat: 21.0, lng: 105.888, w: 34, d: 26 }, // Gia Lâm nam
  { lat: 20.992, lng: 105.802, w: 44, d: 22 }, // vành đai nam
  { lat: 21.028, lng: 105.759, w: 24, d: 40 }, // rìa tây Mỹ Đình
];

function createHaze() {
  // Một vật liệu dùng chung cho cả bốn tấm; trước kia mỗi tấm tự tạo một
  // vật liệu giống hệt nhau, tốn bốn lần biên dịch shader mà chẳng để làm gì.
  const material = new THREE.MeshBasicMaterial({
    map: makeHazeTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const plane = new THREE.PlaneGeometry(1, 1);
  HAZE_PADS.forEach((pad, index) => {
    const mesh = new THREE.Mesh(plane, material);
    mesh.rotation.x = -Math.PI / 2;
    // Nhích cao độ từng tấm một chút để chúng không tranh nhau chiều sâu.
    mesh.position.copy(project(pad.lat, pad.lng, 0.85 + index * 0.02));
    mesh.scale.set(pad.w, pad.d, 1);
    mesh.renderOrder = 4;
    scene.add(mesh);
  });
}

/* ---------- Người đi bộ ---------- */

// Người đi bộ men theo mép các ô phố: một lưới instanced, vài trăm phép
// dựng ma trận mỗi khung hình. Hàm này trả về điểm nằm ở tham số t trên chu
// vi một hình chữ nhật, t chạy 0→1 là đi hết một vòng.
function rectPerimeterPoint(t, hx, hz, out) {
  const perimeter = 4 * (hx + hz);
  let d = (((t % 1) + 1) % 1) * perimeter;
  if (d < 2 * hx) return out.set(-hx + d, 0, -hz);
  d -= 2 * hx;
  if (d < 2 * hz) return out.set(hx, 0, -hz + d);
  d -= 2 * hz;
  if (d < 2 * hx) return out.set(hx - d, 0, hz);
  d -= 2 * hx;
  return out.set(-hx, 0, hz - d);
}

// Áo quần người đi đường: mấy tông trầm hay gặp, thêm một sắc nổi cho vui mắt.
const PED_PALETTE = [
  0x30343c, 0x6b7280, 0x9a4a3f, 0x3b5f8a, 0x7d6a4f, 0xb8b2a4, 0x51606b, 0x8c3f5d,
].map((hex) => new THREE.Color(hex));

const PED_MAX = 240;

function createPedestrians() {
  if (!sidewalkPlates.length) return;
  const random = seededRandom(515);
  const { uLen, vLen, rot } = GRID_METRICS;
  pedRect = {
    // Nhích ra ngoài mép tấm lát một chút: đó chính là vạch bó vỉa.
    hx: (vLen - 0.26) / 2 + 0.06,
    hz: (uLen - 0.12) / 2 + 0.05,
    cos: Math.cos(rot),
    sin: Math.sin(rot),
  };
  const total = Math.min(PED_MAX, sidewalkPlates.length * 3);
  for (let i = 0; i < total; i += 1) {
    const plate = sidewalkPlates[Math.floor(random() * sidewalkPlates.length)];
    pedFleet.push({
      cx: plate.x,
      cz: plate.z,
      t: random(),
      speed: (0.008 + random() * 0.009) * (random() < 0.5 ? 1 : -1),
      phase: random() * Math.PI * 2,
      size: 0.8 + random() * 0.45,
    });
  }
  const geo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
  geo.translate(0, 0.075, 0); // gốc toạ độ đặt ở chân, để đứng đúng mặt đất
  pedMesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    pedFleet.length,
  );
  pedFleet.forEach((_, i) => pedMesh.setColorAt(i, PED_PALETTE[i % PED_PALETTE.length]));
  scene.add(pedMesh);
}

const pedMatrix = new THREE.Matrix4();
const pedLocal = new THREE.Vector3();
const pedPos = new THREE.Vector3();
const pedScale = new THREE.Vector3();
const pedQuat = new THREE.Quaternion();

function updatePedestrians(delta, elapsed) {
  if (!pedMesh) return;
  pedFleet.forEach((ped, i) => {
    ped.t += delta * ped.speed;
    rectPerimeterPoint(ped.t, pedRect.hx, pedRect.hz, pedLocal);
    // Xoay điểm cục bộ theo hướng lưới phố rồi dời về tâm ô.
    pedPos.set(
      ped.cx + pedLocal.x * pedRect.cos + pedLocal.z * pedRect.sin,
      0.032,
      ped.cz - pedLocal.x * pedRect.sin + pedLocal.z * pedRect.cos,
    );
    // Nhún nhẹ một cái là ra dáng đang đi, khỏi cần xương cốt gì hết.
    const bob = 1 + Math.sin(elapsed * 9 + ped.phase) * 0.06;
    pedScale.set(ped.size, ped.size * bob, ped.size);
    pedMatrix.compose(pedPos, pedQuat, pedScale);
    pedMesh.setMatrixAt(i, pedMatrix);
  });
  pedMesh.instanceMatrix.needsUpdate = true;
}

function updateWater(elapsed) {
  for (const water of waterSurfaces) {
    const geo = water.geometry;
    const pos = geo.attributes.position;
    const base = water.userData.baseZ;
    if (!base) continue;
    for (let i = 0; i < pos.count; i += 1) {
      const ix = i * 3;
      const x = base[ix];
      const y = base[ix + 1];
      const wave =
        Math.sin(x * 0.18 + elapsed * 0.6) * 0.05 +
        Math.cos(y * 0.22 - elapsed * 0.45) * 0.04;
      pos.array[ix + 2] = base[ix + 2] + wave;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

function createLabels() {
  STARTUPS.forEach((startup) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "marker-label";
    button.dataset.id = startup.id;
    button.dataset.stage = startup.stage ?? "";
    button.style.setProperty(
      "--label-color",
      startup.stage === "Ẩm thực"
        ? "var(--color-food)"
        : startup.stage === "Du lịch"
          ? "var(--color-sight)"
          : "var(--color-home)",
    );
    button.innerHTML = `
      <img class="marker-label__logo" src="${escapeHtml(logoPath(startup))}" data-stage="${escapeHtml(startup.stage ?? "")}" alt="" loading="lazy" decoding="async" draggable="false">
      <span>${escapeHtml(startup.name)}</span>
      ${startup.stage ? `<small data-tag>${escapeHtml(tagOf(startup.stage))}</small>` : ""}
    `;
    button.addEventListener("click", () => selectStartup(startup.id));
    labelsLayer.appendChild(button);
    labelElements.set(startup.id, button);
  });

}

// Những cái tên mà người ta mở bản đồ Hà Nội là tìm. Trên điện thoại chỉ
// hiện chừng này nhãn, còn lại giấu đi cho đỡ rối.
const KEY_PLACES = new Set([
  "Hồ Gươm & Tháp Rùa",
  "Lăng Chủ tịch Hồ Chí Minh",
  "Văn Miếu – Quốc Tử Giám",
  "Chùa Trấn Quốc",
  "Cầu Long Biên",
  "Phở Bát Đàn",
  "Bún chả Hương Liên",
  "Cà phê Giảng",
  "Bia hơi Tạ Hiện",
  "Chợ Đồng Xuân",
  "Keangnam Landmark 72",
  "Lotte Center Hà Nội",
  "Vinhomes Times City",
  "Vinhomes Royal City",
  "SVĐ Quốc gia Mỹ Đình",
]);

// Nới rộng khung một chút (1.08 thay vì 1.0) để nhãn ở sát mép không bị tắt
// đột ngột ngay khi vừa chạm rìa màn hình.
const SCREEN_MARGIN = 1.08;

function onScreen(projected) {
  return (
    projected.z > -1 &&
    projected.z < 1 &&
    Math.abs(projected.x) < SCREEN_MARGIN &&
    Math.abs(projected.y) < SCREEN_MARGIN
  );
}

// Ghim toạ độ ngang vào trong khung, chừa nửa bề rộng nhãn ở mỗi bên.
function clampX(x, halfWidth, width) {
  const limit = Math.max(halfWidth, width - halfWidth);
  return Math.min(Math.max(x, halfWidth), limit);
}

// Dồn nhãn: chia hai lượt. Lượt một xem nhãn nào đáng hiện và pin của nó rơi
// vào đâu trên màn hình. Lượt hai xếp chỗ theo kiểu tham lam — nhãn quan
// trọng đặt trước, nhãn đặt sau mà đụng nhau thì bị đẩy thẳng lên trên, kéo
// theo một sợi chỉ nối ngược xuống pin của nó.
const DECLUTTER = { pad: 3, step: 5, maxShift: 150 };

function collectLabelCandidates(width, height) {
  const activeArea = state.activeAreaId;
  const activeItems = new Set(visibleItems(activeArea).map((item) => item.id));
  const candidates = [];

  for (const startup of STARTUPS) {
    const marker = startupMarkers.get(startup.id);
    const label = labelElements.get(startup.id);
    if (!marker || !label) continue;

    const world = marker.group.position.clone();
    world.y += 1.55; // nhô lên khỏi đầu pin
    const projected = world.project(camera);

    const inArea = stageAllowed(startup) && (activeArea === "all" || activeItems.has(startup.id));
    const isKey = KEY_PLACES.has(startup.name);
    const selected = state.selectedId === startup.id;
    const byMode = state.labelsMode === "all" ? inArea : inArea && (isKey || selected);

    label.classList.toggle("is-muted", activeArea !== "all" && !activeItems.has(startup.id));
    label.classList.toggle("is-dimmed", Boolean(state.selectedId) && !selected);
    label.classList.toggle("is-selected", selected);

    if (!onScreen(projected) || !byMode) {
      label.classList.add("is-hidden");
      label.classList.remove("has-leader");
      continue;
    }

    // Đo kích thước một lần rồi nhớ lại: đọc offsetWidth mỗi khung hình là
    // ép trình duyệt tính lại bố cục, tụt khung hình thấy rõ.
    let dims = labelDims.get(startup.id);
    if (!dims?.w) {
      dims = { w: label.offsetWidth || 120, h: label.offsetHeight || 28 };
      labelDims.set(startup.id, dims);
    }

    candidates.push({
      label,
      ax: clampX((projected.x * 0.5 + 0.5) * width, dims.w / 2 + 6, width),
      ay: (-projected.y * 0.5 + 0.5) * height,
      w: dims.w,
      h: dims.h,
      depth: projected.z,
      priority: selected ? 3 : isKey ? 2 : 1,
    });
  }
  return candidates;
}

function placeLabels(candidates) {
  const { pad, step, maxShift } = DECLUTTER;
  // Quan trọng trước, rồi tới nhãn nằm cao hơn trên màn hình.
  candidates.sort((a, b) => b.priority - a.priority || a.ay - b.ay);

  const placed = [];
  const overlaps = (r) =>
    placed.some((p) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top);

  for (const c of candidates) {
    const boxAt = (shift) => ({
      left: c.ax - c.w / 2 - pad,
      right: c.ax + c.w / 2 + pad,
      top: c.ay - shift - 1.1 * c.h - pad,
      bottom: c.ay - shift - 0.1 * c.h + pad,
    });

    let shift = 0;
    let box = boxAt(shift);
    while (overlaps(box) && shift < maxShift) {
      shift += step;
      box = boxAt(shift);
    }

    // Nhãn hạng bét mà đẩy hết cỡ vẫn không lọt thì thôi, ẩn đi cho gọn.
    if (overlaps(box) && c.priority === 1) {
      c.label.classList.add("is-hidden");
      c.label.classList.remove("has-leader");
      continue;
    }

    placed.push(box);
    c.label.classList.remove("is-hidden");
    c.label.style.left = `${Math.round(c.ax)}px`;
    c.label.style.top = `${c.ay - shift}px`;
    c.label.style.setProperty("--leader", `${shift + 4}px`);
    c.label.classList.toggle("has-leader", shift > 6);
  }
}

// Nhãn nền (tên hồ, tên cầu, tên ga) không tham gia dồn chỗ — chúng nằm im
// một chỗ, chỉ mờ đi khi ra khỏi khung hoặc khi đang lọc theo khu vực.
function placeLandmarkLabels(width, height) {
  const showAll = state.activeAreaId === "all" || state.labelsMode === "all";
  for (const { el, point } of landmarkLabelElements) {
    const projected = project(point.lat, point.lng, point.y).project(camera);
    const half = (el.offsetWidth || 80) / 2 + 6;
    el.style.left = `${Math.round(clampX((projected.x * 0.5 + 0.5) * width, half, width))}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    el.style.opacity = onScreen(projected) && showAll ? "1" : "0";
  }
}

function updateLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  placeLabels(collectLabelCandidates(width, height));
  placeLandmarkLabels(width, height);
}

// Category chips: legend + one-tap filter. Tapping a chip shows only that
// group's pins; tapping it again brings everything back.
function renderPinLegend() {
  const entries = [
    { stage: "Ẩm thực", css: "var(--color-food)" },
    { stage: "Du lịch", css: "var(--color-sight)" },
    { stage: "BĐS", css: "var(--color-home)" },
  ];
  pinLegend.innerHTML = entries
    .map((entry) => {
      const on = activeStages.size === 0 || activeStages.has(entry.stage);
      const count = STARTUPS.filter((s) => s.stage === entry.stage).length;
      return `<button class="pin-legend__item${on ? "" : " is-off"}" type="button" data-stage="${escapeHtml(entry.stage)}" aria-pressed="${activeStages.has(entry.stage)}" title="${escapeHtml(t("filterHint"))}"><i style="background:${entry.css}"></i>${escapeHtml(stageLabel(entry.stage))}<b>${count}</b></button>`;
    })
    .join("");
}

function renderAreaList() {
  areaList.innerHTML = "";
  AREAS.forEach((area) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "area-button";
    button.dataset.area = area.id;
    const count = visibleItems(area.id).length;
    button.innerHTML = `<span class="area-button__number">${area.number}</span><span class="area-button__label">${escapeHtml(areaLabel(area))}</span><span class="area-button__count">${count}</span>`;
    button.addEventListener("click", () => setActiveArea(area.id));
    areaList.appendChild(button);
  });
}

function miniMapPosition(item) {
  const x = 8 + ((item.lng - 105.752) / 0.153) * 104;
  const y = 8 + ((21.098 - item.lat) / 0.113) * 144;
  return { x: Math.max(5, Math.min(115, x)), y: Math.max(5, Math.min(155, y)) };
}

function renderMiniMap() {
  miniMapPoints.innerHTML = "";
  STARTUPS.forEach((startup) => {
    const point = miniMapPosition(startup);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", startup.stage === "Du lịch" ? "2.2" : "1.6");
    circle.classList.add("mini-point");
    circle.dataset.id = startup.id;
    miniMapPoints.appendChild(circle);
  });
}

function updateUiState() {
  document.querySelectorAll(".area-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.area === state.activeAreaId);
  });
  document.querySelectorAll(".mini-point").forEach((point) => {
    const item = STARTUPS.find((startup) => startup.id === point.dataset.id);
    const shown = Boolean(item) && stageAllowed(item);
    point.style.display = shown ? "" : "none";
    point.classList.toggle("is-active", shown && (item.area === state.activeAreaId || state.activeAreaId === "all"));
  });
  document.body.classList.toggle("is-focused", Boolean(state.selectedId));
  syncMapMarkers();

  // Chèn dòng mô tả xuống ngay dưới đúng mục khu vực đang chọn.
  const activeButton = areaList.querySelector(`.area-button[data-area="${state.activeAreaId}"]`);
  const area = AREA_BY_ID[state.activeAreaId];
  if (activeButton && area) {
    areaDescEl.textContent = bi(area.description);
    activeButton.insertAdjacentElement("afterend", areaDescEl);
  } else {
    areaDescEl.remove();
  }
}

/* ---------------------------------------------------------------- */
/* Liên kết sâu: #/place/:id và #/area/:id, có lùi/tiến trình duyệt   */
/* ---------------------------------------------------------------- */

let suppressHashEvent = false;

function writeHash(hash) {
  if (location.hash === hash) return;
  suppressHashEvent = true;
  location.hash = hash;
}

function shareUrl(hash) {
  return `${location.origin}${location.pathname}${hash}`;
}

function applyHashFromLocation() {
  const hash = location.hash || "#/";
  const company = hash.match(/^#\/(?:place|company)\/([\w-]+)$/);
  if (company && STARTUPS.some((s) => s.id === company[1])) {
    selectStartup(company[1]);
    return;
  }
  const area = hash.match(/^#\/area\/([\w-]+)$/);
  if (area && AREA_BY_ID[area[1]]) {
    setActiveArea(area[1]);
    return;
  }
  if (hash === "#/" || hash === "#") setActiveArea("all");
}

function setActiveArea(areaId, { keepSelection = false } = {}) {
  state.activeAreaId = areaId;
  if (!keepSelection) {
    state.selectedId = null;
    releaseFocus();
  }
  const area = AREA_BY_ID[areaId];
  flyTo(area.focus);
  mapFocusArea(areaId);
  renderAreaDetail(area);
  updateUiState();
  if (!keepSelection) {
    writeHash(areaId === "all" ? "#/" : `#/area/${areaId}`);
  }
}

function selectStartup(id) {
  const startup = STARTUPS.find((item) => item.id === id);
  if (!startup) return;
  state.selectedId = id;
  state.activeAreaId = startup.area;
  flyTo({ lat: startup.lat, lng: startup.lng, distance: 18, height: 16, rotation: 0.72 }, { cinematic: true });
  mapFocusPlace(startup);
  engageFocus(startup);
  renderStartupDetail(startup);
  updateUiState();
  writeHash(`#/place/${id}`);
}

function renderAreaDetail() {
  // Chỗ của thẻ chi tiết: khi chưa chọn gì thì luôn hiện bảng hướng dẫn
  // "cách khám phá"; chọn một địa điểm là nó nhường chỗ cho thẻ chi tiết.
  if (state.selectedId) {
    detailCard.classList.add("is-hidden");
    detailCard.classList.remove("is-onboard");
    return;
  }
  detailCard.classList.add("is-onboard");
  detailCard.classList.remove("is-hidden");
  detailCard.innerHTML = `
    <p class="onboard-title">${escapeHtml(t("onboardTitle"))}</p>
    <ul class="onboard">
      <li><span class="onboard__keys"><kbd>↑</kbd><kbd>↓</kbd></span><span>${escapeHtml(t("onboardAreas"))}</span></li>
      <li><span class="onboard__keys"><kbd>⌘</kbd><kbd>K</kbd></span><span>${escapeHtml(t("onboardSearch"))}</span></li>
      <li><span class="onboard__keys"><kbd class="onboard__click">${escapeHtml(t("onboardTapKey"))}</kbd></span><span>${escapeHtml(t("onboardTap"))}</span></li>
    </ul>
  `;
}

function renderStartupDetail(startup) {
  const url = safeUrl(startup.website);
  const info = COMPANY_INFO[startup.id] || {};
  const blurb = bi(info.blurb) || startup.notes || `${startup.sector || t("aPlace")} — ${t("onTheMap")}`;
  const loc = info.loc || areaShort(AREA_BY_ID[startup.area]) || "Hà Nội";

  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
  }

  const meta = [stageLabel(startup.stage), startup.office, loc].filter(Boolean).join(" · ");
  // Các trường bổ sung không bắt buộc: chỉ vẽ ra khi dữ liệu thật sự có.
  const open = openState(startup.hours);
  const facts = [
    startup.price ? `${t("price")} ${startup.price}` : null,
    startup.hours ? `${t("hours")} ${startup.hours}` : null,
    startup.address ? startup.address : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const lezWard = lezWardOf(startup);
  const away = distanceTo(startup);

  detailCard.classList.remove("is-hidden", "is-onboard");
  detailCard.innerHTML = `
    <button class="detail-card__close" type="button" aria-label="${escapeHtml(t("close"))}">&times;</button>
    <div class="detail-card__head">
      <img class="detail-card__logo" src="${escapeHtml(logoPath(startup))}" data-stage="${escapeHtml(startup.stage ?? "")}" alt="" loading="lazy" decoding="async" draggable="false">
      <div class="detail-card__heading">
        <h2>${escapeHtml(startup.name)}</h2>
        ${startup.sector ? `<p class="detail-card__sector">${escapeHtml(startup.sector)}</p>` : ""}
      </div>
    </div>
    ${
      away || open || lezWard
        ? `<p class="detail-card__chips">${away ? `<span class="chip chip--near">${escapeHtml(t("away").replace("{d}", away))}</span>` : ""}${open ? `<span class="chip chip--${open.open ? "open" : "shut"}">${escapeHtml(open.text)}</span>` : ""}${lezWard ? `<button class="chip chip--lez" type="button" data-lez title="${escapeHtml(t("lezWarn"))}">${escapeHtml(t("lezInZone"))} · ${escapeHtml(lezWard)}</button>` : ""}</p>`
        : ""
    }
    <p class="detail-card__blurb">${escapeHtml(blurb)}</p>
    ${meta ? `<p class="detail-card__meta">${escapeHtml(meta)}</p>` : ""}
    ${facts ? `<p class="detail-card__meta">${escapeHtml(facts)}</p>` : ""}
    <div class="detail-card__actions">
      <a class="detail-card__link" href="${escapeHtml(directionsUrl(startup))}" target="_blank" rel="noreferrer">${escapeHtml(t("directions"))} ↗</a>
      ${url ? `<a class="detail-card__ghost" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(host || "Website")} ↗</a>` : ""}
      <button class="detail-card__ghost" type="button" data-copy>${escapeHtml(t("copyLink"))}</button>
    </div>
  `;
  const lezChip = detailCard.querySelector("[data-lez]");
  if (lezChip) {
    lezChip.addEventListener("click", () => {
      if (!mapLayerState.lez) toggleMapLayer("lez");
      else openLezNote();
    });
  }
  const closeBtn = detailCard.querySelector(".detail-card__close");
  if (closeBtn) closeBtn.addEventListener("click", () => clearSelection());
  const copyBtn = detailCard.querySelector("[data-copy]");
  if (copyBtn)
    copyBtn.addEventListener("click", async () => {
      copyBtn.textContent = (await copyText(shareUrl(`#/place/${startup.id}`))) ? t("copied") : t("copyFailed");
      setTimeout(() => {
        copyBtn.textContent = t("copyLink");
      }, 1400);
    });
}

// Ưu tiên Clipboard API; trình duyệt cũ hoặc trang không chạy https thì lùi
// về mẹo textarea ẩn + execCommand.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(scratch);
    scratch.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    scratch.remove();
    return ok;
  }
}

function clearSelection() {
  state.selectedId = null;
  releaseFocus();
  const area = AREA_BY_ID[state.activeAreaId] || AREA_BY_ID.all;
  renderAreaDetail(area);
  updateUiState();
  writeHash(area.id === "all" ? "#/" : `#/area/${area.id}`);
}

/* ---------- Máy quay ---------- */

// Màn hình dọc chỉ thấy một lát rất hẹp của thành phố. Cách sửa hiển nhiên
// là lùi máy ra sau, nhưng lùi không thôi thì góc nhìn bẹt ra và nửa khung
// hình thành bầu trời. Nên vừa lùi vừa NGHIÊNG XUỐNG: giữ nguyên hướng
// ngắm, chỉ đổi bán kính và độ cao. viewFit.pull và viewFit.tilt là hai núm
// vặn đó, tính theo tỉ lệ khung hình.
function cameraDestination(focus) {
  const target = project(focus.lat, focus.lng, 0.8);
  const rotation = focus.rotation ?? 0.66;
  const distance = focus.distance ?? 40;
  const height = focus.height ?? 28;

  const radius = Math.hypot(distance, height) * viewFit.pull;
  const pitch = Math.atan2(height, distance) + viewFit.tilt;
  const flat = Math.cos(pitch) * radius;

  return {
    target,
    position: new THREE.Vector3(
      target.x + Math.sin(rotation) * flat,
      Math.sin(pitch) * radius,
      target.z + Math.cos(rotation) * flat,
    ),
  };
}

const FLIGHT_MS = { reduced: 120, cinematic: 1900, normal: 1300 };

function flyTo(focus, { cinematic = false } = {}) {
  const destination = cameraDestination(focus);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flight = {
    startTime: performance.now(),
    duration: reduced ? FLIGHT_MS.reduced : cinematic ? FLIGHT_MS.cinematic : FLIGHT_MS.normal,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: destination.position,
    toTarget: destination.target,
  };

  // Chọn một địa điểm thì máy không bay thẳng mà nhấc lên, vòng cung, rồi hạ
  // xuống. Bay thẳng qua thành phố trông như tua nhanh bản đồ; vòng cung mới
  // ra dáng một cú lia máy.
  if (cinematic && !reduced) {
    const from = flight.fromPos.clone();
    const to = flight.toPos.clone();
    const lift = Math.min(30, 8 + from.distanceTo(to) * 0.34);
    const rise = from.clone().lerp(to, 0.28);
    rise.y = Math.max(from.y, to.y) + lift;
    const fall = from.clone().lerp(to, 0.8);
    fall.y = to.y + lift * 0.42;
    flight.path = new THREE.CatmullRomCurve3([from, rise, fall, to], false, "centripetal");
  }
  state.flight = flight;
}

function updateFlight() {
  const flight = state.flight;
  if (!flight) return;
  const raw = Math.min(1, (performance.now() - flight.startTime) / flight.duration);
  // Giảm tốc bậc ba: đi nhanh lúc đầu rồi tiến chậm dần vào đích.
  const t = 1 - (1 - raw) ** 3;
  if (flight.path) camera.position.copy(flight.path.getPointAt(t));
  else camera.position.lerpVectors(flight.fromPos, flight.toPos, t);
  controls.target.lerpVectors(flight.fromTarget, flight.toTarget, t);
  if (raw >= 1) state.flight = null;
}

// Ba trạng thái của một cái pin: đang chọn, thuộc khu vực đang xem, và nằm
// ngoài. Bảng dưới đây gom hết vào một chỗ thay vì rải ba biểu thức ba tầng
// ngoặc — đọc ra ngay pin nào to bao nhiêu, mờ bao nhiêu.
const PIN_STATE = {
  //                    có địa điểm đang chọn      không có
  selected: { scale: 1.24, opacity: 1 },
  active: { scale: [0.8, 0.92], opacity: [0.45, 1] },
  faded: { scale: [0.58, 0.58], opacity: [0.18, 0.32] },
};

function updateMarkerScale(time) {
  const activeItems = new Set(visibleItems(state.activeAreaId).map((item) => item.id));
  const hasSelection = Boolean(state.selectedId);
  const pickState = (selected, active) =>
    selected ? PIN_STATE.selected : active ? PIN_STATE.active : PIN_STATE.faded;
  const at = (value) => (Array.isArray(value) ? value[hasSelection ? 0 : 1] : value);

  for (const { group, halo, item } of startupMarkers.values()) {
    group.visible = stageAllowed(item);
    if (!group.visible) continue;

    const selected = state.selectedId === item.id;
    const active = state.activeAreaId === "all" || activeItems.has(item.id);
    const look = pickState(selected, active);

    // Pin đang chọn thở nhè nhẹ. Lệch pha theo vĩ độ để cả rừng pin không
    // phập phồng đồng loạt như một.
    const pulse = selected ? 1 + Math.sin(time * 3.2 + item.lat) * 0.04 : 1;
    group.scale.setScalar(at(look.scale) * pulse);

    const opacity = at(look.opacity);
    for (const child of group.children) {
      // Quả cầu bắt chuột phải trong suốt tuyệt đối, kể cả khi pin đang sáng.
      if (child.userData.hitArea) {
        child.material.opacity = 0;
        continue;
      }
      if (child.material?.opacity !== undefined) {
        child.material.transparent = opacity < 1;
        child.material.opacity = opacity;
      }
    }
    halo.rotation.z += 0.01;
  }
}

function pickMarker(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(markerMeshes, false);
  for (const hit of hits) {
    const item = hit.object?.userData?.item;
    if (item && stageAllowed(item)) return item;
  }
  return null;
}

function onPointerMove(event) {
  hoverCandidate = pickMarker(event);
  canvas.style.cursor = hoverCandidate ? "pointer" : "grab";
}

function onPointerDown(event) {
  // Ghi lại pin nằm dưới ngón tay NGAY LÚC ĐẶT xuống, không phải lúc nhấc
  // lên: kéo xoay bản đồ xong nhả tay ở chỗ khác thì vẫn phải là cùng một
  // cử chỉ, không được biến thành cú chạm vào pin nào đó.
  pointerDown = { x: event.clientX, y: event.clientY, item: pickMarker(event) };
}

// Ngưỡng 6px phân biệt chạm với kéo. Ngón tay người không bao giờ đứng yên
// tuyệt đối, để 0 thì trên điện thoại gần như không chọn được gì.
const TAP_SLOP = 6;

function onPointerUp(event) {
  if (!pointerDown) return;
  const { x, y, item } = pointerDown;
  pointerDown = null;
  if (Math.hypot(event.clientX - x, event.clientY - y) > TAP_SLOP) return;
  if (item) selectStartup(item.id);
  else if (state.selectedId) clearSelection();
}

function renderSearchResults(query) {
  const value = query.trim().toLowerCase();
  searchActiveIndex = -1;

  // No query: nearest places when we know where the visitor is, otherwise a
  // few well-known suggestions so the modal is never empty.
  let results;
  let heading = "";
  if (!value && userPos) {
    results = [...STARTUPS]
      .map((s) => ({ s, d: metresBetween(userPos, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
      .map((x) => x.s);
    heading = t("nearestToYou");
  } else if (!value) {
    const featured = [
      "Phở Bát Đàn",
      "Hồ Gươm & Tháp Rùa",
      "Bún chả Hương Liên",
      "Chùa Trấn Quốc",
      "Cà phê Giảng",
      "Vinhomes Times City",
    ];
    results = featured.map((name) => STARTUPS.find((s) => s.name === name)).filter(Boolean);
    // Dữ liệu live từ Sheet có thể đổi tên: lấp đầy bằng các địa điểm đầu danh sách.
    for (const startup of STARTUPS) {
      if (results.length >= 6) break;
      if (!results.includes(startup)) results.push(startup);
    }
    results = results.slice(0, 6);
  } else {
    results = STARTUPS.filter((startup) => {
      const info = COMPANY_INFO[startup.id] || {};
      const haystack =
        `${startup.name} ${startup.sector ?? ""} ${startup.stage ?? ""} ${AREA_BY_ID[startup.area]?.label ?? ""} ${info.loc ?? ""} ${info.blurb ?? ""}`.toLowerCase();
      return haystack.includes(value);
    }).slice(0, 8);
  }

  if (!results.length) {
    searchResults.innerHTML = `<div class="search-result" aria-disabled="true"><span class="search-result__body"><strong>${escapeHtml(t("noResults"))}</strong><span>${escapeHtml(t("noResultsHint"))}</span></span></div><a class="search-results__cta" href="${escapeHtml(suggestUrl())}" target="_blank" rel="noreferrer noopener">${escapeHtml(t("suggestCta"))} ↗</a>`;
    return;
  }

  searchResults.innerHTML =
    (heading ? `<p class="search-results__head">${escapeHtml(heading)}</p>` : "") +
    results
      .map((startup) => {
        const info = COMPANY_INFO[startup.id] || {};
        const away = distanceTo(startup);
        const sub = [startup.sector && startup.sector !== "Mapped startup" ? startup.sector : null, info.loc]
          .filter(Boolean)
          .join(" · ");
        return `
        <button class="search-result" type="button" role="option" data-id="${startup.id}">
          <img class="search-result__logo" src="${escapeHtml(logoPath(startup))}" data-stage="${escapeHtml(startup.stage ?? "")}" alt="" loading="lazy" decoding="async">
          <span class="search-result__body">
            <strong>${escapeHtml(startup.name)}</strong>
            <span>${escapeHtml(sub || t("aPlace"))}</span>
          </span>
          ${away ? `<span class="search-result__dist">${escapeHtml(away)}</span>` : ""}
        </button>
      `;
      })
      .join("");
}

function searchResultButtons() {
  return [...searchResults.querySelectorAll(".search-result[data-id]")];
}

function setSearchActive(index) {
  const buttons = searchResultButtons();
  if (!buttons.length) return;
  searchActiveIndex = (index + buttons.length) % buttons.length;
  buttons.forEach((b, i) => b.classList.toggle("is-active", i === searchActiveIndex));
  buttons[searchActiveIndex].scrollIntoView({ block: "nearest" });
}

function openSearch() {
  if (searchModal.open) return;
  searchInput.value = "";
  renderSearchResults("");
  searchModal.showModal();
  requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  if (searchModal.open) searchModal.close();
}

function bindEvents() {
  bindViewport();
  bindPointer();
  bindSearch();
  bindKeyboard();
  bindRouting();
}

// Xoay ngang xoay dọc điện thoại là đổi hẳn lượng thành phố lọt vào khung,
// nên phải đo lại rồi lấy khung hình mới. Chỉ bay lại khi mức thay đổi đáng
// kể và người dùng chưa chọn địa điểm nào — kéo camera khỏi chỗ họ đang xem
// là rất khó chịu.
function bindViewport() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const before = viewFit.pull;
    measureViewFit();
    if (Math.abs(before - viewFit.pull) > 0.02 && !state.selectedId) {
      flyTo((AREA_BY_ID[state.activeAreaId] || AREA_BY_ID.all).focus);
    }
  });
}

function bindPointer() {
  pinLegend.addEventListener("click", (event) => {
    const chip = event.target.closest(".pin-legend__item[data-stage]");
    if (chip) toggleStage(chip.dataset.stage);
  });

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", () => {
    pointerDown = null;
  });

  const brand = document.querySelector(".brand");
  brand?.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveArea("all");
  });
}

function bindSearch() {
  searchTrigger.addEventListener("click", openSearch);
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSearchActive(searchActiveIndex + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Chưa chọn dòng nào thì Enter lấy luôn kết quả đầu tiên.
    const buttons = searchResultButtons();
    const choice = buttons[searchActiveIndex] || buttons[0];
    if (choice) {
      selectStartup(choice.dataset.id);
      closeSearch();
    }
  });

  searchResults.addEventListener("click", (event) => {
    const button = event.target.closest(".search-result[data-id]");
    if (!button) return;
    selectStartup(button.dataset.id);
    closeSearch();
  });

  // Bấm ra ngoài phần nội dung (tức là trúng lớp nền) thì đóng hộp thoại.
  searchModal.addEventListener("click", (event) => {
    if (event.target === searchModal) closeSearch();
  });
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (searchModal.open) closeSearch();
      else openSearch();
      return;
    }

    // Không cướp phím khi người ta đang gõ hoặc hộp tìm kiếm đang mở.
    if (searchModal.open) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // ↑ / ↓ đi vòng qua mọi khung nhìn, hết khu vực cuối thì quay lại
    // "Toàn cảnh Hà Nội".
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const current = Math.max(0, AREAS.findIndex((a) => a.id === state.activeAreaId));
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveArea(AREAS[(current + step + AREAS.length) % AREAS.length].id);
    }
  });
}

function bindRouting() {
  // Nút lùi/tiến của trình duyệt đọc lại đường dẫn băm và áp lại trạng thái.
  window.addEventListener("hashchange", () => {
    if (suppressHashEvent) {
      suppressHashEvent = false;
      return;
    }
    applyHashFromLocation();
  });
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;
  // Ở chế độ bản đồ thật khung 3D bị che hẳn: ngừng vẽ cho đỡ tốn pin, nhưng
  // vẫn giữ vòng lặp sống nên bấm quay lại là hiện ngay, không phải dựng lại.
  if (mapMode) {
    window.requestAnimationFrame(animate);
    return;
  }
  updateFlight();
  updateWater(elapsed);
  updateVehicles(delta);
  updatePedestrians(delta, elapsed);
  updateTransit(delta);
  updateClouds(delta);
  updateBirds(elapsed);
  updateMarkerScale(elapsed);
  updateFocusFx(elapsed, delta);
  updateRain(delta);
  updateNightLights(elapsed);
  updateHere(elapsed);
  controls.update();
  // Live-weather fog rides ON TOP of the focus-easing fog: multiply just for
  // this render, then restore, so the two systems never fight over .density.
  // viewFit.fog thins it on tall screens, where the camera sits further back.
  const fogNow = scene.fog.density;
  scene.fog.density = fogNow * liveEnv.fogMul * viewFit.fog;
  renderer.render(scene, camera);
  scene.fog.density = fogNow;
  updateLabels();
  window.requestAnimationFrame(animate);
}

// Thứ tự dựng cảnh có ràng buộc thật, không xếp tuỳ tiện được:
//   · createStreetTrees phải chạy trước buildTrees, vì nó chỉ xếp cây vào
//     hàng đợi, buildTrees mới thực sự dựng hình.
//   · createStreetNetwork trả về các tuyến đường mà createVehicles cần.
//   · createBuildings điền tâm các ô phố, createPedestrians đi theo mép
//     những ô đó nên phải chạy sau.
function buildScene() {
  createLights();
  createBaseMap();
  createStreetTrees();
  buildTrees();
  const roadPaths = createStreetNetwork();
  createSubwayLayer();
  createBuildings();
  createPedestrians();
  createLandmarks();
  createMarkers();
  return roadPaths;
}

function buildMovers(roadPaths) {
  createVehicles(roadPaths);
  createFerries();
  createPlanes();
  createClouds();
  createBirds();
}

function buildInterface() {
  createHaze();
  createLabels();
  renderAreaList();
  renderMiniMap();
  renderPinLegend();
  buildHereMarker();
  bindEvents();
  mountToolbar();
  readFilterFromUrl();
}

function init() {
  measureViewFit();
  applyLanguage({ silent: true });
  buildMovers(buildScene());
  buildInterface();
  // Kích thước nhãn được nhớ lại cho lượt dồn chỗ. Phông tải xong là chữ đổi
  // bề rộng, nên phải đo lại một lần nữa nếu không nhãn sẽ chồng nhau.
  if (document.fonts?.ready) document.fonts.ready.then(() => labelDims.clear());
  const initial = cameraDestination(AREA_BY_ID.all.focus);
  camera.position.copy(initial.position);
  controls.target.copy(initial.target);
  renderAreaDetail(AREA_BY_ID.all);
  updateUiState();
  // Liên kết sâu: mở thẳng vào địa điểm hoặc khu vực có trong đường dẫn.
  if (location.hash && location.hash !== "#/") applyHashFromLocation();
  animate();
}

/* ==========================================================================
   LỚP DỮ LIỆU SỐNG · LIVE DATA LAYER
   1) Google Sheet (Publish to web → CSV) làm CMS: sửa Sheet là bản đồ đổi theo.
   2) Open-Meteo: thời tiết + AQI Hà Nội thật đổ vào bầu trời, sương, mưa, đèn.
   Không backend, không API key. Mất mạng / link hỏng → im lặng dùng dữ liệu
   đóng gói sẵn, bản đồ không bao giờ trắng trang.
   Thử nhanh: ?wx=rain,night&aqi=180 · ?sheet=<link CSV đã publish>
   ========================================================================== */

const QUERY = new URLSearchParams(location.search);

/* ---------- 1) Google Sheet làm nguồn địa điểm ---------- */

// Dán link "File → Share → Publish to web → CSV" của Google Sheet vào đây.
// Để trống thì bản đồ dùng dữ liệu đóng gói trong src/data.js.
const LIVE_SHEET_URL = "";

function csvSourceUrl() {
  const raw = (QUERY.get("sheet") || LIVE_SHEET_URL || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Cho phép dán thẳng ID của Sheet (sheet để "Anyone with the link → Viewer").
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(raw)}/gviz/tq?tqx=out:csv`;
}

function stripDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normKey(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugifyId(value) {
  return (
    stripDiacritics(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "dia-diem"
  );
}

// CSV chuẩn RFC: xử lý ngoặc kép, dấu phẩy và xuống dòng trong ô.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Tên cột linh hoạt: tiếng Việt có dấu/không dấu/tiếng Anh đều nhận.
const HEADER_ALIASES = {
  id: ["id", "ma", "slug"],
  name: ["name", "ten", "tendiadiem", "diadiem", "place"],
  stage: ["stage", "nhom", "loai", "phanloai", "category"],
  area: ["area", "khu", "khuvuc", "vung"],
  lat: ["lat", "vido", "latitude"],
  lng: ["lng", "lon", "long", "kinhdo", "longitude"],
  sector: ["sector", "loaihinh", "kieu", "theloai"],
  office: ["office", "thongtin", "diemnhan", "fact", "ghichu"],
  price: ["price", "gia", "giathamkhao"],
  hours: ["hours", "giomo", "mocua", "giohoatdong"],
  address: ["address", "diachi"],
  website: ["website", "web", "link", "url"],
  blurb: ["blurb", "mota", "gioithieu", "description"],
  loc: ["loc", "vitri", "vitringan"],
  source: ["source", "nguon"],
};

function normalizeStage(raw) {
  const k = normKey(raw).replace(/[0-9]/g, "");
  if (["amthuc", "an", "food", "eat", "monan", "quanan", "cafe", "caphe"].includes(k)) return "Ẩm thực";
  if (["dulich", "choi", "travel", "tourism", "thamquan", "ditich", "vanhoa"].includes(k)) return "Du lịch";
  if (["bds", "batdongsan", "o", "nha", "realestate", "housing", "duan", "chungcu"].includes(k)) return "BĐS";
  return "Du lịch";
}

// Khu vực sai/thiếu → gán về khu có tâm camera gần nhất (trừ "all").
function nearestAreaId(lat, lng) {
  let best = "pho-co";
  let bestD = Infinity;
  for (const area of AREAS) {
    if (area.id === "all" || !area.focus) continue;
    const dx = (area.focus.lng - lng) * 1101;
    const dz = (area.focus.lat - lat) * 1180;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = area.id;
    }
  }
  return best;
}

const AREA_KEY_LOOKUP = (() => {
  const map = new Map();
  for (const area of AREAS) {
    for (const key of [area.id, area.label, area.shortLabel]) {
      if (key) map.set(normKey(key), area.id);
    }
  }
  return map;
})();

function rowsToPlaces(rows) {
  const [header, ...body] = rows;
  const colOf = {};
  (header || []).forEach((cell, index) => {
    const key = normKey(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (colOf[field] == null && aliases.includes(key)) colOf[field] = index;
    }
  });
  const pick = (row, field) => {
    const index = colOf[field];
    return index == null ? "" : String(row[index] ?? "").trim();
  };

  const places = [];
  const info = {};
  const used = new Set();
  let skipped = 0;

  for (const row of body) {
    const name = pick(row, "name");
    const lat = Number(pick(row, "lat").replace(",", "."));
    const lng = Number(pick(row, "lng").replace(",", "."));
    // Bỏ dòng thiếu tên/toạ độ hoặc rơi ra ngoài khung Hà Nội của bản đồ.
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20.9 || lat > 21.16 || lng < 105.68 || lng > 106.03) {
      skipped += 1;
      continue;
    }

    let id = slugifyId(pick(row, "id") || name);
    while (used.has(id)) id = `${id}-2`;
    used.add(id);

    const areaKey = AREA_KEY_LOOKUP.get(normKey(pick(row, "area")));
    const sourceRaw = normKey(pick(row, "source"));

    const place = {
      id,
      name,
      stage: normalizeStage(pick(row, "stage")),
      area: areaKey && areaKey !== "all" ? areaKey : nearestAreaId(lat, lng),
      lat,
      lng,
    };
    const sector = pick(row, "sector");
    const office = pick(row, "office");
    const price = pick(row, "price");
    const hours = pick(row, "hours");
    const address = pick(row, "address");
    const website = pick(row, "website");
    if (sector) place.sector = sector;
    if (office) place.office = office;
    if (price) place.price = price;
    if (hours) place.hours = hours;
    if (address) place.address = address;
    if (website) place.website = website;
    if (["approx", "xapxi", "gandung", "uocluong"].includes(sourceRaw)) place.source = "approx";
    places.push(place);

    const blurb = pick(row, "blurb");
    const loc = pick(row, "loc");
    if (blurb || loc) info[id] = { ...(blurb && { blurb }), ...(loc && { loc }) };
  }

  return { places, info, skipped };
}

function applyLivePlaces(places, info) {
  // Mảng/object export từ data.js được thay ruột tại chỗ TRƯỚC khi init()
  // chạy, nên marker, nhãn, mini map, đếm khu vực… đều dựng từ dữ liệu live.
  STARTUPS.length = 0;
  STARTUPS.push(...places);
  for (const key of Object.keys(COMPANY_INFO)) delete COMPANY_INFO[key];
  Object.assign(COMPANY_INFO, info);

  const sub = document.querySelector(".brand__sub");
  if (sub) sub.textContent = `${STARTUPS.length} địa điểm · ăn ᐧ chơi ᐧ ở`;
  if (searchInput) searchInput.placeholder = `Tìm ${STARTUPS.length} địa điểm: phở, di tích, dự án, khu vực…`;
  const allArea = AREA_BY_ID.all;
  if (allArea?.description)
    allArea.description = `${STARTUPS.length} địa điểm ẩm thực, du lịch và bất động sản — nạp trực tiếp từ Google Sheet. · ${STARTUPS.length} places to eat, explore, and live — loaded live from a Google Sheet.`;
}

async function bootLivePlaces() {
  const src = csvSourceUrl();
  if (!src) return;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const res = await fetch(src, { cache: "no-store", redirect: "follow", signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/<html/i.test(text.slice(0, 400))) throw new Error("Nhận về HTML thay vì CSV — Sheet chưa Publish to web?");
    const { places, info, skipped } = rowsToPlaces(parseCsv(text));
    if (places.length < 3) throw new Error(`chỉ ${places.length} dòng hợp lệ (bỏ qua ${skipped})`);
    applyLivePlaces(places, info);
    window.__liveData = { source: src, places: places.length, skipped };
    console.info(`[HanoiAtlas] Sheet live: ${places.length} địa điểm (bỏ qua ${skipped} dòng).`);
  } catch (error) {
    window.__liveData = { source: src, error: String(error) };
    console.warn("[HanoiAtlas] Không nạp được Sheet, dùng dữ liệu đóng gói.", error);
  }
}

/* ---------- 2) Thời tiết + AQI Hà Nội thật ---------- */

// animate() đọc fogMul mỗi khung hình (nhân đè lên fog easing rồi trả lại).
const liveEnv = { fogMul: 1 };

// Mỗi chế độ trời: gradient trời, màu + hệ số sương, đèn, phơi sáng, mây, nước.
const ENV_PRESETS = {
  clear: { sky: ["#6fa8d6", "#9cc7e6", "#cfe6f2", "#e4f0f6"], fog: "#cfe6f2", fogMul: 1, sun: 1, hemi: 1, exp: 1.05, glow: 0.85, cloud: ["#f4f1e8", 0.72], water: 1, haze: 0.55 },
  partly: { sky: ["#7dabd2", "#a3c6e0", "#ccdfe9", "#dfeaf0"], fog: "#ccdfe9", fogMul: 1.06, sun: 0.82, hemi: 0.9, exp: 1.02, glow: 0.6, cloud: ["#eef0ee", 0.8], water: 0.95, haze: 0.55 },
  overcast: { sky: ["#8d9aa6", "#aab4bd", "#c9d0d5", "#d8dde0"], fog: "#c9d0d5", fogMul: 1.14, sun: 0.42, hemi: 0.78, exp: 0.98, glow: 0.15, cloud: ["#b9c0c7", 0.88], water: 0.82, haze: 0.5 },
  rain: { sky: ["#6d7a87", "#8b96a1", "#b3bcc3", "#c5ccd1"], fog: "#b8c0c7", fogMul: 1.3, sun: 0.32, hemi: 0.66, exp: 0.92, glow: 0, cloud: ["#8e979f", 0.92], water: 0.7, haze: 0.4, rain: 1 },
  storm: { sky: ["#525f6d", "#707c88", "#98a2ab", "#aab3ba"], fog: "#9aa4ad", fogMul: 1.45, sun: 0.22, hemi: 0.55, exp: 0.88, glow: 0, cloud: ["#79828b", 0.95], water: 0.6, haze: 0.35, rain: 1.4 },
  fog: { sky: ["#a8b4bc", "#c2ccd2", "#dde3e6", "#e8ecee"], fog: "#dde3e6", fogMul: 1.85, sun: 0.4, hemi: 0.82, exp: 1, glow: 0.1, cloud: ["#d8dde2", 0.5], water: 0.85, haze: 0.7 },
  dusk: { sky: ["#41517a", "#7a6f93", "#d99a6c", "#f0c898"], fog: "#e3bd93", fogMul: 1.08, sun: 0.75, hemi: 0.7, exp: 1, glow: 0.95, cloud: ["#e8c9a8", 0.7], water: 0.85, haze: 0.45, sunColor: "#ffb37a", hemiSky: "#c9b8d9" },
  night: { sky: ["#0d1626", "#15233c", "#2a3a55", "#3a4a63"], fog: "#1c2534", fogMul: 1.05, sun: 0.1, hemi: 0.44, exp: 0.88, glow: 0, cloud: ["#2a3345", 0.5], water: 0.42, haze: 0.15, sunColor: "#a9c2ff", hemiSky: "#93a9d0", hemiGround: "#241f28", nightGlow: 1 },
  "night-rain": { sky: ["#0b121d", "#121c2b", "#232f40", "#2e3a4a"], fog: "#1a2230", fogMul: 1.35, sun: 0.08, hemi: 0.4, exp: 0.86, glow: 0, cloud: ["#232c3a", 0.6], water: 0.4, haze: 0.12, sunColor: "#a9c2ff", hemiSky: "#93a9d0", hemiGround: "#241f28", rain: 1, nightGlow: 1 },
};

const AQI_TINT = new THREE.Color("#b7a98c");

function makeLiveSky(stops) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.45, stops[1]);
  grad.addColorStop(0.8, stops[2]);
  grad.addColorStop(1, stops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// VN_AQI → hệ số sương + màu chấm + nhãn. Màu lấy đúng mã RGB trong Bảng 1
// của Quyết định 1459, để chấm trên huy hiệu trùng màu với bản tin chính
// thức và các bảng điện tử ngoài đường.
const AQI_FOG = { aqiGood: 0.92, aqiFair: 1, aqiPoor: 1.18, aqiBad: 1.4, aqiVeryBad: 1.65, aqiHazard: 1.9 };

function aqiInfo(aqi) {
  const band = vnAqiBand(aqi);
  if (!band) return { mul: 1, color: "#8fa3b8", key: null, band: null };
  return { mul: AQI_FOG[band.key] ?? 1, color: band.color, key: band.key, band };
}

// Chế độ trời → chữ hiển thị trên huy hiệu, theo ngôn ngữ đang chọn.
const WX_KEY = {
  clear: "wxClear",
  partly: "wxPartly",
  overcast: "wxOvercast",
  rain: "wxRain",
  drizzle: "wxDrizzle",
  storm: "wxStorm",
  fog: "wxFog",
  dusk: "wxDusk",
  night: "wxNight",
  "night-rain": "wxNightRain",
};

function wxText(env) {
  const key = WX_KEY[env.drizzle ? "drizzle" : env.mode];
  return key ? t(key) : env.desc || "";
}

let rainPoints = null;
let rainSpeeds = null;

function ensureRain(intensity) {
  if (!intensity) {
    if (rainPoints) rainPoints.visible = false;
    return;
  }
  if (!rainPoints) {
    const count = smallScreen ? 850 : 1500;
    const positions = new Float32Array(count * 3);
    rainSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -96 + Math.random() * 192;
      positions[i * 3 + 1] = Math.random() * 52;
      positions[i * 3 + 2] = -86 + Math.random() * 152;
      rainSpeeds[i] = 20 + Math.random() * 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    rainPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xaebfcf, size: 0.085, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    rainPoints.frustumCulled = false;
    rainPoints.renderOrder = 6;
    scene.add(rainPoints);
  }
  rainPoints.visible = true;
  rainPoints.material.opacity = intensity >= 1.4 ? 0.62 : 0.48;
}

function updateRain(delta) {
  if (!rainPoints || !rainPoints.visible) return;
  const pos = rainPoints.geometry.attributes.position;
  const arr = pos.array;
  for (let i = 0; i < rainSpeeds.length; i += 1) {
    const ix = i * 3;
    arr[ix + 1] -= rainSpeeds[i] * delta;
    arr[ix] += delta * 2.2; // gió xiên nhẹ
    if (arr[ix + 1] < 0.4) {
      arr[ix + 1] = 46 + Math.random() * 8;
      arr[ix] = -96 + Math.random() * 192;
      arr[ix + 2] = -86 + Math.random() * 152;
    } else if (arr[ix] > 96) arr[ix] = -96;
  }
  pos.needsUpdate = true;
}

function applyEnvironment(env) {
  const p = ENV_PRESETS[env.mode] || ENV_PRESETS.clear;
  const aqi = aqiInfo(env.aqi);

  const oldSky = scene.background;
  scene.background = makeLiveSky(p.sky);
  if (oldSky?.dispose) oldSky.dispose();

  const fogColor = new THREE.Color(p.fog);
  // AQI cao nhuộm sương ngả nâu vàng (ban ngày) — đúng chất trời bụi Hà Nội.
  if (!p.nightGlow) fogColor.lerp(AQI_TINT, Math.min(0.45, Math.max(0, (aqi.mul - 1) * 0.55)));
  scene.fog.color.copy(fogColor);
  liveEnv.fogMul = Math.min(2.3, Math.max(0.85, p.fogMul * aqi.mul));

  renderer.toneMappingExposure = p.exp;

  scene.traverse((obj) => {
    if (obj.isDirectionalLight) {
      obj.intensity = 3.45 * p.sun;
      obj.color.set(p.sunColor || "#ffedc9");
    } else if (obj.isHemisphereLight) {
      obj.intensity = 2.75 * p.hemi;
      obj.color.set(p.hemiSky || "#dbefff");
      obj.groundColor.set(p.hemiGround || "#4a4335");
    } else if (obj.isSprite && obj.scale.x > 100) {
      obj.material.opacity = 0.85 * p.glow; // vầng mặt trời
    } else if (obj.isMesh && obj.renderOrder === 4 && obj.material?.map && obj.material.transparent) {
      obj.material.opacity = p.haze; // các thảm haze rìa bản đồ
    }
  });

  // Mây đổi màu theo trời.
  scene.children.forEach((child) => {
    const mat = child.userData.speed ? child.children[0]?.material : null;
    if (mat) {
      mat.color.set(p.cloud[0]);
      mat.opacity = p.cloud[1];
    }
  });

  // Mặt nước tối dần theo trời (giữ màu gốc để phục hồi).
  const waterMats = new Set([materials.water, materials.river, materials.pond]);
  waterSurfaces.forEach((w) => waterMats.add(w.material));
  waterMats.forEach((mat) => {
    if (!mat) return;
    if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
    mat.color.copy(mat.userData.baseColor).multiplyScalar(p.water);
  });

  // Đêm: kính các tháp Keangnam/Lotte/Landmark hắt sáng như thật.
  if (p.nightGlow) {
    towerGlass.emissive.setHex(0x3d6a94);
    towerGlass.emissiveIntensity = 2.0;
  } else {
    towerGlass.emissive.setHex(0x0d1e2a);
    towerGlass.emissiveIntensity = 1;
  }

  ensureRain(p.rain || 0);
  setNightLights(Boolean(p.nightGlow));
}

/* ---------- Huy hiệu thời tiết trên HUD ---------- */

let liveBadgeEl = null;
let lastEnv = null;

function renderLiveBadge(env) {
  // Giữ lại trạng thái cuối để bảng chi tiết không khí đọc được, và để đổi
  // ngôn ngữ thì vẽ lại đúng số liệu chứ không phải chờ lượt gọi mạng sau.
  liveEnv.env = env;
  lastEnv = env;
  if (!liveBadgeEl) {
    const style = document.createElement("style");
    style.textContent = `
.live-badge{display:inline-flex;align-items:center;gap:.42rem;padding:.4rem .72rem;border-radius:999px;background:rgba(11,16,23,.58);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.14);color:#e9eff6;font-size:.74rem;letter-spacing:.01em;white-space:nowrap;pointer-events:auto;user-select:none;-webkit-user-select:none}
.live-badge__dot{width:.52rem;height:.52rem;border-radius:50%;flex:none;box-shadow:0 0 7px 0 currentColor}
.live-badge__aqi{font-variant-numeric:tabular-nums;opacity:.92}
.live-badge__demo{font-size:.62rem;opacity:.65;border:1px solid rgba(255,255,255,.25);border-radius:.5rem;padding:.05rem .3rem}
@media (max-width:54rem){.live-badge__txt{display:none}}
`;
    document.head.appendChild(style);
    liveBadgeEl = document.createElement("div");
    liveBadgeEl.className = "live-badge";
    liveBadgeEl.setAttribute("role", "status");
    // Huy hiệu thời tiết cũng là cửa vào bảng nguồn: trên điện thoại thanh
    // bên bị ẩn nên đây là chỗ luôn chạm tới được.
    liveBadgeEl.tabIndex = 0;
    liveBadgeEl.style.cursor = "pointer";
    liveBadgeEl.addEventListener("click", () => openAir());
    liveBadgeEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAir();
      }
    });
    const host = document.querySelector(".hud-top-right");
    if (host) host.prepend(liveBadgeEl);
    else document.body.appendChild(liveBadgeEl);
  }
  const aqi = aqiInfo(env.aqi);
  const temp = Number.isFinite(env.temp) ? `${env.temp}° ` : "";
  liveBadgeEl.innerHTML = `
    <span class="live-badge__ico">${env.icon}</span>
    <span class="live-badge__txt">${escapeHtml(`${temp}${wxText(env)}`)}</span>
    ${env.aqi != null ? `<span class="live-badge__dot" style="background:${aqi.color};color:${aqi.color}"></span><span class="live-badge__aqi">AQI ${Math.round(env.aqi)}</span>` : ""}
    ${env.demo ? `<span class="live-badge__demo">demo</span>` : ""}
  `;
  liveBadgeEl.title = [
    env.demo ? t("wxDemo") : t("wxTitle"),
    Number.isFinite(env.humidity) ? t("wxHumidity", { v: env.humidity }) : null,
    Number.isFinite(env.wind) && env.wind > 0 ? t("wxWind", { v: env.wind }) : null,
    env.aqi != null && aqi.key ? `US AQI ${Math.round(env.aqi)} — ${t(aqi.key)}` : null,
    env.demo ? null : t("wxSource"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ==========================================================================
   CHỈ SỐ CHẤT LƯỢNG KHÔNG KHÍ VIỆT NAM · VN_AQI
   Nguồn duy nhất: Quyết định 1459/QĐ-TCMT ngày 12/11/2019 của Tổng cục Môi
   trường. Bảng phân mức, bảng BPi, công thức nội suy và toàn bộ khuyến cáo
   dưới đây lấy nguyên từ văn bản đó.

   Vì sao phải tự tính thay vì lấy con số có sẵn: Open-Meteo trả về US AQI,
   tính theo mốc của Mỹ. Cùng một bầu không khí, hai thang cho hai con số
   khác hẳn nhau — sáng nay Hà Nội là 93 theo thang Mỹ nhưng 64 theo thang
   Việt Nam. Người Việt đọc báo, xem bản tin đều thấy VN_AQI, nên hiện số Mỹ
   mà chỉ đề "AQI" là đánh lừa người đọc, dù không cố ý.

   Bản đồ tính AQI NGÀY (AQId) chứ không phải AQI giờ. Lý do: AQI ngày được
   quyết định quy định đầy đủ bằng lời — trung bình 24 giờ với bụi, giá trị
   1 giờ lớn nhất trong ngày với khí — nên làm theo được chính xác. AQI giờ
   thì cần hệ số Nowcast mà văn bản in dưới dạng công thức ảnh, không chép
   lại chắc chắn được. Thà đúng một chỉ số còn hơn đoán hai.
   ========================================================================== */

// Bảng 2 của quyết định. Đơn vị µg/m³ cho tất cả, kể cả CO.
const VNAQI_LEVELS = [0, 50, 100, 150, 200, 300, 400, 500];
const VNAQI_BP = {
  o3_1h: [0, 160, 200, 300, 400, 800, 1000, 1200],
  o3_8h: [0, 100, 120, 170, 210, 400, null, null],
  co: [0, 10000, 30000, 45000, 60000, 90000, 120000, 150000],
  so2: [0, 125, 350, 550, 800, 1600, 2100, 2630],
  no2: [0, 100, 200, 700, 1200, 2350, 3100, 3850],
  pm10: [0, 50, 150, 250, 350, 420, 500, 600],
  pm25: [0, 25, 50, 80, 150, 250, 350, 500],
};

// Công thức 1: nội suy tuyến tính giữa hai mốc kề nhau.
function vnAqiOf(value, key) {
  const bp = VNAQI_BP[key];
  if (!bp || !Number.isFinite(value) || value < 0) return null;
  for (let i = 0; i < bp.length - 1; i += 1) {
    const lo = bp[i];
    const hi = bp[i + 1];
    if (hi == null) break;
    if (value <= hi) {
      const iLo = VNAQI_LEVELS[i];
      const iHi = VNAQI_LEVELS[i + 1];
      return Math.round(((iHi - iLo) / (hi - lo)) * (value - lo) + iLo);
    }
  }
  return 500; // vượt mốc cuối cùng thì kịch thang
}

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// Trung bình trượt 8 giờ, lấy giá trị lớn nhất trong ngày — dùng cho O3.
function maxRollingMean(values, span) {
  let best = null;
  for (let i = 0; i + span <= values.length; i += 1) {
    const window = values.slice(i, i + span).filter(Number.isFinite);
    if (window.length < span) continue;
    const avg = mean(window);
    if (best == null || avg > best) best = avg;
  }
  return best;
}

// AQI ngày: bụi lấy trung bình 24 giờ, khí lấy giá trị 1 giờ lớn nhất trong
// ngày, O3 lấy cả 1 giờ lớn nhất lẫn 8 giờ lớn nhất. Kết quả là giá trị lớn
// nhất trong các thông số, và thông số nào lớn nhất thì đó là thủ phạm.
function vnAqiDaily(series) {
  const clean = (arr) => (arr || []).filter((v) => Number.isFinite(v));
  const pm25 = clean(series.pm25);
  const pm10 = clean(series.pm10);
  // Quyết định bắt buộc phải có ít nhất một trong hai thông số bụi.
  if (!pm25.length && !pm10.length) return null;

  const parts = [
    { key: "pm25", label: "PM2.5", aqi: pm25.length ? vnAqiOf(mean(pm25), "pm25") : null },
    { key: "pm10", label: "PM10", aqi: pm10.length ? vnAqiOf(mean(pm10), "pm10") : null },
    { key: "so2", label: "SO₂", aqi: clean(series.so2).length ? vnAqiOf(Math.max(...clean(series.so2)), "so2") : null },
    { key: "no2", label: "NO₂", aqi: clean(series.no2).length ? vnAqiOf(Math.max(...clean(series.no2)), "no2") : null },
    { key: "co", label: "CO", aqi: clean(series.co).length ? vnAqiOf(Math.max(...clean(series.co)), "co") : null },
    { key: "o3_1h", label: "O₃ (1h)", aqi: clean(series.o3).length ? vnAqiOf(Math.max(...clean(series.o3)), "o3_1h") : null },
    { key: "o3_8h", label: "O₃ (8h)", aqi: (() => { const m = maxRollingMean(series.o3 || [], 8); return m == null ? null : vnAqiOf(m, "o3_8h"); })() },
  ].filter((p) => p.aqi != null);

  if (!parts.length) return null;
  const worst = parts.reduce((a, b) => (b.aqi > a.aqi ? b : a));
  return {
    aqi: worst.aqi,
    driver: worst.label,
    pm25Avg: pm25.length ? Math.round(mean(pm25) * 10) / 10 : null,
    parts,
  };
}

// Bảng 1, 4 và 5 của quyết định. Màu lấy đúng mã RGB trong văn bản. Phần
// khuyến cáo giữ nguyên văn tiếng Việt; bản tiếng Anh chỉ là dịch tham khảo.
const VNAQI_BANDS = [
  {
    max: 50,
    key: "aqiGood",
    color: "rgb(0,228,0)",
    effect: "Chất lượng không khí tốt, không ảnh hưởng tới sức khỏe.",
    effectEn: "Air quality is good and does not affect health.",
    normal: "Tự do thực hiện các hoạt động ngoài trời.",
    normalEn: "Outdoor activities without restriction.",
    sensitive: "Tự do thực hiện các hoạt động ngoài trời.",
    sensitiveEn: "Outdoor activities without restriction.",
  },
  {
    max: 100,
    key: "aqiFair",
    color: "rgb(255,255,0)",
    effect:
      "Chất lượng không khí ở mức chấp nhận được. Tuy nhiên, đối với những người nhạy cảm (người già, trẻ em, người mắc các bệnh hô hấp, tim mạch…) có thể chịu những tác động nhất định tới sức khỏe.",
    effectEn:
      "Air quality is acceptable. Sensitive people — the elderly, children, those with respiratory or heart conditions — may still feel some effects.",
    normal: "Tự do thực hiện các hoạt động ngoài trời.",
    normalEn: "Outdoor activities without restriction.",
    sensitive: "Nên theo dõi các triệu chứng như ho hoặc khó thở, nhưng vẫn có thể hoạt động bên ngoài.",
    sensitiveEn: "Watch for symptoms such as coughing or shortness of breath, but outdoor activity is still fine.",
  },
  {
    max: 150,
    key: "aqiPoor",
    color: "rgb(255,126,0)",
    effect: "Những người nhạy cảm gặp phải các vấn đề về sức khỏe, những người bình thường ít ảnh hưởng.",
    effectEn: "Sensitive groups experience health effects; the general public is affected little.",
    normal:
      "Những người thấy có triệu chứng đau mắt, ho hoặc đau họng… nên cân nhắc giảm các hoạt động ngoài trời. Đối với học sinh, có thể hoạt động bên ngoài, nhưng nên giảm bớt việc tập thể dục kéo dài.",
    normalEn:
      "Anyone with sore eyes, a cough or a sore throat should consider cutting back outdoor activity. Schoolchildren may stay outside but should do less prolonged exercise.",
    sensitive:
      "Nên giảm các hoạt động mạnh và giảm thời gian hoạt động ngoài trời. Những người mắc bệnh hen suyễn có thể cần sử dụng thuốc thường xuyên hơn.",
    sensitiveEn:
      "Reduce strenuous activity and time spent outdoors. People with asthma may need their medication more often.",
  },
  {
    max: 200,
    key: "aqiBad",
    color: "rgb(255,0,0)",
    effect:
      "Những người bình thường bắt đầu có các ảnh hưởng tới sức khỏe, nhóm người nhạy cảm có thể gặp những vấn đề sức khỏe nghiêm trọng hơn.",
    effectEn:
      "The general public begins to feel health effects; sensitive groups may face more serious problems.",
    normal: "Mọi người nên giảm các hoạt động mạnh khi ở ngoài trời, tránh tập thể dục kéo dài và nghỉ ngơi nhiều hơn trong nhà.",
    normalEn: "Everyone should ease off strenuous outdoor activity, avoid prolonged exercise and rest more indoors.",
    sensitive: "Nên ở trong nhà và giảm hoạt động mạnh. Nếu cần thiết phải ra ngoài, hãy đeo khẩu trang đạt tiêu chuẩn.",
    sensitiveEn: "Stay indoors and reduce strenuous activity. If you must go out, wear a properly rated mask.",
  },
  {
    max: 300,
    key: "aqiVeryBad",
    color: "rgb(143,63,151)",
    effect: "Cảnh báo hưởng tới sức khỏe: mọi người bị ảnh hưởng tới sức khỏe nghiêm trọng hơn.",
    effectEn: "Health alert: everyone is affected more seriously.",
    normal:
      "Mọi người hạn chế tối đa các hoạt động ngoài trời và chuyển tất cả các hoạt động vào trong nhà. Nếu cần thiết phải ra ngoài, hãy đeo khẩu trang đạt tiêu chuẩn.",
    normalEn:
      "Keep outdoor activity to a minimum and move everything indoors. If you must go out, wear a properly rated mask.",
    sensitive: "Nên ở trong nhà và giảm hoạt động mạnh.",
    sensitiveEn: "Stay indoors and reduce strenuous activity.",
  },
  {
    max: 500,
    key: "aqiHazard",
    color: "rgb(126,0,35)",
    effect: "Cảnh báo khẩn cấp về sức khỏe: Toàn bộ dân số bị ảnh hưởng tới sức khỏe tới mức nghiêm trọng.",
    effectEn: "Health emergency: the entire population is seriously affected.",
    normal: "Mọi người nên ở trong nhà, đóng cửa ra vào và cửa sổ. Nếu cần thiết phải ra ngoài, hãy đeo khẩu trang đạt tiêu chuẩn.",
    normalEn: "Everyone should stay indoors with doors and windows shut. If you must go out, wear a properly rated mask.",
    sensitive: "Mọi người nên ở trong nhà, đóng cửa ra vào và cửa sổ. Nếu cần thiết phải ra ngoài, hãy đeo khẩu trang đạt tiêu chuẩn.",
    sensitiveEn: "Everyone should stay indoors with doors and windows shut. If you must go out, wear a properly rated mask.",
  },
];

function vnAqiBand(aqi) {
  if (aqi == null || !Number.isFinite(Number(aqi))) return null;
  const v = Number(aqi);
  return VNAQI_BANDS.find((b) => v <= b.max) || VNAQI_BANDS[VNAQI_BANDS.length - 1];
}


/* ---------- Bảng chi tiết chất lượng không khí ---------- */

let airDialog = null;
let airReturnHash = "";

function ensureAirDialog() {
  if (airDialog) return airDialog;
  airDialog = document.createElement("dialog");
  airDialog.id = "airSheet";
  airDialog.className = "src-sheet";
  airDialog.setAttribute("aria-label", t("airTitle"));
  airDialog.addEventListener("close", () => {
    if (location.hash === "#/khong-khi") {
      history.replaceState(null, "", `${location.pathname}${location.search}${airReturnHash}`);
    }
  });
  airDialog.addEventListener("click", (event) => {
    if (event.target === airDialog) airDialog.close();
  });
  document.body.appendChild(airDialog);
  return airDialog;
}

function renderAir() {
  const dialog = ensureAirDialog();
  const env = liveEnv.env;
  const band = vnAqiBand(env?.aqi);
  const pick = (item, key) => (LANG === "en" ? (item[`${key}En`] ?? item[key]) : item[key]);

  if (!band) {
    dialog.innerHTML = `<div class="src-sheet__head"><h2>${escapeHtml(t("airTitle"))}</h2>
      <button class="src-sheet__close" type="button">${escapeHtml(t("srcClose"))}</button></div>
      <p class="src-sheet__lead">${escapeHtml(t("airNone"))}</p>`;
  } else {
    const scale = VNAQI_BANDS.map((b) => {
      const on = b === band;
      const lo = VNAQI_BANDS.indexOf(b) === 0 ? 0 : VNAQI_BANDS[VNAQI_BANDS.indexOf(b) - 1].max + 1;
      return `<li class="air-scale__item${on ? " is-now" : ""}"><i style="background:${b.color}"></i>` +
        `<b>${lo}–${b.max}</b><span>${escapeHtml(t(b.key))}</span></li>`;
    }).join("");

    const parts = (env.aqiDriver ? `<p class="air-driver">${escapeHtml(t("airDriver", { p: env.aqiDriver }))}</p>` : "");
    const pm = env.pm25Avg != null
      ? `<p class="air-pm">${escapeHtml(t("airPm", { avg: env.pm25Avg, now: env.pm25Now != null ? Math.round(env.pm25Now * 10) / 10 : "—" }))}</p>`
      : "";
    const us = env.usAqi != null
      ? `<p class="src-sheet__gapnote">${escapeHtml(t("airVsUs", { us: Math.round(env.usAqi), vn: env.aqi }))}</p>`
      : "";

    dialog.innerHTML = `
      <div class="src-sheet__head">
        <h2>${escapeHtml(t("airTitle"))}</h2>
        <button class="src-sheet__close" type="button">${escapeHtml(t("srcClose"))}</button>
      </div>
      <div class="air-now" style="--band:${band.color}">
        <b>${env.aqi}</b>
        <span>${escapeHtml(t(band.key))}</span>
        <small>${escapeHtml(t("airWhat"))}</small>
      </div>
      ${env.demo ? `<p class="src-sheet__gapnote">${escapeHtml(t("wxDemo"))}</p>` : ""}
      ${parts}
      ${pm}
      <ul class="air-scale">${scale}</ul>
      <article class="air-block">
        <h3>${escapeHtml(t("airEffect"))}</h3>
        <p>${escapeHtml(pick(band, "effect"))}</p>
      </article>
      <article class="air-block">
        <h3>${escapeHtml(t("airNormal"))}</h3>
        <p>${escapeHtml(pick(band, "normal"))}</p>
      </article>
      <article class="air-block air-block--sensitive">
        <h3>${escapeHtml(t("airSensitive"))}</h3>
        <p>${escapeHtml(pick(band, "sensitive"))}</p>
        <small>${escapeHtml(t("airWho"))}</small>
      </article>
      ${LANG === "en" ? `<p class="src-sheet__gapnote">${escapeHtml(t("airEnNote"))}</p>` : ""}
      ${us}
      <p class="map-note__srcs">${escapeHtml(t("srcSee"))}: ${sourceLinkHtml("qd-1459-2019")} ${sourceLinkHtml("open-meteo")}
        <a class="map-note__src" href="#/nguon" data-sources>${escapeHtml(t("srcBadge"))} <span aria-hidden="true">↗</span></a></p>`;
  }
  dialog.querySelector(".src-sheet__close")?.addEventListener("click", () => dialog.close());
}

function openAir() {
  ensureAirDialog();
  renderAir();
  if (!airDialog.open) {
    airReturnHash = location.hash === "#/khong-khi" ? "" : location.hash;
    airDialog.showModal();
    if (location.hash !== "#/khong-khi") {
      history.replaceState(null, "", `${location.pathname}${location.search}#/khong-khi`);
    }
  }
}

/* ---------- Gọi Open-Meteo (miễn phí, không key, có CORS) ---------- */

// Mã thời tiết WMO + ngày/đêm → chế độ trời của bản đồ.
function classifyWeather(code, isDay) {
  const rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const storm = code >= 95;
  const foggy = code === 45 || code === 48;
  if (!isDay) {
    if (rain || storm) return { mode: "night-rain", desc: storm ? "Đêm mưa dông" : "Đêm mưa", icon: "🌧" };
    return { mode: "night", desc: foggy ? "Đêm sương mù" : "Đêm quang", icon: "🌙" };
  }
  if (storm) return { mode: "storm", desc: "Mưa dông", icon: "⛈" };
  if (rain) return { mode: "rain", drizzle: code <= 57, desc: code <= 57 ? "Mưa phùn" : "Mưa", icon: "🌧" };
  if (foggy) return { mode: "fog", desc: "Sương mù", icon: "🌫" };
  if (code >= 3) return { mode: "overcast", desc: "Nhiều mây", icon: "☁️" };
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date()),
  );
  if (hour >= 17 && hour < 19) return { mode: "dusk", desc: "Hoàng hôn", icon: "🌇" };
  if (code >= 1) return { mode: "partly", desc: "Ít mây", icon: "🌤" };
  return { mode: "clear", desc: "Trời quang", icon: "☀️" };
}

// Cắt ra 24 giờ gần nhất tính tới giờ hiện tại. Open-Meteo trả cả dự báo
// tương lai nên phải tìm đúng mốc "bây giờ" rồi lùi lại — lấy 24 phần tử
// cuối mảng là ăn phải số liệu của ngày mai, mà số liệu ngày mai thì chưa
// xảy ra nên đưa vào trung bình 24 giờ là sai hẳn.
//
// Không dùng indexOf: nếu mốc hiện tại vì lý do nào đó không có trong mảng
// thì indexOf trả -1 và ta lại rơi vào đúng cái bẫy dự báo tương lai. Thay
// vào đó quét lấy mốc cuối cùng không vượt quá hiện tại — cách này đúng cả
// khi khớp chính xác lẫn khi lệch.
function hourIndexAt(times, nowIso) {
  if (!times.length) return -1;
  const mark = nowIso || new Date().toISOString().slice(0, 13);
  let found = -1;
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] <= mark) found = i;
    else break;
  }
  return found >= 0 ? found : 0;
}

function last24h(hourly, key, nowIndex) {
  const values = hourly?.[key] || [];
  return values
    .slice(Math.max(0, nowIndex - 23), nowIndex + 1)
    .map((v) => (v == null ? NaN : Number(v)));
}

async function fetchLiveWeather() {
  const base = "latitude=21.03&longitude=105.85&timezone=Asia%2FBangkok";
  const pollutants = "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone";
  const [wx, aq] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${base}&current=temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m`).then((r) => r.json()),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${base}&past_days=1&current=pm2_5,us_aqi&hourly=${pollutants}`)
      .then((r) => r.json())
      .catch(() => null),
  ]);
  const cur = wx?.current;
  if (!cur) return null;
  const cls = classifyWeather(Number(cur.weather_code ?? 0), cur.is_day === 1);

  // Tự tính VN_AQI theo Quyết định 1459 thay vì dùng us_aqi có sẵn.
  let air = null;
  if (aq?.hourly?.time?.length) {
    const at = hourIndexAt(aq.hourly.time, aq?.current?.time);
    air = vnAqiDaily({
      pm25: last24h(aq.hourly, "pm2_5", at),
      pm10: last24h(aq.hourly, "pm10", at),
      co: last24h(aq.hourly, "carbon_monoxide", at),
      no2: last24h(aq.hourly, "nitrogen_dioxide", at),
      so2: last24h(aq.hourly, "sulphur_dioxide", at),
      o3: last24h(aq.hourly, "ozone", at),
    });
  }

  return {
    ...cls,
    temp: Math.round(cur.temperature_2m),
    humidity: Math.round(cur.relative_humidity_2m ?? NaN),
    wind: Math.round(cur.wind_speed_10m ?? NaN),
    aqi: air?.aqi ?? null,
    aqiDriver: air?.driver ?? null,
    pm25Now: aq?.current?.pm2_5 ?? null,
    pm25Avg: air?.pm25Avg ?? null,
    usAqi: aq?.current?.us_aqi ?? null,
  };
}

function bootWeather() {
  const wxParam = QUERY.get("wx");
  const aqiParam = QUERY.get("aqi");

  // ?wx=rain,night&aqi=180 — xem trước mọi chế độ trời không cần chờ trời thật.
  if (wxParam !== null || aqiParam !== null) {
    const flags = new Set(
      (wxParam || "")
        .split(",")
        .map((s) => normKey(s))
        .filter(Boolean),
    );
    const night = flags.has("night") || flags.has("dem");
    const rain = flags.has("rain") || flags.has("mua");
    const storm = flags.has("storm") || flags.has("dong");
    let mode = "clear";
    if (night) mode = rain || storm ? "night-rain" : "night";
    else if (storm) mode = "storm";
    else if (rain) mode = "rain";
    else if (flags.has("fog") || flags.has("suong") || flags.has("suongmu")) mode = "fog";
    else if (flags.has("overcast") || flags.has("may")) mode = "overcast";
    else if (flags.has("dusk") || flags.has("hoanghon")) mode = "dusk";
    else if (flags.has("partly")) mode = "partly";
    const LABELS = {
      clear: ["Trời quang", "☀️"],
      partly: ["Ít mây", "🌤"],
      overcast: ["Nhiều mây", "☁️"],
      rain: ["Mưa", "🌧"],
      storm: ["Mưa dông", "⛈"],
      fog: ["Sương mù", "🌫"],
      dusk: ["Hoàng hôn", "🌇"],
      night: ["Đêm quang", "🌙"],
      "night-rain": ["Đêm mưa", "🌧"],
    };
    const env = {
      mode,
      desc: LABELS[mode][0],
      icon: LABELS[mode][1],
      temp: NaN,
      humidity: NaN,
      wind: NaN,
      aqi: aqiParam != null && aqiParam !== "" ? Number(aqiParam) : null,
      demo: true,
    };
    applyEnvironment(env);
    renderLiveBadge(env);
    return;
  }

  const tick = () => {
    fetchLiveWeather()
      .then((env) => {
        if (!env) return;
        applyEnvironment(env);
        renderLiveBadge(env);
      })
      .catch(() => {}); // mất mạng → giữ nguyên trời hiện tại
  };
  tick();
  setInterval(tick, 15 * 60 * 1000);
}

/* ---------- Icon dự phòng cho địa điểm mới thêm từ Sheet ---------- */

const CATEGORY_ICON = { "Ẩm thực": "_cat-am-thuc", "Du lịch": "_cat-du-lich", BĐS: "_cat-bds" };

// Ảnh /logos/<id>.svg chưa tồn tại (địa điểm mới) → rơi về icon nhóm.
document.addEventListener(
  "error",
  (event) => {
    const el = event.target;
    if (!(el instanceof HTMLImageElement)) return;
    if (!/(?:marker-label__logo|detail-card__logo|search-result__logo|map-pin__logo)/.test(el.className)) return;
    const stage = el.dataset.stage || el.closest("[data-stage]")?.dataset.stage || "";
    const fallback = `/logos/${CATEGORY_ICON[stage] || "_cat-default"}.svg`;
    if (el.src.endsWith(fallback)) return; // icon nhóm cũng hỏng thì dừng, tránh lặp vô hạn
    el.src = fallback;
  },
  true,
);

/* ==========================================================================
   TIỆN ÍCH HẰNG NGÀY · EVERYDAY TOOLS
   1) Nút VI | EN đổi toàn bộ giao diện và mô tả địa điểm.
   2) Chip Ăn / Chơi / Ở lọc pin ngay trên bản đồ, chia sẻ được cả link đã lọc.
   3) "Gần tôi": định vị GPS, khoảng cách tới từng nơi, nút Chỉ đường.
   4) Đèn đường – đèn nhà – đèn cầu khi trời tối.
   5) Khung hình tự co theo tỉ lệ màn hình (điện thoại dọc nhìn được cả thành phố).
   ========================================================================== */

/* ---------- 1) Ngôn ngữ ---------- */

const LANG_KEY = "hanoi-atlas:lang";

function readLang() {
  const asked = (QUERY.get("lang") || "").toLowerCase();
  if (asked === "vi" || asked === "en") return asked;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language || "vi"];
  return tags.some((tag) => /^vi\b/i.test(tag)) ? "vi" : "en";
}

let LANG = readLang();

const STRINGS = {
  vi: {
    title: "Hà Nội Atlas — Bản đồ 3D ẩm thực · du lịch · BĐS",
    brandSub: "{n} địa điểm · ăn ᐧ chơi ᐧ ở",
    search: "Tìm kiếm",
    searchPlaceholder: "Tìm {n} địa điểm: phở, di tích, dự án, khu vực…",
    searchAria: "Tìm địa điểm",
    hint: "<kbd>↑</kbd><kbd>↓</kbd> khu vực · <kbd>⌘K</kbd> tìm kiếm · chạm vào pin",
    credit: 'Dữ liệu chọn lọc thủ công · <a href="#/nguon" data-sources>Nguồn &amp; đối chiếu</a> · Mã nguồn mở, giấy phép MIT · 2026',
    suggest: "Đề xuất địa điểm",
    onboardTitle: "Cách khám phá",
    onboardAreas: "Đi qua từng khu vực",
    onboardSearch: "Tìm địa điểm",
    onboardTap: "Chạm vào pin để xem chi tiết",
    onboardTapKey: "chạm",
    aPlace: "Một địa điểm ở Hà Nội",
    onTheMap: "trên bản đồ Hà Nội",
    price: "Giá",
    hours: "Mở",
    close: "Đóng",
    directions: "Chỉ đường",
    copyLink: "Sao chép link",
    copied: "Đã sao chép",
    copyFailed: "Không sao chép được",
    noResults: "Không tìm thấy",
    noResultsHint: "Thử tên quán, di tích, dự án, hoặc tên khu vực.",
    suggestCta: "Biết một địa điểm xứng đáng lên bản đồ? Đề xuất thêm",
    nearestToYou: "Gần bạn nhất",
    away: "cách {d}",
    filterHint: "Chạm để lọc theo nhóm",
    near: "Gần tôi",
    nearTitle: "Tìm địa điểm gần chỗ bạn đang đứng",
    locating: "Đang định vị…",
    locateDenied: "Bạn chưa cho phép truy cập vị trí. Bật lại trong cài đặt trình duyệt nhé.",
    locateFail: "Không lấy được vị trí. Thử lại khi có sóng tốt hơn.",
    outsideHanoi: "Bạn đang ở ngoài Hà Nội — bản đồ vẫn tính khoảng cách từ vị trí thật của bạn.",
    foundNear: "Gần bạn nhất: {name} · {d}",
    youAreHere: "Bạn đang ở đây",
    langSwitch: "Switch to English",
    openNow: "Đang mở",
    openUntil: "Mở đến {t}",
    closedNow: "Đã đóng",
    opensAt: "Mở lại {t}",
    installed: "Đã lưu vào màn hình chính — mở lại được cả khi mạng yếu.",
    stageFood: "Ẩm thực",
    stageSights: "Du lịch",
    stageHomes: "BĐS",
    tagFood: "Ăn",
    tagSights: "Chơi",
    tagHomes: "Ở",
    wxClear: "Trời quang",
    wxPartly: "Ít mây",
    wxOvercast: "Nhiều mây",
    wxRain: "Mưa",
    wxDrizzle: "Mưa phùn",
    wxStorm: "Mưa dông",
    wxFog: "Sương mù",
    wxDusk: "Hoàng hôn",
    wxNight: "Đêm quang",
    wxNightRain: "Đêm mưa",
    aqiGood: "Tốt",
    aqiFair: "Trung bình",
    aqiPoor: "Kém",
    aqiBad: "Xấu",
    aqiVeryBad: "Rất xấu",
    aqiHazard: "Nguy hại",
    wxTitle: "Thời tiết & không khí Hà Nội theo thời gian thực",
    wxDemo: "Chế độ demo (?wx=…&aqi=…)",
    wxHumidity: "Độ ẩm {v}%",
    wxWind: "Gió {v} km/h",
    wxSource: "Nguồn: Open-Meteo · tự làm mới mỗi 15 phút",
    airTitle: "Không khí Hà Nội hôm nay",
    airWhat: "VN_AQI ngày · Quyết định 1459/QĐ-TCMT",
    airNone: "Chưa lấy được số liệu không khí. Thử lại khi mạng ổn hơn.",
    airDriver: "Thông số quyết định chỉ số hôm nay: {p}",
    airPm: "PM2.5 trung bình 24 giờ {avg} µg/m³ · hiện tại {now} µg/m³",
    airEffect: "Ảnh hưởng tới sức khoẻ",
    airNormal: "Khuyến nghị cho người bình thường",
    airSensitive: "Khuyến nghị cho nhóm nhạy cảm",
    airWho: "Nhóm nhạy cảm: người già, trẻ em, người mắc bệnh hô hấp hoặc tim mạch.",
    airVsUs: "Cùng lúc này thang AQI của Mỹ cho {us}, thang Việt Nam cho {vn}. Hai thang dùng mốc nồng độ khác nhau nên số khác nhau là bình thường — bản đồ hiện số Việt Nam vì đó là thang dùng trong các bản tin trong nước.",
    airEnNote: "Bản tiếng Anh chỉ là dịch tham khảo. Bản tiếng Việt trong quyết định mới là bản gốc.",
    mapReal: "Bản đồ thật",
    mapRealTitle: "Xem trên bản đồ đường phố thật — đủ từng ngõ ngách (phím M)",
    map3d: "Bản đồ 3D",
    map3dTitle: "Quay lại thành phố 3D (phím M)",
    mapLoading: "Đang tải bản đồ đường phố…",
    mapFail: "Chưa tải được bản đồ đường phố. Kiểm tra kết nối rồi thử lại nhé.",
    mapHint: "Pin trên nền này là vị trí thật ngoài đường — phóng to để thấy tên.",
    mapApprox: "Vị trí ước lượng, chưa dò được trên OpenStreetMap",
    srcTitle: "Nguồn & đối chiếu",
    srcLead: "Mọi con số trên bản đồ này đều dẫn được về nguồn. Chỗ nào dựa vào văn bản nhà nước thì ghi rõ số hiệu, cơ quan ban hành, ngày ký và có link mở thẳng văn bản gốc để bạn tự đọc.",
    srcOpen: "Mở văn bản gốc",
    srcOpenData: "Mở nguồn",
    srcChecked: "Đối chiếu lần cuối {d}",
    srcStale: "Đã quá {n} ngày chưa đối chiếu lại — hãy mở văn bản gốc kiểm tra trước khi tin.",
    srcSigned: "ký {d}",
    srcEffective: "hiệu lực {d}",
    srcReplaces: "Thay thế {v}",
    srcUse: "Bản đồ dùng để",
    srcGroupLaw: "Văn bản nhà nước",
    srcGroupData: "Dữ liệu mở",
    srcGroupGap: "Chưa có văn bản công bố",
    srcGapLead: "Những mục dưới đây bản đồ cố tình để trống. Chưa có văn bản nào quy định nên không suy diễn.",
    srcBadge: "Nguồn",
    srcClose: "Đóng",
    layers: "Lớp dữ liệu",
    lezName: "Vùng phát thải thấp",
    lezOn: "Hiện ranh giới 9 phường có vùng phát thải thấp",
    chargeName: "Trạm sạc",
    chargeOn: "Hiện {n} trạm sạc xe điện lấy từ OpenStreetMap",
    lezTitle: "Vùng phát thải thấp",
    lezWhen: "Thí điểm từ 01/7/2026 đến 31/12/2027",
    lezWhere: "Trong Vành đai 1, thuộc 9 phường: Hai Bà Trưng, Cửa Nam, Hoàn Kiếm, Ô Chợ Dừa, Văn Miếu – Quốc Tử Giám, Ba Đình, Giảng Võ, Ngọc Hà, Tây Hồ.",
    lezWarn: "Đường kẻ trên bản đồ là ranh giới PHƯỜNG, không phải ranh giới vùng cấm. Vùng thí điểm chỉ là một số khu vực bên trong. Đừng dùng thay biển báo ngoài đường.",
    lezWhat: "Cấm hẳn: xe tải trên 3.500 kg chạy nhiên liệu hoá thạch; xe máy xăng chạy dịch vụ qua ứng dụng; ô tô nhiên liệu hoá thạch không đạt mức 4. Hạn chế theo khung giờ: xe máy xăng và ô tô chưa đạt chuẩn.",
    lezHours: "Khung giờ cấm: chưa công bố",
    lezHoursWhy: "Nghị quyết không ấn định giờ, chờ đề án của UBND thành phố. Bản đồ sẽ không hiện giờ nào cho tới khi có văn bản.",
    lezNext: "Mốc tiếp theo: 01/01/2028 mở ra Vành đai 1–2, từ 2030 tới Vành đai 3.",
    lezInZone: "Trong 9 phường có vùng phát thải thấp",
    chargeTitle: "Trạm sạc xe điện",
    chargeCount: "{n} trạm trong khung Hà Nội, {v} của VinFast.",
    chargeWarn: "OpenStreetMap do cộng đồng đóng góp nên có thể thiếu hoặc cũ, và hầu như không ghi trạm nào nhận xe máy điện. Nên gọi trước khi đi xa.",
    srcSee: "Xem văn bản gốc",
    wardName: "Phường xã mới",
    wardOn: "Hiện ranh giới 126 phường xã Hà Nội sau sáp nhập",
    wardTitle: "Phường xã sau sáp nhập",
    wardWhen: "Hiệu lực từ 01/7/2025",
    wardCount: "Hà Nội còn 126 đơn vị cấp xã: 51 phường và 75 xã.",
    wardHow: "Chạm vào bất kỳ chỗ nào trên bản đồ để biết chỗ đó nay thuộc phường xã nào. Hoặc bấm Gần tôi để tra chỗ bạn đang đứng.",
    wardWarn: "Ranh giới vẽ theo OpenStreetMap và đã rút gọn, sai số cỡ vài chục mét. Đứng sát mép thì đừng tin ngay — hỏi lại UBND phường cho chắc.",
    wardTap: "Chạm vào bản đồ để tra phường",
    wardAt: "Chỗ này thuộc",
    wardNone: "Chỗ này nằm ngoài địa giới Hà Nội",
    wardEdge: "Sát ranh giới (cách {d}) — nên kiểm tra lại",
    wardLoading: "Đang tải ranh giới 126 phường xã…",
    wardFail: "Chưa tải được dữ liệu phường xã. Thử lại khi mạng ổn hơn.",
    wardOf: "Phường xã",
    qhName: "Quy hoạch 2045",
    qhOn: "Hiện 5 vùng đô thị và 5 trục không gian theo Quyết định 1668/QĐ-TTg",
    qhTitle: "Quy hoạch khung Thủ đô 2045",
    qhWhen: "Quyết định 1668/QĐ-TTg, ký 27/12/2024",
    qhModel: "Mô hình: chùm đô thị, đa cực, đa trung tâm. Năm vùng đô thị nối nhau bằng năm trục không gian, ngăn cách bằng hành lang xanh.",
    qhZones: "5 vùng đô thị",
    qhAxes: "5 trục không gian",
    qhCity: "Dự kiến lập thành phố phía Bắc (Đông Anh – Mê Linh – Sóc Sơn) và thành phố phía Tây (từ Sơn Tây); thành phố phía Nam đang nghiên cứu.",
    qhWarn: "Đây là SƠ ĐỒ MINH HOẠ, không phải bản đồ quy hoạch pháp lý. Không dùng để tra quy hoạch thửa đất, xin phép xây dựng hay mua bán nhà đất.",
    qhHowZone: "Quyết định mô tả vùng theo quận, huyện CŨ — những đơn vị đã bỏ từ 01/7/2025. Bản đồ quy chiếu sang 126 phường xã mới: mỗi phường xã tô màu theo huyện cũ chiếm phần lớn diện tích của nó. Ranh giới vì thế chỉ là tương đối.",
    qhHowAxis: "Trục vẽ bằng nét đứt nối các mốc mà quyết định nêu tên. Văn bản không kèm toạ độ, nên đây là hướng đi minh hoạ, không phải hướng tuyến kỹ thuật.",
    qhOverlap: "Quyết định vừa xếp Thanh Oai và Thường Tín vào vùng phía Nam, vừa ghi “một phần Thanh Oai, Thường Tín” thuộc vùng phía Nam sông Hồng. Ranh giới giữa hai vùng ở đó không đọc ra được từ văn bản; bản đồ để cả hai huyện cũ ở vùng phía Nam.",
    qhTap: "Chạm vào bản đồ để xem vùng quy hoạch",
    qhAt: "Vùng quy hoạch",
    qhNone: "Chỗ này nằm ngoài địa giới Hà Nội",
    qhLoading: "Đang tải ranh giới để vẽ sơ đồ quy hoạch…",
    qhFail: "Chưa tải được dữ liệu. Thử lại khi mạng ổn hơn.",
    qhWards: "{n} phường xã",
  },
  en: {
    title: "Hanoi Atlas — a 3D map of food, sights & homes",
    brandSub: "{n} places · eat ᐧ see ᐧ live",
    search: "Search",
    searchPlaceholder: "Search {n} places: phở, temples, projects, districts…",
    searchAria: "Search places",
    hint: "<kbd>↑</kbd><kbd>↓</kbd> areas · <kbd>⌘K</kbd> search · tap a pin",
    credit: 'Hand-curated data · <a href="#/nguon" data-sources>Sources &amp; checks</a> · Open source, MIT licence · 2026',
    suggest: "Suggest a place",
    onboardTitle: "How to explore",
    onboardAreas: "Step through the areas",
    onboardSearch: "Search any place",
    onboardTap: "Tap a pin for details",
    onboardTapKey: "tap",
    aPlace: "A place in Hanoi",
    onTheMap: "on the Hanoi map",
    price: "From",
    hours: "Open",
    close: "Close",
    directions: "Directions",
    copyLink: "Copy link",
    copied: "Link copied",
    copyFailed: "Couldn't copy",
    noResults: "Nothing found",
    noResultsHint: "Try a restaurant, landmark, project, or district name.",
    suggestCta: "Know a place that belongs on this map? Suggest it",
    nearestToYou: "Closest to you",
    away: "{d} away",
    filterHint: "Tap to filter by category",
    near: "Near me",
    nearTitle: "Find places close to where you are",
    locating: "Finding you…",
    locateDenied: "Location access is off. Turn it back on in your browser settings.",
    locateFail: "Couldn't get your location. Try again with a better signal.",
    outsideHanoi: "You're outside Hanoi — distances are still measured from where you actually are.",
    foundNear: "Closest to you: {name} · {d}",
    youAreHere: "You are here",
    langSwitch: "Chuyển sang tiếng Việt",
    openNow: "Open now",
    openUntil: "Open until {t}",
    closedNow: "Closed",
    opensAt: "Opens {t}",
    installed: "Saved to your home screen — it opens even on a weak connection.",
    stageFood: "Food",
    stageSights: "Sights",
    stageHomes: "Homes",
    tagFood: "Eat",
    tagSights: "See",
    tagHomes: "Live",
    wxClear: "Clear",
    wxPartly: "Partly cloudy",
    wxOvercast: "Overcast",
    wxRain: "Rain",
    wxDrizzle: "Drizzle",
    wxStorm: "Thunderstorm",
    wxFog: "Fog",
    wxDusk: "Sunset",
    wxNight: "Clear night",
    wxNightRain: "Rainy night",
    aqiGood: "Good",
    aqiFair: "Moderate",
    aqiPoor: "Unhealthy for sensitive groups",
    aqiBad: "Unhealthy",
    aqiVeryBad: "Very unhealthy",
    aqiHazard: "Hazardous",
    wxTitle: "Live Hanoi weather & air quality",
    wxDemo: "Demo mode (?wx=…&aqi=…)",
    wxHumidity: "Humidity {v}%",
    wxWind: "Wind {v} km/h",
    wxSource: "Source: Open-Meteo · refreshes every 15 min",
    airTitle: "Hanoi air today",
    airWhat: "Daily VN_AQI · Decision 1459/QĐ-TCMT",
    airNone: "Could not fetch air data. Try again on a better connection.",
    airDriver: "Today's index is driven by: {p}",
    airPm: "PM2.5 24-hour mean {avg} µg/m³ · now {now} µg/m³",
    airEffect: "Effect on health",
    airNormal: "Advice for the general public",
    airSensitive: "Advice for sensitive groups",
    airWho: "Sensitive groups: the elderly, children, and people with respiratory or heart conditions.",
    airVsUs: "Right now the US scale reads {us} and the Vietnamese scale reads {vn}. The two use different concentration breakpoints, so a gap is normal — this map shows the Vietnamese figure because that is the scale used in domestic reporting.",
    airEnNote: "This English text is an unofficial translation. The Vietnamese wording in the decision is authoritative.",
    mapReal: "Street map",
    mapRealTitle: "Switch to the real street map — every lane and alley (press M)",
    map3d: "3D map",
    map3dTitle: "Back to the 3D city (press M)",
    mapLoading: "Loading the street map…",
    mapFail: "Could not load the street map. Check your connection and try again.",
    mapHint: "Pins here sit at their real street positions — zoom in for names.",
    mapApprox: "Approximate position, not yet matched on OpenStreetMap",
    srcTitle: "Sources & checks",
    srcLead: "Every figure on this map traces back to a source. Anything resting on a Vietnamese government document carries its number, issuing body and signing date, plus a link straight to the original so you can read it yourself.",
    srcOpen: "Open the original",
    srcOpenData: "Open source",
    srcChecked: "Last checked {d}",
    srcStale: "Not re-checked for {n} days — open the original before relying on it.",
    srcSigned: "signed {d}",
    srcEffective: "in force {d}",
    srcReplaces: "Replaces {v}",
    srcUse: "Used here for",
    srcGroupLaw: "Government documents",
    srcGroupData: "Open data",
    srcGroupGap: "Not yet published",
    srcGapLead: "The map deliberately leaves these blank. No document sets them out, so it does not guess.",
    srcBadge: "Sources",
    srcClose: "Close",
    layers: "Data layers",
    lezName: "Low-emission zone",
    lezOn: "Show the nine wards that contain the low-emission zone",
    chargeName: "EV charging",
    chargeOn: "Show {n} charging points from OpenStreetMap",
    lezTitle: "Low-emission zone",
    lezWhen: "Pilot from 1 Jul 2026 to 31 Dec 2027",
    lezWhere: "Inside Ring Road 1, across nine wards: Hai Bà Trưng, Cửa Nam, Hoàn Kiếm, Ô Chợ Dừa, Văn Miếu – Quốc Tử Giám, Ba Đình, Giảng Võ, Ngọc Hà, Tây Hồ.",
    lezWarn: "The outline on the map is the WARD boundary, not the restricted area. The pilot covers only parts of it. Do not use this instead of the signs on the street.",
    lezWhat: "Banned outright: fossil-fuel trucks over 3,500 kg; petrol motorbikes on ride-hailing apps; fossil-fuel cars below emission level 4. Time-restricted: petrol motorbikes and cars that miss the standard.",
    lezHours: "Restricted hours: not yet published",
    lezHoursWhy: "The resolution sets no hours; they await the city government's scheme. The map will show none until a document exists.",
    lezNext: "Next milestones: 1 Jan 2028 out to Ring Roads 1–2, then Ring Road 3 from 2030.",
    lezInZone: "In a low-emission-zone ward",
    chargeTitle: "EV charging points",
    chargeCount: "{n} points inside the Hanoi frame, {v} of them VinFast.",
    chargeWarn: "OpenStreetMap is community-mapped, so it can be incomplete or stale, and almost none of these record whether they take electric motorbikes. Call ahead before a long trip.",
    srcSee: "Read the document",
    wardName: "New wards",
    wardOn: "Show the 126 wards and communes of Hanoi after the 2025 merger",
    wardTitle: "Wards after the merger",
    wardWhen: "In force since 1 July 2025",
    wardCount: "Hanoi now has 126 commune-level units: 51 wards and 75 communes.",
    wardHow: "Tap anywhere on the map to see which ward or commune it now belongs to. Or press Near me to look up where you are standing.",
    wardWarn: "Boundaries come from OpenStreetMap and are simplified, so they are accurate to a few tens of metres. Close to an edge, check with the ward office rather than trusting this.",
    wardTap: "Tap the map to look up a ward",
    wardAt: "This spot is in",
    wardNone: "This spot is outside Hanoi",
    wardEdge: "Close to a boundary ({d} away) — worth double-checking",
    wardLoading: "Loading the 126 ward boundaries…",
    wardFail: "Could not load the ward data. Try again on a better connection.",
    wardOf: "Ward",
    qhName: "2045 master plan",
    qhOn: "Show the five urban zones and five spatial axes from Decision 1668/QĐ-TTg",
    qhTitle: "Framework master plan to 2045",
    qhWhen: "Decision 1668/QĐ-TTg, signed 27 Dec 2024",
    qhModel: "The model is a multi-polar, multi-centre urban cluster: five urban zones joined by five spatial axes and separated by green corridors.",
    qhZones: "Five urban zones",
    qhAxes: "Five spatial axes",
    qhCity: "A northern city (Đông Anh – Mê Linh – Sóc Sơn) and a western city (from Sơn Tây) are planned; a southern city is under study.",
    qhWarn: "This is an ILLUSTRATIVE SKETCH, not a legal planning map. Do not use it to check the zoning of a plot, apply for a building permit, or buy or sell property.",
    qhHowZone: "The decision describes each zone as a list of OLD districts — units abolished on 1 July 2025. This map projects them onto the 126 new wards and communes: each one is coloured for the old district covering most of its area. The zone edges are therefore approximate.",
    qhHowAxis: "Axes are drawn as dashed lines between the landmarks the decision names. The document carries no coordinates, so these show direction, not an engineered alignment.",
    qhOverlap: "The decision places Thanh Oai and Thường Tín in the southern zone while also saying “part of Thanh Oai and Thường Tín” belongs to the zone south of the Red River. Where that line falls cannot be read from the text, so this map keeps both old districts in the southern zone.",
    qhTap: "Tap the map to see the planning zone",
    qhAt: "Planning zone",
    qhNone: "This spot is outside Hanoi",
    qhLoading: "Loading boundaries to draw the plan…",
    qhFail: "Could not load the data. Try again on a better connection.",
    qhWards: "{n} wards and communes",
  },
};

function t(key, vars) {
  let out = STRINGS[LANG]?.[key] ?? STRINGS.vi[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

// Dữ liệu song ngữ được viết là "Tiếng Việt. · English." — tách theo dấu " · ".
// Chuỗi không có dấu tách (ví dụ địa điểm mới từ Sheet) thì giữ nguyên.
function bi(text) {
  if (!text) return "";
  const at = text.indexOf(" · ");
  if (at < 0) return text;
  return LANG === "vi" ? text.slice(0, at) : text.slice(at + 3);
}

const AREA_EN = {
  all: ["All of Hanoi", "Whole city"],
  "pho-co": ["Old Quarter & Hoàn Kiếm", "Old Quarter"],
  phap: ["French Quarter", "French Quarter"],
  "ba-dinh": ["Ba Đình & Temple of Literature", "Ba Đình"],
  "ho-tay": ["West Lake", "West Lake"],
  "tay-moi": ["Cầu Giấy & Mỹ Đình", "New West"],
  nam: ["South Hanoi", "South"],
  "song-hong": ["Red River & Long Biên", "Red River"],
};

function areaLabel(area) {
  return LANG === "en" ? (AREA_EN[area.id]?.[0] ?? area.label) : area.label;
}

function areaShort(area) {
  if (!area) return "";
  return LANG === "en" ? (AREA_EN[area.id]?.[1] ?? area.shortLabel) : area.shortLabel;
}

const STAGE_KEY = { "Ẩm thực": "Food", "Du lịch": "Sights", BĐS: "Homes" };

function stageLabel(stage) {
  const key = STAGE_KEY[stage];
  return key ? t(`stage${key}`) : stage || "";
}

function tagOf(stage) {
  const key = STAGE_KEY[stage];
  return key ? t(`tag${key}`) : "";
}

function setLang(next) {
  if (next === LANG) return;
  LANG = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* bỏ qua */
  }
  applyLanguage();
}

// Vẽ lại mọi chữ trên màn hình theo ngôn ngữ đang chọn.
function applyLanguage({ silent = false } = {}) {
  const n = STARTUPS.length;
  document.documentElement.lang = LANG;
  document.title = t("title");

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };
  const setHtml = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  };

  setText(".brand__sub", t("brandSub", { n }));
  setText(".search-trigger__label", t("search"));
  setHtml(".rail__hint", t("hint"));
  setHtml(".rail__credit", t("credit"));
  setText(".rail__cta span:not(.rail__cta-arrow)", t("suggest"));
  const cta = document.querySelector(".rail__cta");
  if (cta) cta.href = suggestUrl();
  if (searchInput) {
    searchInput.placeholder = t("searchPlaceholder", { n });
    searchInput.setAttribute("aria-label", t("searchAria"));
  }
  const trigger = document.querySelector("#searchTrigger");
  if (trigger) trigger.setAttribute("aria-label", t("searchAria"));

  const langBtn = document.querySelector("#langToggle");
  if (langBtn) {
    langBtn.textContent = LANG === "vi" ? "EN" : "VI";
    langBtn.title = t("langSwitch");
    langBtn.setAttribute("aria-label", t("langSwitch"));
  }
  const nearBtn = document.querySelector("#nearMe");
  if (nearBtn) {
    nearBtn.title = t("nearTitle");
    nearBtn.setAttribute("aria-label", t("near"));
    const label = nearBtn.querySelector(".tool-btn__label");
    if (label) label.textContent = t("near");
  }
  // Nút lật 3D ⇄ bản đồ thật đổi cả chữ lẫn nghĩa theo chế độ đang xem.
  const modeBtn = document.querySelector("#mapMode");
  if (modeBtn) {
    const label = mapMode ? t("map3d") : t("mapReal");
    modeBtn.title = mapMode ? t("map3dTitle") : t("mapRealTitle");
    modeBtn.setAttribute("aria-label", label);
    modeBtn.setAttribute("aria-pressed", String(mapMode));
    const span = modeBtn.querySelector(".tool-btn__label");
    if (span) span.textContent = label;
  }

  if (silent) return;

  applyMapLanguage();
  renderMapPinNames();
  renderMapLayerChips();
  renderMapNote();

  // Phần động: chỉ vẽ lại khi scene đã dựng xong.
  if (areaList?.children.length) renderAreaList();
  if (pinLegend?.children.length) renderPinLegend();
  labelElements.forEach((el, id) => {
    const small = el.querySelector("small[data-tag]");
    const place = STARTUPS.find((s) => s.id === id);
    if (small && place) small.textContent = tagOf(place.stage);
  });
  if (lastEnv) renderLiveBadge(lastEnv);
  const selected = state.selectedId ? STARTUPS.find((s) => s.id === state.selectedId) : null;
  if (selected) renderStartupDetail(selected);
  else renderAreaDetail();
  if (searchModal?.open) renderSearchResults(searchInput.value);
  updateUiState();
}

/* ---------- 2) Lọc theo nhóm ---------- */

const activeStages = new Set();

function stageAllowed(item) {
  return activeStages.size === 0 || activeStages.has(item?.stage);
}

function visibleItems(areaId) {
  return areaItems(areaId).filter(stageAllowed);
}

const STAGE_SLUG = { "Ẩm thực": "an", "Du lịch": "choi", BĐS: "o" };
const SLUG_STAGE = Object.fromEntries(Object.entries(STAGE_SLUG).map(([k, v]) => [v, k]));

function toggleStage(stage) {
  if (activeStages.has(stage)) activeStages.delete(stage);
  else activeStages.add(stage);
  // Bật cả ba nhóm cũng đồng nghĩa với "xem tất cả".
  if (activeStages.size === 3) activeStages.clear();
  renderPinLegend();
  renderAreaList();
  updateUiState();
  syncFilterUrl();
}

function syncFilterUrl() {
  const params = new URLSearchParams(location.search);
  const slugs = [...activeStages].map((s) => STAGE_SLUG[s]).filter(Boolean);
  if (slugs.length) params.set("nhom", slugs.join(","));
  else params.delete("nhom");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function readFilterFromUrl() {
  const raw = QUERY.get("nhom") || QUERY.get("cat");
  if (!raw) return;
  raw
    .split(",")
    .map((s) => SLUG_STAGE[normKey(s)] || (STAGE_KEY[s] ? s : null))
    .filter(Boolean)
    .forEach((stage) => activeStages.add(stage));
  if (activeStages.size === 3) activeStages.clear();
  if (activeStages.size) {
    renderPinLegend();
    renderAreaList();
    updateUiState();
  }
}

/* ---------- 3) Gần tôi · khoảng cách · chỉ đường ---------- */

// Google Form nhận đề xuất địa điểm (đổ thẳng vào Sheet). Để trống thì nút
// "Đề xuất địa điểm" quay về gửi email như cũ.
const SUGGEST_FORM_URL = "";

function suggestUrl() {
  const form = (QUERY.get("form") || SUGGEST_FORM_URL || "").trim();
  if (form) return form;
  return `mailto:thaohienhomes@gmail.com?subject=${encodeURIComponent("Đề xuất địa điểm cho Hà Nội Atlas")}`;
}

let userPos = null;

/* ---------- Toạ độ thật ngoài thực địa ---------- */

// lat/lng trong data.js là toạ độ VẼ: chúng đặt pin đúng chỗ trên thành phố 3D
// vẽ tay, nhưng so với thực địa có thể lệch cả cây số. Bảng dưới là toạ độ THẬT,
// dò từ OpenStreetMap (Nominatim) với gợi ý tên riêng cho từng nơi rồi lọc bằng
// ngưỡng 900 m: 45/52 điểm khớp, sai lệch trung bình 192 m. Dùng để đo khoảng
// cách "Gần tôi" và để cắm pin trên chế độ bản đồ đường phố thật. 7 điểm còn
// lại OSM chưa có hoặc trùng tên nên vẫn dùng toạ độ vẽ.
const REAL_COORDS = {
  "pho-bat-dan": [21.03364, 105.84638],
  "pho-10-ly-quoc-su": [21.03047, 105.84885],
  "pho-thin-lo-duc": [21.01704, 105.856],
  "bun-cha-huong-lien": [21.01805, 105.85388],
  "bun-cha-dac-kim": [21.03232, 105.84807],
  "cha-ca-la-vong": [21.03568, 105.84915],
  "ca-phe-giang": [21.03427, 105.8545],
  "ca-phe-dinh": [21.032, 105.85239],
  "cong-ca-phe": [21.02881, 105.84965],
  "bia-ta-hien": [21.0353, 105.85199],
  "banh-mi-25": [21.03617, 105.84872],
  "xoi-yen": [21.03377, 105.85454],
  "pho-cuon-ngu-xa": [21.04598, 105.84106],
  "banh-tom-ho-tay": [21.04732, 105.83763],
  "quan-an-ngon": [21.02626, 105.84342],
  "ho-guom": [21.02883, 105.85254],
  "den-ngoc-son": [21.03073, 105.85238],
  "cho-dong-xuan": [21.0381, 105.8494],
  "o-quan-chuong": [21.03733, 105.85221],
  "nha-tho-lon": [21.02831, 105.85008],
  "nha-hat-lon": [21.02414, 105.85976],
  "hoa-lo": [21.02542, 105.84651],
  "bao-tang-phu-nu": [21.02335, 105.8516],
  "lang-bac": [21.03678, 105.83469],
  "chua-mot-cot": [21.03586, 105.83361],
  "hoang-thanh": [21.03839, 105.84062],
  "cot-co": [21.03259, 105.83982],
  "van-mieu": [21.02945, 105.83673],
  "chua-tran-quoc": [21.04783, 105.83673],
  "duong-thanh-nien": [21.04693, 105.8367],
  "cau-long-bien": [21.04307, 105.85803],
  "cv-thong-nhat": [21.01233, 105.84379],
  "svd-my-dinh": [21.0205, 105.76393],
  "bao-tang-dan-toc-hoc": [21.04008, 105.79884],
  "bao-tang-ha-noi": [21.01001, 105.78631],
  "vin-metropolis": [21.0315, 105.81507],
  "lotte-center": [21.03227, 105.81263],
  "keangnam-l72": [21.01735, 105.78359],
  "vin-skylake": [21.02002, 105.78191],
  "sunshine-city": [21.08345, 105.81122],
  "dle-roi-soleil": [21.06535, 105.82703],
  "sun-thuy-khue": [21.04078, 105.82598],
  "vin-times-city": [20.99779, 105.86823],
  "vin-royal-city": [21.00217, 105.81549],
  "mipec-riverside": [21.04588, 105.86617],
};

function realPos(item) {
  const found = item?.id ? REAL_COORDS[item.id] : null;
  return found ? { lat: found[0], lng: found[1] } : item;
}

function hasRealPos(item) {
  return Boolean(item?.id && REAL_COORDS[item.id]);
}

function metresBetween(rawA, rawB) {
  const a = realPos(rawA);
  const b = realPos(rawB);
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function fmtDistance(m) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 9500) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

function distanceTo(item) {
  if (!userPos || !item) return "";
  return fmtDistance(metresBetween(userPos, item));
}

// Chỉ đường mở thẳng Google Maps. Toạ độ trên bản đồ này là vị trí cách điệu,
// nên điểm đến gửi đi bằng TÊN + địa chỉ để Google tự tìm đúng chỗ thật.
function directionsUrl(startup) {
  const destination = [startup.name, startup.address, "Hà Nội"].filter(Boolean).join(", ");
  const params = new URLSearchParams({ api: "1", destination });
  if (userPos) params.set("origin", `${userPos.lat.toFixed(5)},${userPos.lng.toFixed(5)}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

let hereGroup = null;

function buildHereMarker() {
  hereGroup = new THREE.Group();
  hereGroup.visible = false;

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x2f9bff, fog: false }),
  );
  dot.position.y = 0.5;
  hereGroup.add(dot);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0x2f9bff, transparent: true, opacity: 0.55, fog: false }),
  );
  beam.position.y = 0.5;
  hereGroup.add(beam);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.46, 32),
    new THREE.MeshBasicMaterial({
      color: 0x2f9bff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.name = "pulse";
  hereGroup.add(ring);

  hereGroup.renderOrder = 7;
  scene.add(hereGroup);
}

function updateHere(elapsed) {
  if (!hereGroup?.visible) return;
  const ring = hereGroup.getObjectByName("pulse");
  if (!ring) return;
  const beat = (elapsed % 1.8) / 1.8;
  ring.scale.setScalar(1 + beat * 2.4);
  ring.material.opacity = 0.75 * (1 - beat);
}

const HANOI_BBOX = { lat: [20.9, 21.16], lng: [105.68, 106.03] };

function insideHanoi(pos) {
  return (
    pos.lat >= HANOI_BBOX.lat[0] &&
    pos.lat <= HANOI_BBOX.lat[1] &&
    pos.lng >= HANOI_BBOX.lng[0] &&
    pos.lng <= HANOI_BBOX.lng[1]
  );
}

function locateMe() {
  const button = document.querySelector("#nearMe");
  if (!navigator.geolocation) {
    toast(t("locateFail"));
    return;
  }
  button?.classList.add("is-busy");
  toast(t("locating"), 2500);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      button?.classList.remove("is-busy");
      userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
      button?.classList.add("is-on");

      syncMapHere();
      if (mapLayerState.ward) tellWardAt(userPos);
      if (mapLayerState.qh) tellQhAt(userPos);
      const onMap = insideHanoi(userPos);
      if (onMap && hereGroup) {
        hereGroup.position.copy(project(userPos.lat, userPos.lng, 0));
        hereGroup.visible = true;
      }

      const nearest = [...STARTUPS]
        .filter(stageAllowed)
        .map((s) => ({ s, d: metresBetween(userPos, s) }))
        .sort((a, b) => a.d - b.d)[0];
      if (!nearest) return;

      if (!onMap) toast(t("outsideHanoi"), 5200);
      else toast(t("foundNear", { name: nearest.s.name, d: fmtDistance(nearest.d) }), 5200);
      selectStartup(nearest.s.id);
    },
    (error) => {
      button?.classList.remove("is-busy");
      toast(error?.code === 1 ? t("locateDenied") : t("locateFail"), 5200);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
  );
}

let toastEl = null;
let toastTimer = null;

function toast(message, ms = 3600) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "atlas-toast";
    toastEl.setAttribute("role", "status");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), ms);
}

// Giờ mở cửa (cột "Giờ mở" trong Sheet) so với giờ Hà Nội thật.
// Hiểu được "6:00–10:00 & 18:00–20:30", "8h–17h", "17:00-23:30"…
function hanoiMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function openState(hours) {
  if (!hours) return null;
  const ranges = [...String(hours).matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})?\s*[–\-—~]\s*(\d{1,2})\s*[:h]\s*(\d{2})?/g)].map(
    (m) => [Number(m[1]) * 60 + Number(m[2] ?? 0), Number(m[3]) * 60 + Number(m[4] ?? 0)],
  );
  if (!ranges.length) return null;
  const now = hanoiMinutes();
  const hhmm = (v) => `${String(Math.floor((v % 1440) / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;

  for (const [from, to] of ranges) {
    const end = to <= from ? to + 1440 : to; // quán mở qua nửa đêm
    const at = now < from ? now + 1440 : now;
    if (at >= from && at < end) return { open: true, text: t("openUntil", { t: hhmm(to) }) };
  }
  const next = ranges.map(([from]) => from).sort((a, b) => ((a - now + 1440) % 1440) - ((b - now + 1440) % 1440))[0];
  return { open: false, text: t("opensAt", { t: hhmm(next) }) };
}

/* ---------- 4) Đèn đêm: đèn đường, đèn nhà, đèn cầu ---------- */

let nightLights = null;

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,244,214,0.75)");
  g.addColorStop(0.6, "rgba(255,236,190,0.22)");
  g.addColorStop(1, "rgba(255,232,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Rải điểm đều dọc một tuyến đường (toạ độ lat/lng) theo bước tính bằng world unit.
function walkPath(path, step) {
  const points = path.map(([lat, lng]) => project(lat, lng, 0));
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const span = a.distanceTo(b);
    const times = Math.max(1, Math.round(span / step));
    for (let k = 0; k < times; k += 1) {
      const p = a.clone().lerp(b, k / times);
      const dir = b.clone().sub(a).normalize();
      out.push({ p, dir });
    }
  }
  return out;
}

function makeLightCloud(positions, colors, coreSize, haloSize, haloOpacity, glow) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  // Hai lớp dùng chung một hình học: lõi sáng đanh + quầng sáng toả ra.
  // Tắt fog cho đèn: ánh đèn thành phố vẫn xuyên qua sương, đúng như thật.
  const make = (size, opacity) =>
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size,
        map: glow,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
  const core = make(coreSize, 1);
  const halo = make(haloSize, haloOpacity);
  return { core, halo };
}

function buildNightLights() {
  const lamp = { pos: [], col: [] };
  const home = { pos: [], col: [] };
  const post = [];
  const warm = new THREE.Color(0xffc978);
  const bridgeLight = new THREE.Color(0xffe0a4);
  const metroLight = new THREE.Color(0xd6ecff);
  const window1 = new THREE.Color(0xffcf90);
  const window2 = new THREE.Color(0xa9c8f0);
  const random = seededRandom(9931);

  const add = (bag, x, y, z, color) => {
    bag.pos.push(x, y, z);
    bag.col.push(color.r, color.g, color.b);
  };

  // Đèn cao áp hai bên các đại lộ — dày để đường thành vệt sáng liền.
  for (const road of BOULEVARDS) {
    for (const { p, dir } of walkPath(road.path, 0.5)) {
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.22);
      for (const sign of [1, -1]) {
        const x = p.x + side.x * sign;
        const z = p.z + side.z * sign;
        add(lamp, x, 0.62, z, warm);
        post.push(x, 0.31, z);
      }
    }
  }

  // Dây đèn dọc bốn cây cầu.
  for (const span of BRIDGES) {
    for (const { p } of walkPath(span.deck, 0.42)) add(lamp, p.x, 1.1, p.z, bridgeLight);
  }

  // Metro trên cao sáng đèn nhà ga và dải ray.
  for (const line of METRO_LINES) {
    if (line.mode !== "viaduct") continue;
    for (const { p } of walkPath(line.stops, 0.75)) add(lamp, p.x, 0.78, p.z, metroLight);
  }

  // Đèn cửa sổ nhà dân: rải trong từng quận, tránh hồ, sông, công viên.
  for (const district of DISTRICTS) {
    const [latMin, latMax, lngMin, lngMax] = district.bbox;
    const area = (latMax - latMin) * (lngMax - lngMin) * 1e6;
    // Bờ bên kia sông thưa đèn hơn, đúng như nhìn từ trung tâm.
    const wanted = Math.min(300, Math.round(area * (district.faded ? 0.6 : 2.2)));
    let tries = 0;
    let made = 0;
    while (made < wanted && tries < wanted * 6) {
      tries += 1;
      const lat = latMin + random() * (latMax - latMin);
      const lng = lngMin + random() * (lngMax - lngMin);
      if (!buildingAllowed(lat, lng)) continue;
      const p = project(lat, lng, 0);
      const top = district.h?.[1] ?? 0.7;
      const y = 0.22 + random() * Math.max(0.3, top * 0.85);
      add(home, p.x, y, p.z, random() < 0.85 ? window1 : window2);
      made += 1;
    }
  }

  // Vài điểm nhấn: Tháp Rùa, Lăng Bác, Nhà thờ Lớn, đèn báo không trên tháp cao.
  const accents = [
    [21.0285, 105.8525, 1.1, 0xfff0c4],
    [21.0368, 105.8348, 1.3, 0xfff6dd],
    [21.0289, 105.849, 1.6, 0xffe9bb],
    [21.0172, 105.7838, 3.4, 0xff6b5a],
    [21.0313, 105.8135, 2.9, 0xff6b5a],
    [21.0798, 105.8175, 2.6, 0xffd28a],
  ];
  for (const [lat, lng, y, hex] of accents) {
    const p = project(lat, lng, 0);
    add(lamp, p.x, y, p.z, new THREE.Color(hex));
  }

  const glow = makeGlowTexture();
  const lamps = makeLightCloud(lamp.pos, lamp.col, 0.26, 1.45, 0.34, glow);
  const homes = makeLightCloud(home.pos, home.col, 0.15, 0.5, 0.24, glow);

  // Cột đèn: một InstancedMesh mảnh cho toàn bộ đại lộ.
  const count = post.length / 3;
  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.022, 0.03, 0.62, 5),
    new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.8, metalness: 0.2 }),
    count,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    matrix.makeTranslation(post[i * 3], post[i * 3 + 1], post[i * 3 + 2]);
    poles.setMatrixAt(i, matrix);
  }
  poles.instanceMatrix.needsUpdate = true;
  poles.castShadow = false;

  const group = new THREE.Group();
  group.add(poles, homes.halo, homes.core, lamps.halo, lamps.core);
  group.visible = false;
  group.renderOrder = 5;
  scene.add(group);
  nightLights = { group, lamps, homes, poles };
}

function setNightLights(on) {
  if (on && !nightLights) buildNightLights();
  if (nightLights) nightLights.group.visible = Boolean(on);
}

function updateNightLights(elapsed) {
  if (!nightLights?.group.visible) return;
  // Nhấp nháy rất nhẹ để đèn không chết cứng như hình dán.
  const flicker = 0.94 + Math.sin(elapsed * 1.7) * 0.04 + Math.sin(elapsed * 4.3) * 0.02;
  nightLights.lamps.core.material.opacity = flicker;
  nightLights.lamps.halo.material.opacity = 0.34 * flicker;
  nightLights.homes.core.material.opacity = 0.92 * flicker;
  nightLights.homes.halo.material.opacity = 0.24 * flicker;
}

/* ---------- 5) Khung hình theo tỉ lệ màn hình ---------- */

// Máy tính nằm ngang thấy rộng, điện thoại dựng dọc thấy rất hẹp. Cùng một
// khoảng cách camera sẽ cắt cụt thành phố trên điện thoại, nên mọi cú bay
// được kéo lùi lại theo tỉ lệ màn hình — và sương mù mỏng đi tương ứng.
const viewFit = { pull: 1, tilt: 0, fog: 1 };
let wideFocus = null;

function measureViewFit() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const pull = Math.min(1.18, Math.max(1, (1.55 / Math.max(0.35, aspect)) ** 0.35));
  viewFit.pull = pull;
  viewFit.tilt = (pull - 1) * 1.55; // radian: màn hình càng dọc càng nhìn từ trên xuống
  viewFit.fog = pull ** -0.4;
  controls.maxDistance = 140 * pull;

  // Toàn cảnh trên máy tính lấy trọn cả rìa tây; trên điện thoại dọc thì kéo
  // tâm về lõi Hồ Tây – Phố cổ, chỗ đáng nhìn nhất.
  const all = AREA_BY_ID.all?.focus;
  if (!all) return;
  if (!wideFocus) wideFocus = { lat: all.lat, lng: all.lng };
  const toCore = pull > 1.04 ? 1 : 0;
  all.lat = wideFocus.lat + (21.0335 - wideFocus.lat) * toCore;
  all.lng = wideFocus.lng + (105.8365 - wideFocus.lng) * toCore;
}

/* ---------- Thanh công cụ trên HUD ---------- */

function mountToolbar() {
  const host = document.querySelector(".hud-top-right");
  if (!host || document.querySelector("#langToggle")) return;
  const anchor = document.querySelector("#searchTrigger");

  const lang = document.createElement("button");
  lang.id = "langToggle";
  lang.type = "button";
  lang.className = "tool-btn tool-btn--lang";
  lang.addEventListener("click", () => setLang(LANG === "vi" ? "en" : "vi"));

  const near = document.createElement("button");
  near.id = "nearMe";
  near.type = "button";
  near.className = "tool-btn";
  near.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg><span class="tool-btn__label"></span>';
  near.addEventListener("click", locateMe);

  const mode = document.createElement("button");
  mode.id = "mapMode";
  mode.type = "button";
  mode.className = "tool-btn";
  mode.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M9 3.6 3.5 5.8v14.6L9 18.2l6 2.2 5.5-2.2V3.6L15 5.8 9 3.6Z"/><path fill="none" stroke="currentColor" stroke-width="1.9" d="M9 3.6v14.6M15 5.8v14.6"/></svg><span class="tool-btn__label"></span>';
  mode.addEventListener("click", () => setMapMode(!mapMode));

  host.insertBefore(lang, anchor);
  host.insertBefore(near, anchor);
  host.insertBefore(mode, anchor);
  applyLanguage({ silent: true });
}

/* ==========================================================================
   CHẾ ĐỘ BẢN ĐỒ ĐƯỜNG PHỐ THẬT · REAL STREET MAP
   Thành phố 3D là bản vẽ tay — đẹp để nhìn tổng thể, nhưng không đi theo được.
   Nút "Bản đồ thật" lật sang nền OpenStreetMap qua OpenFreeMap (miễn phí,
   không cần API key, không giới hạn lượt gọi, dùng thương mại được) và cắm 52
   pin bằng toạ độ thực địa, đủ chi tiết để dò từng ngõ. Thư viện MapLibre chỉ
   tải xuống khi bấm nút, nên ai không dùng thì không phải tải thêm gì.
   Nền này cũng là chỗ để chồng các lớp dữ liệu thật sắp tới: vùng phát thải
   thấp, trạm sạc, ranh giới phường mới sau sáp nhập.
   Mở thẳng bằng ?che-do=ban-do · phím tắt M.
   ========================================================================== */

// Ba nền có sẵn của OpenFreeMap; đổi bằng ?nen=duong|sang|dam, hoặc dán thẳng
// link style JSON khác vào ?nen= nếu muốn thử nền riêng.
const MAP_STYLES = {
  duong: "https://tiles.openfreemap.org/styles/liberty",
  sang: "https://tiles.openfreemap.org/styles/bright",
  dam: "https://tiles.openfreemap.org/styles/positron",
};

function mapStyleUrl() {
  const asked = (QUERY.get("nen") || "").trim();
  if (/^https?:\/\//i.test(asked)) return asked;
  return MAP_STYLES[asked.toLowerCase()] || MAP_STYLES.duong;
}

const MAP_HOME = { lng: 105.8412, lat: 21.0293, zoom: 11.4 };
const MAP_LIMIT = [
  [104.8, 19.9],
  [107.2, 22.1],
];

let mapMode = false;
let mapLib = null;
let mapObj = null;
let mapHost = null;
let mapBooting = null;
let mapHere = null;
let mapLastError = "";
const mapMarkers = new Map();

// `map.isStyleLoaded()` trả về false cả khi chỉ có một nguồn đang tải dở —
// kể cả nguồn do chính mình vừa thêm vào. Dùng nó làm cổng cho việc thêm lớp
// thì lớp thêm sau sẽ bị chặn bởi lớp thêm trước, im lặng và rất khó dò.
// Cái thật sự cần biết là "style đã dựng xong chưa", nên giữ riêng cờ này.
let mapStyleReady = false;

function styleReady() {
  return Boolean(mapObj) && (mapStyleReady || mapObj.isStyleLoaded());
}

function isPhone() {
  return window.matchMedia("(max-width: 54rem)").matches;
}

// Chừa chỗ cho thanh điều hướng bên trái (máy tính) hoặc dải chip dưới đáy
// (điện thoại), để điểm được chọn không nằm khuất sau HUD.
function mapPadding() {
  if (isPhone()) return { top: 76, right: 24, bottom: 200, left: 24 };
  return { top: 96, right: 96, bottom: 64, left: 392 };
}

function ensureMapHost() {
  if (mapHost) return mapHost;
  mapHost = document.createElement("div");
  mapHost.id = "realMap";
  mapHost.className = "real-map";
  mapHost.setAttribute("aria-hidden", "true");
  const shell = document.querySelector("#app");
  shell?.insertBefore(mapHost, document.querySelector("#labelsLayer"));
  return mapHost;
}

async function loadMap() {
  if (mapObj) return mapObj;
  if (mapBooting) return mapBooting;
  mapBooting = (async () => {
    // Tải trễ: gói MapLibre nằm ở chunk riêng, chỉ về máy khi thật sự cần.
    const [mod] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
    // v5 xuất default, v6 xuất theo tên — nhận cả hai.
    const lib = mod?.Map ? mod : mod.default;
    mapLib = lib;
    const host = ensureMapHost();
    const phone = isPhone();
    const map = new lib.Map({
      container: host,
      style: mapStyleUrl(),
      center: [MAP_HOME.lng, MAP_HOME.lat],
      zoom: MAP_HOME.zoom,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: MAP_LIMIT,
      attributionControl: { compact: true },
      hash: false,
    });

    const corner = phone ? "top-left" : "bottom-right";
    if (!phone) map.addControl(new lib.NavigationControl({ visualizePitch: true }), corner);
    const geo = new lib.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: false, // đã có chấm "bạn ở đây" dùng chung với bản 3D
    });
    geo.on("geolocate", (event) => {
      const coords = event?.coords;
      if (!coords) return;
      userPos = { lat: coords.latitude, lng: coords.longitude };
      document.querySelector("#nearMe")?.classList.add("is-on");
      syncMapHere();
      const chosen = state.selectedId ? STARTUPS.find((s) => s.id === state.selectedId) : null;
      if (chosen) renderStartupDetail(chosen);
    });
    map.addControl(geo, corner);
    // Thước tỉ lệ: máy tính đặt cùng góc dưới phải, điện thoại đẩy xuống góc
    // dưới trái cho khỏi chồng lên nút định vị.
    map.addControl(new lib.ScaleControl({ maxWidth: 88, unit: "metric" }), phone ? "bottom-left" : corner);

    // Giữ lỗi cuối của bản đồ để còn dò được khi có máy báo "bản đồ trắng".
    map.on("error", (event) => {
      mapLastError = String(event?.error?.message || event?.error || event || "").slice(0, 240);
    });
    map.on("click", (event) => {
      const pos = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      if (mapLayerState.ward || mapLayerState.qh) {
        if (mapLayerState.ward) tellWardAt(pos);
        if (mapLayerState.qh) tellQhAt(pos);
        return;
      }
      clearSelection();
    });
    map.on("zoom", syncMapZoom);
    // Style có thể nạp lại (đổi nền, mất mạng rồi vào lại) — mỗi lần xong thì
    // đặt lại ngôn ngữ nhãn cho khớp nút VI | EN.
    map.on("style.load", () => {
      mapStyleReady = true;
      applyMapLanguage();
      syncMapLayers();
    });

    // Chỉ chờ style JSON, không chờ vẽ xong: mạng yếu thì bản đồ hiện ra trước
    // rồi tự đổ ảnh vào sau, nút bấm không bao giờ treo.
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      if (map.isStyleLoaded()) {
        finish();
        return;
      }
      map.once("style.load", finish);
      map.once("load", finish);
      setTimeout(finish, 9000);
    });

    mapObj = map;
    applyMapLanguage();
    buildMapMarkers();
    syncMapZoom();
    syncMapHere();
    return map;
  })();

  try {
    return await mapBooting;
  } catch (error) {
    mapBooting = null; // cho phép bấm lại sau khi có mạng
    throw error;
  }
}

/* ---------- Pin trên nền bản đồ thật ---------- */

function buildMapMarkers() {
  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers.clear();
  if (!mapObj || !mapLib) return;

  STARTUPS.forEach((item) => {
    const pos = realPos(item);
    const el = document.createElement("button");
    el.type = "button";
    el.className = `map-pin map-pin--${STAGE_SLUG[item.stage] || "an"}`;
    el.dataset.id = item.id;
    el.dataset.stage = item.stage;
    if (!hasRealPos(item)) el.classList.add("is-approx");
    el.innerHTML =
      `<span class="map-pin__dot"><img class="map-pin__logo" src="${logoPath(item)}" alt="" ` +
      `data-stage="${escapeHtml(item.stage)}" /></span><span class="map-pin__name"></span>`;
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      selectStartup(item.id);
    });
    const marker = new mapLib.Marker({ element: el, anchor: "center" })
      .setLngLat([pos.lng, pos.lat])
      .addTo(mapObj);
    mapMarkers.set(item.id, marker);
  });

  renderMapPinNames();
  syncMapMarkers();
}

function renderMapPinNames() {
  if (!mapObj) return;
  mapMarkers.forEach((marker, id) => {
    const item = STARTUPS.find((s) => s.id === id);
    const el = marker.getElement();
    const name = el.querySelector(".map-pin__name");
    if (!item || !name) return;
    name.textContent = item.name;
    const note = hasRealPos(item) ? "" : ` — ${t("mapApprox")}`;
    el.title = `${item.name} · ${stageLabel(item.stage)}${note}`;
  });
}

// Bộ lọc Ăn / Chơi / Ở và điểm đang chọn dùng chung một trạng thái với bản 3D.
function syncMapMarkers() {
  if (!mapObj) return;
  mapMarkers.forEach((marker, id) => {
    const item = STARTUPS.find((s) => s.id === id);
    const el = marker.getElement();
    const on = Boolean(item) && stageAllowed(item);
    el.classList.toggle("is-off", !on);
    el.classList.toggle("is-active", on && state.selectedId === id);
    el.tabIndex = on ? 0 : -1;
  });
}

// Xa thì chỉ hiện chấm màu; đủ gần mới bung tên ra, tránh chữ chồng chữ.
function syncMapZoom() {
  if (!mapObj || !mapHost) return;
  // Màn hình điện thoại hẹp nên phải phóng gần hơn mới bung tên, không thì
  // chữ chồng lên nhau đọc không ra.
  const from = isPhone() ? 15.2 : 13.4;
  mapHost.classList.toggle("show-names", mapObj.getZoom() >= from);
}

function syncMapHere() {
  if (!mapObj || !mapLib || !userPos) return;
  if (!mapHere) {
    const el = document.createElement("div");
    el.className = "map-here";
    el.title = t("youAreHere");
    mapHere = new mapLib.Marker({ element: el }).setLngLat([userPos.lng, userPos.lat]).addTo(mapObj);
    return;
  }
  mapHere.setLngLat([userPos.lng, userPos.lat]);
}

// Nhãn trên nền bản đồ đổi theo nút VI | EN. OpenStreetMap ghi tên tiếng Việt
// ở trường `name`, khách nước ngoài thì lấy `name:en` rồi mới đến bản Latin.
function applyMapLanguage() {
  if (!mapObj?.isStyleLoaded?.()) return;
  const field =
    LANG === "en"
      ? ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]
      : ["coalesce", ["get", "name:vi"], ["get", "name"], ["get", "name:latin"]];
  const layers = mapObj.getStyle()?.layers || [];
  layers.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.layout || !("text-field" in layer.layout)) return;
    try {
      mapObj.setLayoutProperty(layer.id, "text-field", field);
    } catch {
      /* lớp nào không đổi được thì để nguyên, không chặn cả bản đồ */
    }
  });
}

/* ---------- Bay tới, dùng chung với camera 3D ---------- */

function mapFocusPlace(item, { instant = false } = {}) {
  if (!mapMode || !mapObj || !mapLib || !item) return;
  const pos = realPos(item);
  // Đóng khung một ô ~200 m quanh điểm rồi để fitBounds tự lo phần chừa chỗ
  // cho HUD — như vậy khung hình không bao giờ rơi vào sau thanh bên.
  const box = 0.0018;
  const bounds = new mapLib.LngLatBounds(
    [pos.lng - box, pos.lat - box],
    [pos.lng + box, pos.lat + box],
  );
  mapObj.fitBounds(bounds, {
    padding: mapPadding(),
    maxZoom: 17,
    duration: instant ? 0 : 900,
  });
}

function mapFocusArea(areaId, { instant = false } = {}) {
  if (!mapMode || !mapObj || !mapLib) return;
  const items = visibleItems(areaId);
  if (!items.length) return;
  const bounds = new mapLib.LngLatBounds();
  items.forEach((item) => {
    const pos = realPos(item);
    bounds.extend([pos.lng, pos.lat]);
  });
  const camera = mapObj.cameraForBounds(bounds, { padding: mapPadding(), maxZoom: 15.4 });
  if (!camera) return;
  // Vừa khít cả 52 điểm thì trên điện thoại phố xá bé như hạt vừng: ép một mức
  // phóng tối thiểu để còn đọc được tên đường, ai muốn xem rộng cứ chụm tay ra.
  const floor = isPhone() ? 12.1 : 11.6;
  mapObj.easeTo({
    center: camera.center,
    zoom: Math.max(camera.zoom, floor),
    duration: instant ? 0 : 1100,
  });
}

/* ---------- Lật qua lại 3D ⇄ bản đồ thật ---------- */

async function setMapMode(next, { silent = false } = {}) {
  const want = Boolean(next);
  if (want === mapMode) return;
  const button = document.querySelector("#mapMode");

  if (want) {
    if (!mapObj) {
      button?.classList.add("is-busy");
      toast(t("mapLoading"), 8000);
    }
    try {
      await loadMap();
    } catch {
      button?.classList.remove("is-busy");
      toast(t("mapFail"), 5200);
      return;
    }
    button?.classList.remove("is-busy");
  }

  mapMode = want;
  document.body.classList.toggle("is-map", mapMode);
  mapHost?.classList.toggle("is-on", mapMode);
  mapHost?.setAttribute("aria-hidden", mapMode ? "false" : "true");
  button?.classList.toggle("is-on", mapMode);
  applyLanguage({ silent: true });
  renderMapNote();

  if (mapMode && mapObj) {
    mapObj.resize();
    syncMapMarkers();
    syncMapHere();
    syncMapLayers();
    const chosen = state.selectedId ? STARTUPS.find((s) => s.id === state.selectedId) : null;
    if (chosen) mapFocusPlace(chosen, { instant: true });
    else mapFocusArea(state.activeAreaId, { instant: true });
    if (!silent) toast(t("mapHint"), 4200);
  }

  syncModeUrl();
}

function syncModeUrl() {
  const params = new URLSearchParams(location.search);
  if (mapMode) params.set("che-do", "ban-do");
  else params.delete("che-do");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function bootMapMode() {
  const asked = (QUERY.get("che-do") || QUERY.get("mode") || "").toLowerCase();
  if (asked === "ban-do" || asked === "map" || asked === "street") setMapMode(true, { silent: true });
}

// Phím M lật chế độ, trừ khi đang gõ trong ô tìm kiếm.
window.addEventListener("keydown", (event) => {
  if (event.key !== "m" && event.key !== "M") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
  if (searchModal?.open) return;
  event.preventDefault();
  setMapMode(!mapMode);
});

/* ==========================================================================
   NGUỒN & ĐỐI CHIẾU · SOURCES AND CITATIONS
   Nguyên tắc của dự án: bất kỳ điều gì bản đồ khẳng định mà dựa vào văn bản
   nhà nước đều phải ghi rõ số hiệu, cơ quan ban hành, ngày ký, ngày hiệu lực
   và kèm link mở thẳng văn bản gốc — người dân tự đọc, không phải tin lời
   một cái app. Chỗ nào văn bản chưa quy định thì ghi thẳng "chưa công bố"
   chứ không suy diễn: đi nhầm đường vì một khung giờ bịa ra là mất tiền thật.
   Mọi lớp dữ liệu pháp lý thêm về sau bắt buộc khai `sources` ở đây.
   Mở bằng #/nguon, chạm vào huy hiệu thời tiết, hoặc link ở chân thanh bên.
   ========================================================================== */

// Ngày gần nhất người làm ngồi mở lại từng văn bản để đối chiếu.
const SOURCE_CHECKED = "2026-08-06";
const SOURCE_STALE_DAYS = 180;

const SOURCES = [
  {
    id: "luat-thu-do-2024",
    group: "law",
    kind: "Luật",
    kindEn: "Law",
    ref: "Luật Thủ đô số 39/2024/QH15",
    title: "Luật Thủ đô — điểm a khoản 2 Điều 28 cho phép Hà Nội lập vùng phát thải thấp",
    titleEn: "Law on the Capital — Article 28(2)(a) lets Hanoi create a low-emission zone",
    body: "Quốc hội",
    bodyEn: "National Assembly",
    signed: "2024-06-28",
    uses: "Căn cứ pháp lý gốc của vùng phát thải thấp; mọi lớp liên quan đều quy về đây.",
    usesEn: "The root legal basis for the low-emission zone; every related layer traces back to it.",
    note: "Link là bản hợp nhất 114/VBHN-VPQH do Văn phòng Quốc hội phát hành.",
    noteEn: "The link is consolidated text 114/VBHN-VPQH issued by the National Assembly Office.",
    url: "https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/114-vbhn-vpqh.pdf",
  },
  {
    id: "nq-57-2025",
    group: "law",
    kind: "Nghị quyết",
    kindEn: "Resolution",
    ref: "Nghị quyết 57/2025/NQ-HĐND",
    title: "Quy định thực hiện vùng phát thải thấp trên địa bàn thành phố Hà Nội",
    titleEn: "Rules for running the low-emission zone in Hanoi",
    body: "HĐND thành phố Hà Nội · kỳ họp thứ 28",
    bodyEn: "Hanoi People's Council · 28th session",
    signed: "2025-11-26",
    effective: "2025-12-10",
    replaces: "Nghị quyết 47/2024/NQ-HĐND ngày 12/12/2024",
    replacesEn: "Resolution 47/2024/NQ-HĐND of 12 Dec 2024",
    uses: "Danh sách 9 phường và mốc thời gian của vùng phát thải thấp.",
    usesEn: "The list of nine wards and the dates of the low-emission zone.",
    note: "Giai đoạn 01/7/2026 – 31/12/2027 chỉ thí điểm một số khu vực trong Vành đai 1, thuộc 9 phường: Hai Bà Trưng, Cửa Nam, Hoàn Kiếm, Ô Chợ Dừa, Văn Miếu, Ba Đình, Giảng Võ, Ngọc Hà, Tây Hồ. Không phải cấm cả phường.",
    noteEn: "From 1 Jul 2026 to 31 Dec 2027 the zone is a pilot inside parts of Ring Road 1, across nine wards: Hai Bà Trưng, Cửa Nam, Hoàn Kiếm, Ô Chợ Dừa, Văn Miếu, Ba Đình, Giảng Võ, Ngọc Hà, Tây Hồ. It is not a whole-ward ban.",
    url: "https://vanban.hanoi.gov.vn/chi-tiet-van-ban/quy-dinh-thuc-hien-vung-phat-thai-thap-tren-dia-ban-thanh-pho-ha-noi-thuc-hien-diem-a-khoan-2-dieu--228371",
  },
  {
    id: "ct-20-2025",
    group: "law",
    kind: "Chỉ thị",
    kindEn: "Directive",
    ref: "Chỉ thị 20/CT-TTg",
    title: "Một số nhiệm vụ cấp bách, quyết liệt ngăn chặn, giải quyết tình trạng ô nhiễm môi trường",
    titleEn: "Urgent tasks to halt and resolve environmental pollution",
    body: "Thủ tướng Chính phủ · Phạm Minh Chính ký",
    bodyEn: "Prime Minister · signed by Phạm Minh Chính",
    signed: "2025-07-12",
    uses: "Mốc 01/7/2026 với Vành đai 1, 01/01/2028 với Vành đai 1–2 và từ 2030 mở ra Vành đai 3.",
    usesEn: "The 1 Jul 2026 Ring Road 1 milestone, 1 Jan 2028 for Ring Roads 1–2, and 2030 out to Ring Road 3.",
    url: "https://vanban.chinhphu.vn/?docid=214542&pageid=27160",
  },
  {
    id: "nq-1656-2025",
    group: "law",
    kind: "Nghị quyết",
    kindEn: "Resolution",
    ref: "Nghị quyết 1656/NQ-UBTVQH15",
    title: "Sắp xếp các đơn vị hành chính cấp xã của thành phố Hà Nội năm 2025",
    titleEn: "2025 rearrangement of Hanoi's commune-level administrative units",
    body: "Ủy ban Thường vụ Quốc hội · Trần Thanh Mẫn ký",
    bodyEn: "National Assembly Standing Committee · signed by Trần Thanh Mẫn",
    signed: "2025-06-16",
    effective: "2025-07-01",
    uses: "Bộ 126 phường, xã mới của Hà Nội (51 phường + 75 xã) dùng cho phần tra phường sau sáp nhập.",
    usesEn: "Hanoi's 126 new wards and communes (51 wards + 75 communes) behind the ward lookup.",
    url: "https://vanban.chinhphu.vn/?pageid=27160&docid=214008",
  },
  {
    id: "qd-1668-2024",
    group: "law",
    kind: "Quyết định",
    kindEn: "Decision",
    ref: "Quyết định 1668/QĐ-TTg",
    title: "Phê duyệt Điều chỉnh Quy hoạch chung Thủ đô Hà Nội đến năm 2045, tầm nhìn đến năm 2065",
    titleEn: "Approving the revised Hanoi master plan to 2045, with a vision to 2065",
    body: "Thủ tướng Chính phủ · Trần Hồng Hà ký",
    bodyEn: "Prime Minister · signed by Trần Hồng Hà",
    signed: "2024-12-27",
    uses: "5 vùng đô thị và 5 trục không gian trong lớp Quy hoạch 2045. Bản đồ chỉ vẽ lại lời văn, không thay được bản đồ quy hoạch pháp lý.",
    usesEn: "The five urban zones and five spatial axes in the 2045 plan layer. The map redraws the wording and does not replace a legal planning map.",
    note: "Quyết định mô tả từng vùng bằng danh sách quận, huyện CŨ. Từ 01/7/2025 Hà Nội bỏ cấp huyện, nên bản đồ phải quy chiếu sang 126 phường xã mới — ranh giới vùng vì thế chỉ là tương đối. Văn bản cũng không kèm toạ độ cho 5 trục.",
    noteEn: "The decision describes each zone as a list of OLD districts. Hanoi abolished the district tier on 1 July 2025, so this map projects them onto the 126 new wards, making zone edges approximate. The document also gives no coordinates for the five axes.",
    url: "https://chinhphu.vn/?pageid=27160&docid=212179",
  },
  {
    id: "geoboundaries",
    group: "data",
    kind: "Dữ liệu mở",
    kindEn: "Open data",
    ref: "geoBoundaries (VNM ADM2, 2020)",
    title: "Ranh giới quận, huyện Việt Nam trước sáp nhập, dùng để đối chiếu phường xã mới với huyện cũ",
    titleEn: "Vietnam's pre-merger district boundaries, used to match new wards to old districts",
    body: "William & Mary geoLab · giấy phép CC BY 4.0 · nguồn gốc OCHA ROAP và Chính phủ Việt Nam",
    bodyEn: "William & Mary geoLab · CC BY 4.0 · sourced from OCHA ROAP and the Government of Viet Nam",
    uses: "Xếp 126 phường xã mới vào 30 quận huyện cũ bằng cách lấy mẫu lưới trong từng ranh giới rồi bỏ phiếu đa số. Kết quả khớp đúng số lượng của Nghị quyết 1656 ở cả 30 đơn vị.",
    usesEn: "Assigns the 126 new wards to the 30 old districts by grid-sampling each boundary and taking a majority vote. The per-district counts match Resolution 1656 exactly for all 30.",
    url: "https://www.geoboundaries.org/countryDownloads.html",
  },
  {
    id: "qd-1459-2019",
    group: "law",
    kind: "Quyết định",
    kindEn: "Decision",
    ref: "Quyết định 1459/QĐ-TCMT",
    title: "Hướng dẫn kỹ thuật tính toán và công bố chỉ số chất lượng không khí Việt Nam (VN_AQI)",
    titleEn: "Technical guidance for calculating and publishing Vietnam's Air Quality Index (VN_AQI)",
    body: "Tổng cục Môi trường, Bộ Tài nguyên và Môi trường",
    bodyEn: "Vietnam Environment Administration, Ministry of Natural Resources and Environment",
    signed: "2019-11-12",
    uses: "Bảng BPi, công thức nội suy, sáu mức chất lượng kèm mã màu RGB, và toàn bộ khuyến cáo sức khoẻ trong bảng Không khí hôm nay.",
    usesEn: "The BPi table, the interpolation formula, the six quality bands with their official RGB codes, and every health recommendation in the air quality sheet.",
    note: "Bản đồ tính AQI NGÀY: bụi lấy trung bình 24 giờ, khí lấy giá trị 1 giờ lớn nhất trong ngày, đúng như mục 2.2.2 của quyết định. Không tính AQI giờ vì hệ số Nowcast trong văn bản in dưới dạng công thức ảnh, không chép lại chắc chắn được — thà đúng một chỉ số còn hơn đoán hai. Nồng độ đầu vào lấy từ Open-Meteo chứ không phải trạm quan trắc nhà nước, nên đây là ước lượng, không phải số liệu chính thức.",
    noteEn: "The map computes the DAILY index: 24-hour means for particulates, the day's highest hourly value for gases, exactly as section 2.2.2 specifies. It does not compute the hourly index, because the decision prints the Nowcast weighting as an image formula we could not transcribe with confidence — better one index right than two guessed. Concentrations come from Open-Meteo, not state monitoring stations, so this is an estimate rather than an official reading.",
    url: "https://cem.gov.vn/storage/news_file_attach/QD%201459%20TCMT%20ngay%2012.11.2019%20AQI.pdf",
  },
  {
    id: "osm",
    group: "data",
    kind: "Dữ liệu mở",
    kindEn: "Open data",
    ref: "OpenStreetMap",
    title: "Nền đường phố và toạ độ thực địa của 45/52 địa điểm",
    titleEn: "Street base map and real-world coordinates for 45 of 52 places",
    body: "Cộng đồng OpenStreetMap · giấy phép ODbL",
    bodyEn: "OpenStreetMap contributors · ODbL licence",
    uses: "Toạ độ dò bằng Nominatim, ngưỡng loại 900 m, sai lệch trung bình 192 m.",
    usesEn: "Coordinates matched with Nominatim, 900 m rejection ceiling, 192 m average offset.",
    url: "https://www.openstreetmap.org/copyright",
  },
  {
    id: "openfreemap",
    group: "data",
    kind: "Dịch vụ",
    kindEn: "Service",
    ref: "OpenFreeMap",
    title: "Máy chủ tile cho chế độ bản đồ đường phố thật",
    titleEn: "Tile server behind the real street-map mode",
    body: "OpenFreeMap · miễn phí, không cần API key",
    bodyEn: "OpenFreeMap · free, no API key",
    uses: "Nền liberty. Đổi nền bằng ?nen=duong|sang|dam.",
    usesEn: "The liberty style. Switch with ?nen=duong|sang|dam.",
    url: "https://openfreemap.org",
  },
  {
    id: "open-meteo",
    group: "data",
    kind: "API",
    kindEn: "API",
    ref: "Open-Meteo",
    title: "Thời tiết và chất lượng không khí Hà Nội theo thời gian thực",
    titleEn: "Live Hanoi weather and air quality",
    body: "Open-Meteo · miễn phí, không cần API key",
    bodyEn: "Open-Meteo · free, no API key",
    uses: "Huy hiệu góc phải trên, bầu trời – sương – mưa – đèn của cảnh 3D, và nồng độ sáu chất ô nhiễm để tính VN_AQI. Tự làm mới mỗi 15 phút.",
    usesEn: "The top-right badge, the sky, fog, rain and lights of the 3D scene, and the six pollutant concentrations behind the VN_AQI figure. Refreshes every 15 minutes.",
    url: "https://open-meteo.com",
  },
];

// Những chỗ cố tình để trống. Ghi ra đây để người dùng biết bản đồ đang
// thiếu gì, thay vì đoán bừa rồi họ đi nhầm.
const SOURCE_GAPS = [
  {
    what: "Khung giờ cấm cụ thể trong vùng phát thải thấp",
    whatEn: "The exact restricted hours inside the low-emission zone",
    why: "Nghị quyết 57/2025/NQ-HĐND nêu loại phương tiện và mốc thời gian, nhưng không ấn định giờ. Chi tiết chờ đề án của UBND thành phố. Khi nào có văn bản, bản đồ mới hiện giờ.",
    whyEn: "Resolution 57/2025/NQ-HĐND names the vehicle classes and the dates but sets no hours. The detail waits on the city government's implementation scheme. The map will show hours only once a document exists.",
    ref: "nq-57-2025",
  },
  {
    what: "Ranh giới chính xác của khu vực thí điểm trong Vành đai 1",
    whatEn: "The exact outline of the pilot area inside Ring Road 1",
    why: "Nghị quyết nêu 9 phường nhưng vùng thí điểm chỉ là một số khu vực trong đó. Bản đồ vẽ ranh giới phường để bạn biết đại khái ở đâu, không dùng thay bản đồ cấm đường.",
    whyEn: "The resolution names nine wards, but the pilot covers only parts of them. The map draws ward outlines so you know roughly where, not as a substitute for an official restriction map.",
    ref: "nq-57-2025",
  },
  {
    what: "Số liệu quan trắc chính thức của trạm nhà nước",
    whatEn: "Official readings from state monitoring stations",
    why: "Chỉ số VN_AQI trên bản đồ tính từ nồng độ mô hình hoá của Open-Meteo, không phải từ trạm quan trắc của Bộ Nông nghiệp và Môi trường hay của thành phố. Cách tính thì theo đúng Quyết định 1459, nhưng đầu vào là ước lượng. Cần con số chính thức thì xem bản tin của cơ quan quản lý.",
    whyEn: "The VN_AQI shown here is computed from Open-Meteo's modelled concentrations, not from the ministry's or the city's monitoring stations. The method follows Decision 1459 exactly, but the input is an estimate. For official figures, check the regulator's bulletins.",
    ref: "qd-1459-2019",
  },
];

const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((item) => [item.id, item]));

// Lớp dữ liệu nào cũng phải khai nguồn trước khi vẽ. Thiếu là kêu ngay ở
// console lúc phát triển, chứ không im lặng phát hành một lớp vô căn cứ.
const LAYER_SOURCES = new Map();

function registerLayer(layerId, sourceIds) {
  const ids = (sourceIds || []).filter((id) => SOURCE_BY_ID[id]);
  if (!ids.length) {
    console.warn(`[nguồn] lớp "${layerId}" chưa khai văn bản nào — không được vẽ dữ liệu pháp lý.`);
    return false;
  }
  LAYER_SOURCES.set(layerId, ids);
  return true;
}

function dmy(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}

function daysSince(iso) {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 86400000));
}

function srcText(item, key) {
  return LANG === "en" ? (item[`${key}En`] ?? item[key] ?? "") : (item[key] ?? "");
}

let sourceDialog = null;
let sourceReturnHash = "";

function sourceCard(item) {
  const meta = [
    escapeHtml(srcText(item, "body")),
    item.signed ? escapeHtml(t("srcSigned", { d: dmy(item.signed) })) : null,
    item.effective ? escapeHtml(t("srcEffective", { d: dmy(item.effective) })) : null,
  ].filter(Boolean);

  return `
    <article class="src-card">
      <p class="src-card__ref"><span class="src-card__kind">${escapeHtml(srcText(item, "kind"))}</span>${escapeHtml(item.ref)}</p>
      <h3>${escapeHtml(srcText(item, "title"))}</h3>
      <p class="src-card__meta">${meta.join(" · ")}</p>
      ${item.replaces ? `<p class="src-card__meta">${escapeHtml(t("srcReplaces", { v: srcText(item, "replaces") }))}</p>` : ""}
      <p class="src-card__use"><b>${escapeHtml(t("srcUse"))}:</b> ${escapeHtml(srcText(item, "uses"))}</p>
      ${item.note ? `<p class="src-card__note">${escapeHtml(srcText(item, "note"))}</p>` : ""}
      <a class="src-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">
        ${escapeHtml(item.group === "law" ? t("srcOpen") : t("srcOpenData"))} <span aria-hidden="true">↗</span>
      </a>
    </article>`;
}

function renderSources() {
  if (!sourceDialog) return;
  const stale = daysSince(SOURCE_CHECKED) > SOURCE_STALE_DAYS;
  const laws = SOURCES.filter((item) => item.group === "law");
  const data = SOURCES.filter((item) => item.group === "data");

  sourceDialog.innerHTML = `
    <div class="src-sheet__head">
      <div>
        <h2>${escapeHtml(t("srcTitle"))}</h2>
        <p class="src-sheet__checked">${escapeHtml(t("srcChecked", { d: dmy(SOURCE_CHECKED) }))}</p>
      </div>
      <button class="src-sheet__close" type="button" aria-label="${escapeHtml(t("srcClose"))}">✕</button>
    </div>
    <p class="src-sheet__lead">${escapeHtml(t("srcLead"))}</p>
    ${stale ? `<p class="src-sheet__stale">${escapeHtml(t("srcStale", { n: daysSince(SOURCE_CHECKED) }))}</p>` : ""}

    <h4 class="src-sheet__group">${escapeHtml(t("srcGroupLaw"))}</h4>
    ${laws.map(sourceCard).join("")}

    <h4 class="src-sheet__group">${escapeHtml(t("srcGroupData"))}</h4>
    ${data.map(sourceCard).join("")}

    <h4 class="src-sheet__group">${escapeHtml(t("srcGroupGap"))}</h4>
    <p class="src-sheet__lead">${escapeHtml(t("srcGapLead"))}</p>
    ${SOURCE_GAPS.map((gap) => {
      const ref = SOURCE_BY_ID[gap.ref];
      return `
      <article class="src-card src-card--gap">
        <h3>${escapeHtml(LANG === "en" ? gap.whatEn : gap.what)}</h3>
        <p class="src-card__use">${escapeHtml(LANG === "en" ? gap.whyEn : gap.why)}</p>
        ${ref ? `<a class="src-card__link" href="${escapeHtml(ref.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(ref.ref)} <span aria-hidden="true">↗</span></a>` : ""}
      </article>`;
    }).join("")}
  `;

  sourceDialog.querySelector(".src-sheet__close")?.addEventListener("click", () => closeSources());
}

function ensureSourceDialog() {
  if (sourceDialog) return sourceDialog;
  sourceDialog = document.createElement("dialog");
  sourceDialog.id = "sourceSheet";
  sourceDialog.className = "src-sheet";
  sourceDialog.setAttribute("aria-label", t("srcTitle"));
  sourceDialog.addEventListener("close", () => {
    if (location.hash === "#/nguon") history.replaceState(null, "", `${location.pathname}${location.search}${sourceReturnHash}`);
  });
  sourceDialog.addEventListener("click", (event) => {
    if (event.target === sourceDialog) closeSources();
  });
  document.body.appendChild(sourceDialog);
  return sourceDialog;
}

function openSources() {
  ensureSourceDialog();
  renderSources();
  if (!sourceDialog.open) {
    sourceReturnHash = location.hash === "#/nguon" ? "" : location.hash;
    sourceDialog.showModal();
    if (location.hash !== "#/nguon") history.replaceState(null, "", `${location.pathname}${location.search}#/nguon`);
  }
}

function closeSources() {
  if (sourceDialog?.open) sourceDialog.close();
}

function bootSources() {
  // Link "Nguồn & đối chiếu" ở chân thanh bên, và deep-link #/nguon.
  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[data-sources]");
    if (!link) return;
    event.preventDefault();
    openSources();
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#/nguon") openSources();
  });
  if (location.hash === "#/nguon") openSources();
}

/* ==========================================================================
   LỚP VÙNG PHÁT THẢI THẤP + TRẠM SẠC · LOW-EMISSION ZONE & EV CHARGING
   Chồng lên nền bản đồ đường phố thật. Hai lớp này nói về quy định thật ngoài
   đường nên phải khai nguồn (registerLayer) và phải nói rõ giới hạn của mình:
   đường kẻ là ranh giới PHƯỜNG, vùng thí điểm chỉ là một phần bên trong, và
   khung giờ cấm thì chưa có văn bản nào công bố nên bản đồ không hiện giờ.
   ========================================================================== */

// Ranh giới 9 phường có vùng phát thải thấp, lấy từ OpenStreetMap
// (admin_level=6, mức phường sau sáp nhập 2025) rồi rút gọn Douglas–Peucker
// ngưỡng 25 m: 756 xuống 171 đỉnh, lệch tối đa 28 m so với ranh giới gốc.
// Đủ đúng để chỉ chỗ ở mức phóng người ta dùng, và dù sao đây cũng không
// phải bản đồ pháp lý.
const LEZ_WARDS = [
  ["Hoàn Kiếm", [[21.0349,105.8549],[21.0279,105.8583],[21.025,105.8602],[21.0244,105.8569],[21.028,105.8442],[21.0291,105.8426],[21.0342,105.8437],[21.0341,105.8448],[21.0349,105.8449],[21.0351,105.8439],[21.0394,105.8447],[21.0392,105.8454],[21.04,105.8456],[21.0398,105.8468],[21.0408,105.8501],[21.0349,105.8549]]],
  ["Ba Đình", [[21.0289,105.8416],[21.0283,105.8416],[21.0291,105.8426],[21.0342,105.8437],[21.0341,105.8448],[21.0349,105.8449],[21.0351,105.8439],[21.0394,105.8447],[21.0392,105.8454],[21.04,105.8456],[21.0398,105.8468],[21.0408,105.8501],[21.0506,105.8402],[21.0501,105.8394],[21.0473,105.8379],[21.0468,105.8367],[21.0439,105.8362],[21.0428,105.8358],[21.0428,105.8353],[21.0418,105.8353],[21.0416,105.8307],[21.0396,105.8287],[21.0397,105.8274],[21.0373,105.8266],[21.0371,105.8284],[21.0347,105.828],[21.0347,105.8272],[21.0321,105.827],[21.0325,105.829],[21.0289,105.8416]]],
  ["Cửa Nam", [[21.027,105.8478],[21.0244,105.8569],[21.025,105.8602],[21.0185,105.862],[21.0184,105.8609],[21.019,105.8587],[21.0179,105.8542],[21.019,105.8477],[21.0207,105.8414],[21.0283,105.8416],[21.0291,105.8426],[21.0284,105.8433],[21.027,105.8478]]],
  ["Hai Bà Trưng", [[21.0087,105.8633],[21.0092,105.8562],[21.0077,105.8414],[21.0207,105.8414],[21.019,105.8477],[21.0179,105.8542],[21.019,105.8587],[21.0184,105.8609],[21.0185,105.862],[21.0122,105.8636],[21.0103,105.8645],[21.0088,105.8659],[21.0087,105.8633]]],
  ["Văn Miếu - Quốc Tử Giám", [[21.0304,105.8361],[21.0289,105.8416],[21.0077,105.8414],[21.0082,105.8397],[21.0089,105.8389],[21.016,105.8324],[21.0182,105.8297],[21.0278,105.8342],[21.0304,105.8361]]],
  ["Ô Chợ Dừa", [[21.0305,105.8358],[21.0322,105.83],[21.0313,105.8297],[21.0277,105.8248],[21.0234,105.8198],[21.0166,105.8149],[21.0139,105.8188],[21.0161,105.8209],[21.0167,105.8235],[21.0208,105.8257],[21.0182,105.8297],[21.0278,105.8342],[21.0304,105.8361],[21.0305,105.8358]]],
  ["Giảng Võ", [[21.0302,105.8013],[21.0286,105.8042],[21.0274,105.8093],[21.025,105.8113],[21.0199,105.8082],[21.0166,105.8149],[21.0234,105.8198],[21.0277,105.8248],[21.0313,105.8297],[21.0322,105.83],[21.0325,105.829],[21.0306,105.8159],[21.0313,105.8133],[21.0339,105.814],[21.0355,105.8088],[21.0362,105.8083],[21.0371,105.8063],[21.0328,105.8037],[21.0302,105.8013]]],
  ["Ngọc Hà", [[21.0397,105.8274],[21.0373,105.8266],[21.0371,105.8284],[21.0347,105.828],[21.0347,105.8272],[21.0321,105.827],[21.0306,105.8165],[21.0313,105.8133],[21.0339,105.814],[21.0355,105.8088],[21.0362,105.8083],[21.0371,105.8063],[21.0401,105.8062],[21.0403,105.8069],[21.0414,105.8065],[21.0454,105.8061],[21.048,105.8051],[21.0476,105.8056],[21.0478,105.8061],[21.0473,105.8082],[21.0464,105.8105],[21.0427,105.8152],[21.0418,105.8219],[21.0397,105.8274]]],
  ["Tây Hồ", [[21.0578,105.8352],[21.0531,105.8378],[21.0506,105.8402],[21.0501,105.8394],[21.0473,105.8379],[21.0468,105.8367],[21.0439,105.8362],[21.0428,105.8358],[21.0428,105.8353],[21.0418,105.8353],[21.0416,105.8307],[21.0395,105.8286],[21.0418,105.8219],[21.0427,105.8152],[21.0464,105.8105],[21.0473,105.8082],[21.0478,105.8061],[21.0476,105.8056],[21.048,105.8051],[21.0515,105.8045],[21.0622,105.8045],[21.0686,105.8081],[21.0761,105.8114],[21.0846,105.8167],[21.082,105.8176],[21.0774,105.8206],[21.0727,105.8257],[21.0681,105.8265],[21.0648,105.8292],[21.0646,105.8308],[21.0641,105.8316],[21.061,105.8328],[21.0578,105.8352]]],
];

// Trạm sạc xe điện từ OpenStreetMap (amenity=charging_station), gom về lưới
// ~11 m và mã hoá delta cho gọn: mỗi điểm là "dlat,dlng,vinfast" tính theo
// đơn vị 1e-4 độ, cộng dồn từ điểm trước.
const CHARGE_PACKED =
  "208577,1058697,1 306,-733,1 411,-116,1 6,-72,1 1,108,1 4,-36,1 18,656,1 1,-657,1 7,666,1 3,-596,1 4,-71,1 92,2362,0 1,0,0 0,1,0 1,0,0 28,-399,0 1,-1518,1 0,1518,0 0,1,0 0,1,0 22,11,1 1,0,0 1,-1,0 0,1,0 1,-1,0 1,-1290,1 0,1290,0 1,-1,0 1,0,0 1,-1,0 1,0,0 1,-1,0 14,-1284,1 20,-1020,1 43,50,1 33,-147,1 4,-11,1 6,1192,1 17,-1006,1 1,854,1 2,0,1 8,-207,1 0,205,1 1,1,1 2,-226,1 5,313,1 10,-975,0 10,141,1 12,227,1 24,855,1 0,1685,1 6,-1676,1 15,-20,1 3,-377,1 4,-8,1 6,-2,1 10,-505,1 12,-250,1 46,509,1 1,292,0 1,-762,1 2,0,1 28,322,1 12,475,1 3,1,1 14,-1088,1 9,2047,1 11,-6,1 1,-3,1 0,5,1 4,70,1 1,-5,1 1,1,1 3,-61,1 1,14,1 6,-38,1 1,4,1 1,-723,1 0,15,1 0,709,1 4,-1528,1 0,1689,1 2,-4,1 2,-126,1 0,120,1 3,-885,1 1,742,1 2,-4,1 7,-1525,1 5,1720,1 4,-177,1 1,0,1 2,182,1 3,-25,1 1,18,1 1,-186,1 2,-3,1 0,184,1 7,-928,1 2,0,1 2,771,1 10,-745,1 1,-2,1 2,-27,1 0,5,1 4,522,1 1,-1814,1 0,1304,1 2,-1305,1 2,0,1 2,1302,1 2,-1464,1 18,783,1 2,144,1 0,2,1 2,-106,1 1,-127,1 1,-81,1 0,207,1 1,-186,1 1,304,1 1,1,1 0,1273,1 1,-2,1 3,-2049,1 2,0,1 9,643,1 2,-644,1 2,28,1 6,155,1 0,268,1 2,-443,1 4,557,1 5,-552,1 0,550,1 1,-551,1 4,155,1 1,398,1 6,362,1 2,-398,1 2,-379,1 2,794,1 1,-792,1 4,5,1 2,-24,1 0,427,1 1,-556,1 5,15,1 4,25,1 2,0,1 4,7,1 1,-52,1 0,48,1 2,-35,1 0,759,1 6,325,1 33,-566,1 15,-95,1 0,2,1 20,-588,1 3,249,1 12,656,0 7,-870,0 2,1801,1 15,-1246,1 1,-3,1 27,272,1 1,-1,1 9,464,0 23,399,1 4,1006,1 43,-2143,1 5,331,1 3,1,1 18,-347,1 2,-201,1 7,595,1 1,-576,1 8,-17,1 0,350,1 0,1,1 1,-349,1 0,1734,1 1,1,1 17,-254,1 16,-1027,1 3,1013,1 10,-1654,1 1,1829,1 4,32,1 8,-201,1 3,-1347,1 3,-134,1 7,1444,1 3,-4,1 1,46,1 2,0,1 6,-891,1 0,926,1 8,-1431,1 9,1497,1 1,-129,1 2,131,1 16,-150,1 6,58,1 8,80,1 14,-11,1 4,-4,1 3,-71,1 2,15,1 0,70,1 2,-84,1 0,12,1 2,-1292,1 20,957,1 19,352,1 4,8,1 1,-274,1 32,294,1 2,3,1 33,-8,1 11,-1172,1 10,831,1 8,-525,1 5,-9,1 1,-1,1 16,791,1 3,-1189,1 16,254,1 9,-20,1 9,-245,1 38,282,1 119,414,1 0,8,0 7,9,0 4,-27,1 4,36,0 9,11,0 12,15,0 10,1004,1 1,-990,0 109,1011,1 94,-1340,1 108,1804,1 43,-1411,1 55,-1076,1 83,1139,1 71,-375,1 69,-1052,1 222,995,0 6,1258,1 22,626,1 163,-2879,1 15,883,1 2,-433,1 35,566,0 17,1188,1 54,450,1 263,106,1";

let chargeCache = null;

function chargePoints() {
  if (chargeCache) return chargeCache;
  let lat = 0;
  let lng = 0;
  chargeCache = CHARGE_PACKED.split(" ").map((token) => {
    const [dLat, dLng, vin] = token.split(",").map(Number);
    lat += dLat;
    lng += dLng;
    return { lat: lat / 1e4, lng: lng / 1e4, vin: vin === 1 };
  });
  return chargeCache;
}

// Tia ngang đếm số lần cắt cạnh — đủ cho 9 đa giác đơn.
function insideRing(pos, ring) {
  let inside = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i, i += 1) {
    const [latI, lngI] = ring[i];
    const [latK, lngK] = ring[k];
    if (latI > pos.lat !== latK > pos.lat && pos.lng < ((lngK - lngI) * (pos.lat - latI)) / (latK - latI) + lngI) {
      inside = !inside;
    }
  }
  return inside;
}

function lezWardOf(item) {
  const pos = realPos(item);
  if (!pos) return null;
  const hit = LEZ_WARDS.find(([, ring]) => insideRing(pos, ring));
  return hit ? hit[0] : null;
}

/* ---------- Bật tắt lớp trên nền MapLibre ---------- */

const mapLayerState = { lez: false, charge: false, ward: false, qh: false };

function lezGeoJson() {
  return {
    type: "FeatureCollection",
    features: LEZ_WARDS.map(([name, ring]) => ({
      type: "Feature",
      properties: { name },
      geometry: { type: "Polygon", coordinates: [ring.map(([lat, lng]) => [lng, lat])] },
    })),
  };
}

function chargeGeoJson() {
  return {
    type: "FeatureCollection",
    features: chargePoints().map((p) => ({
      type: "Feature",
      properties: { vin: p.vin ? 1 : 0 },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  };
}

let layerRetry = false;

function ensureMapLayers() {
  if (!mapObj) return false;
  // Style có thể còn đang tải (hoặc vừa đổi nền): chưa thêm lớp được thì hẹn
  // thử lại đúng một lần khi bản đồ rảnh, chứ không bỏ luôn như trước.
  if (!styleReady()) {
    if (!layerRetry) {
      layerRetry = true;
      mapObj.once("idle", () => {
        layerRetry = false;
        if (ensureMapLayers()) syncMapLayers();
      });
    }
    return false;
  }

  if (!mapObj.getSource("lez")) {
    mapObj.addSource("lez", { type: "geojson", data: lezGeoJson() });
    mapObj.addLayer({
      id: "lez-fill",
      type: "fill",
      source: "lez",
      layout: { visibility: "none" },
      paint: { "fill-color": "#d98324", "fill-opacity": 0.16 },
    });
    // Nét đứt là cố ý: nhắc rằng đây là ranh giới chỉ chỗ, không phải vạch cấm.
    mapObj.addLayer({
      id: "lez-line",
      type: "line",
      source: "lez",
      layout: { visibility: "none", "line-join": "round" },
      paint: { "line-color": "#b3651a", "line-width": 2, "line-dasharray": [3, 2] },
    });
    mapObj.on("click", "lez-fill", () => openLezNote());
    mapObj.on("mouseenter", "lez-fill", () => {
      mapObj.getCanvas().style.cursor = "pointer";
    });
    mapObj.on("mouseleave", "lez-fill", () => {
      mapObj.getCanvas().style.cursor = "";
    });
  }

  if (!mapObj.getSource("charge")) {
    mapObj.addSource("charge", { type: "geojson", data: chargeGeoJson() });
    mapObj.addLayer({
      id: "charge-dot",
      type: "circle",
      source: "charge",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.4, 14, 4.5, 17, 7],
        "circle-color": ["case", ["==", ["get", "vin"], 1], "#1f7a4d", "#2b6cb0"],
        "circle-stroke-width": 1.4,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.92,
      },
    });
  }
  return true;
}

function syncMapLayers() {
  if (!ensureMapLayers()) return;
  const show = (id, on) => {
    if (mapObj.getLayer(id)) mapObj.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  show("lez-fill", mapLayerState.lez);
  show("lez-line", mapLayerState.lez);
  show("charge-dot", mapLayerState.charge);
  syncWardLayer();
  syncQhLayer();
}

async function toggleMapLayer(key) {
  // Lớp chỉ có nghĩa trên nền bản đồ thật, nên bật nó lên trước.
  if (!mapMode) await setMapMode(true, { silent: true });
  if (!mapObj) return;
  mapLayerState[key] = !mapLayerState[key];
  syncMapLayers();
  renderMapLayerChips(key);
  renderMapNote();
  if (mapLayerState[key]) {
    if (key === "lez") openLezNote();
    else toast(t("chargeWarn"), 6000);
  }
}

/* ---------- Chip bật lớp + ghi chú giải thích ---------- */

function renderMapLayerChips(focusKey) {
  const host = document.querySelector("#pinLegend");
  if (!host) return;
  let strip = document.querySelector("#mapLayers");
  if (!strip) {
    strip = document.createElement("div");
    strip.id = "mapLayers";
    strip.className = "map-layers";
    host.insertAdjacentElement("afterend", strip);
  }
  const items = [
    { key: "lez", name: t("lezName"), title: t("lezOn"), tone: "lez" },
    { key: "charge", name: t("chargeName"), title: t("chargeOn", { n: chargePoints().length }), tone: "charge" },
    { key: "ward", name: t("wardName"), title: t("wardOn"), tone: "ward" },
    { key: "qh", name: t("qhName"), title: t("qhOn"), tone: "qh" },
  ];
  strip.innerHTML = items
    .map(
      (item) =>
        `<button class="map-layers__item map-layers__item--${item.tone}" type="button" data-layer="${item.key}" ` +
        `aria-pressed="${mapLayerState[item.key]}" title="${escapeHtml(item.title)}"><i></i>${escapeHtml(item.name)}</button>`,
    )
    .join("");
  const special = { ward: toggleWardLayer, qh: toggleQhLayer };
  strip.querySelectorAll("[data-layer]").forEach((button) => {
    const key = button.dataset.layer;
    button.addEventListener("click", () => (special[key] ? special[key]() : toggleMapLayer(key)));
  });
  // Trên điện thoại dải chip trượt ngang, chip cuối dễ nằm ngoài màn hình.
  // Vừa bật lớp nào thì kéo chip của lớp đó vào tầm mắt.
  if (focusKey) {
    strip
      .querySelector(`[data-layer="${focusKey}"]`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }
}

function sourceLinkHtml(id) {
  const item = SOURCE_BY_ID[id];
  if (!item) return "";
  return `<a class="map-note__src" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(item.ref)} <span aria-hidden="true">↗</span></a>`;
}

function renderMapNote() {
  let note = document.querySelector("#mapNote");
  const on = mapMode && (mapLayerState.lez || mapLayerState.charge || mapLayerState.ward || mapLayerState.qh);
  if (!on) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement("section");
    note.id = "mapNote";
    note.className = "map-note";
    document.querySelector(".hud-left")?.appendChild(note);
  }
  const blocks = [];
  if (mapLayerState.lez) {
    blocks.push(`
      <article class="map-note__block">
        <h3>${escapeHtml(t("lezTitle"))}</h3>
        <p class="map-note__when">${escapeHtml(t("lezWhen"))}</p>
        <p>${escapeHtml(t("lezWhere"))}</p>
        <p class="map-note__warn">${escapeHtml(t("lezWarn"))}</p>
        <p>${escapeHtml(t("lezWhat"))}</p>
        <p class="map-note__gap"><b>${escapeHtml(t("lezHours"))}.</b> ${escapeHtml(t("lezHoursWhy"))}</p>
        <p class="map-note__next">${escapeHtml(t("lezNext"))}</p>
        <p class="map-note__srcs">${escapeHtml(t("srcSee"))}: ${sourceLinkHtml("nq-57-2025")} ${sourceLinkHtml("ct-20-2025")}</p>
      </article>`);
  }
  if (mapLayerState.ward) {
    const picked = wardPick
      ? `<p class="map-note__pick"><b>${escapeHtml(t("wardAt"))}:</b> ${escapeHtml(wardLabel(wardPick))}</p>`
      : `<p class="map-note__next">${escapeHtml(t("wardTap"))}</p>`;
    blocks.push(`
      <article class="map-note__block">
        <h3>${escapeHtml(t("wardTitle"))}</h3>
        <p class="map-note__when">${escapeHtml(t("wardWhen"))}</p>
        ${picked}
        <p>${escapeHtml(t("wardCount"))}</p>
        <p>${escapeHtml(t("wardHow"))}</p>
        <p class="map-note__warn">${escapeHtml(t("wardWarn"))}</p>
        <p class="map-note__srcs">${escapeHtml(t("srcSee"))}: ${sourceLinkHtml("nq-1656-2025")} ${sourceLinkHtml("osm")}</p>
      </article>`);
  }
  if (mapLayerState.qh) blocks.push(qhNoteHtml());
  if (mapLayerState.charge) {
    const points = chargePoints();
    blocks.push(`
      <article class="map-note__block">
        <h3>${escapeHtml(t("chargeTitle"))}</h3>
        <p>${escapeHtml(t("chargeCount", { n: points.length, v: points.filter((p) => p.vin).length }))}</p>
        <p class="map-note__warn">${escapeHtml(t("chargeWarn"))}</p>
        <p class="map-note__srcs">${escapeHtml(t("srcSee"))}: ${sourceLinkHtml("osm")}</p>
      </article>`);
  }
  note.innerHTML = blocks.join("");
}

function openLezNote() {
  if (!mapLayerState.lez) return;
  renderMapNote();
  document.querySelector("#mapNote")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function bootMapLayers() {
  registerLayer("lez", ["nq-57-2025", "ct-20-2025", "luat-thu-do-2024", "osm"]);
  registerLayer("charge", ["osm"]);
  registerLayer("ward", ["nq-1656-2025", "osm"]);
  registerLayer("qh", ["qd-1668-2024", "nq-1656-2025", "geoboundaries", "osm"]);
  renderMapLayerChips();
  const asked = (QUERY.get("lop") || "").toLowerCase().split(",").filter(Boolean);
  if (asked.includes("lez") || asked.includes("phatthai")) toggleMapLayer("lez");
  if (asked.includes("sac") || asked.includes("charge")) toggleMapLayer("charge");
  if (asked.includes("phuong") || asked.includes("ward")) toggleWardLayer();
  if (asked.includes("quy-hoach") || asked.includes("quyhoach") || asked.includes("plan")) toggleQhLayer();
}

/* ==========================================================================
   TRA PHƯỜNG XÃ SAU SÁP NHẬP · WARD LOOKUP
   Từ 01/7/2025 Hà Nội còn 126 đơn vị cấp xã (Nghị quyết 1656/NQ-UBTVQH15).
   Rất nhiều người vẫn chưa rõ nhà mình nay thuộc phường nào — cần cho giấy
   tờ, khai báo, ghi địa chỉ. Chạm vào bản đồ là ra.
   Ranh giới nằm ở public/data/phuong-xa.txt, chỉ tải khi bật lớp này, nên ai
   không dùng thì không phải tải 60 KB vô ích.
   ========================================================================== */

const WARD_URL = "/data/phuong-xa.txt";
let wardData = null;
let wardLoading = null;

async function loadWards() {
  if (wardData) return wardData;
  if (wardLoading) return wardLoading;
  wardLoading = (async () => {
    const response = await fetch(WARD_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    wardData = text.trim().split("\n").map((line) => {
      const [name, kind, pop, ring] = line.split("|");
      let lat = 0;
      let lng = 0;
      return {
        name,
        kind,
        pop: Number(pop) || 0,
        ring: ring.split(" ").map((token) => {
          const [dLat, dLng] = token.split(",").map(Number);
          lat += dLat;
          lng += dLng;
          return [lat / 1e4, lng / 1e4];
        }),
      };
    });
    return wardData;
  })();
  try {
    return await wardLoading;
  } catch (error) {
    wardLoading = null;
    throw error;
  }
}

function wardLabel(ward) {
  if (!ward) return "";
  const prefix = ward.kind === "p" ? "Phường" : ward.kind === "x" ? "Xã" : "";
  return prefix ? `${prefix} ${ward.name}` : ward.name;
}

// Khoảng cách ngắn nhất từ điểm tới cạnh gần nhất của vòng, tính bằng mét.
function metresToRing(pos, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [aLat, aLng] = ring[i];
    const [bLat, bLng] = ring[i + 1];
    const scale = Math.cos(pos.lat * (Math.PI / 180));
    const ax = (aLng - pos.lng) * scale;
    const ay = aLat - pos.lat;
    const bx = (bLng - pos.lng) * scale;
    const by = bLat - pos.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best * (Math.PI / 180) * 6371000;
}

function wardAt(pos) {
  if (!wardData || !pos) return null;
  const hit = wardData.find((w) => insideRing(pos, w.ring));
  if (!hit) return null;
  return { ward: hit, edge: metresToRing(pos, hit.ring) };
}

/* ---------- Lớp ranh giới trên nền bản đồ ---------- */

function wardGeoJson() {
  return {
    type: "FeatureCollection",
    features: (wardData || []).map((w, i) => ({
      type: "Feature",
      // `vung` là số hiệu vùng quy hoạch 1–5, để lớp Quy hoạch 2045 tô màu mà
      // không phải tải lại một bộ ranh giới thứ hai.
      properties: { ten: wardLabel(w), vung: QH_OF[i] || 0 },
      geometry: { type: "Polygon", coordinates: [w.ring.map(([lat, lng]) => [lng, lat])] },
    })),
  };
}

function ensureWardLayer() {
  if (!wardData || !styleReady()) return false;
  if (mapObj.getSource("ward")) return true;
  mapObj.addSource("ward", { type: "geojson", data: wardGeoJson() });
  // Nền tô 5 vùng quy hoạch nằm dưới cùng, để nét ranh giới phường vẽ sau
  // vẫn nổi lên trên khi bật cả hai lớp.
  mapObj.addLayer({
    id: "qh-fill",
    type: "fill",
    source: "ward",
    layout: { visibility: "none" },
    paint: {
      "fill-color": ["match", ["get", "vung"], ...QH_ZONES.flatMap((z) => [z.id, z.color]), "#94a3b8"],
      "fill-opacity": 0.3,
    },
  });
  mapObj.addLayer({
    id: "ward-line",
    type: "line",
    source: "ward",
    layout: { visibility: "none", "line-join": "round" },
    paint: { "line-color": "#5b6b8c", "line-width": 1.2, "line-opacity": 0.75 },
  });
  mapObj.addLayer({
    id: "ward-label",
    type: "symbol",
    source: "ward",
    layout: {
      visibility: "none",
      "text-field": ["get", "ten"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13],
      "text-font": ["Noto Sans Regular"],
      "text-padding": 6,
    },
    paint: { "text-color": "#3c4a63", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
  });
  // Vùng đang chạm vào, tô nhạt cho thấy rõ mình đang đứng trong ranh nào.
  mapObj.addSource("ward-pick", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  mapObj.addLayer({
    id: "ward-pick-fill",
    type: "fill",
    source: "ward-pick",
    paint: { "fill-color": "#2664ff", "fill-opacity": 0.16 },
  });
  return true;
}

let wardPick = null;

function showWardPick(ward) {
  wardPick = ward;
  const source = mapObj?.getSource("ward-pick");
  if (!source) return;
  source.setData(
    ward
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ward.ring.map(([lat, lng]) => [lng, lat])] } }] }
      : { type: "FeatureCollection", features: [] },
  );
}

function syncWardLayer() {
  if (!ensureWardLayer()) return;
  const on = mapLayerState.ward;
  ["ward-line", "ward-label"].forEach((id) => {
    if (mapObj.getLayer(id)) mapObj.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  });
  if (!on) showWardPick(null);
}

// Tra một điểm bất kỳ rồi kể lại bằng tiếng người.
function tellWardAt(pos) {
  if (!mapLayerState.ward) return;
  const found = wardAt(pos);
  showWardPick(found?.ward || null);
  renderMapNote();
  if (!found) {
    toast(t("wardNone"), 4200);
    return;
  }
  const edge = found.edge < 120 ? ` · ${t("wardEdge", { d: fmtDistance(found.edge) })}` : "";
  toast(`${t("wardAt")}: ${wardLabel(found.ward)}${edge}`, 6000);
}

async function toggleWardLayer() {
  if (!mapMode) await setMapMode(true, { silent: true });
  if (!mapObj) return;
  if (!wardData) {
    toast(t("wardLoading"), 8000);
    try {
      await loadWards();
    } catch {
      toast(t("wardFail"), 5200);
      return;
    }
  }
  mapLayerState.ward = !mapLayerState.ward;
  syncMapLayers();
  renderMapLayerChips("ward");
  renderMapNote();
  if (mapLayerState.ward) {
    toast(t("wardTap"), 5000);
    if (userPos) tellWardAt(userPos);
  }
}

/* ==========================================================================
   SƠ ĐỒ QUY HOẠCH KHUNG THỦ ĐÔ 2045 · FRAMEWORK MASTER PLAN
   Nguồn duy nhất: Quyết định 1668/QĐ-TTg ngày 27/12/2024.

   Có một chỗ vênh phải nói thẳng. Quyết định mô tả từng vùng đô thị bằng
   danh sách quận, huyện — mà cấp huyện đã bỏ từ 01/7/2025. Muốn vẽ được lên
   bản đồ hôm nay thì phải quy chiếu sang 126 phường xã mới.

   Cách quy chiếu: lấy ranh giới quận huyện Việt Nam trước sáp nhập
   (geoBoundaries VNM ADM2), rải lưới điểm bên trong từng phường xã mới, xem
   phần lớn diện tích rơi vào huyện cũ nào thì xếp phường xã đó vào vùng của
   huyện ấy. Làm xong đếm lại: số phường xã của cả 30 quận huyện cũ khớp đúng
   Nghị quyết 1656. Dù vậy ranh giới vùng vẫn chỉ là tương đối — phường Hồng
   Hà, Phú Xuyên, Yên Xuân… nằm vắt qua hai huyện cũ.

   Năm trục thì quyết định chỉ nêu tên mốc, không kèm toạ độ. Nên trục vẽ nét
   đứt nối các mốc ấy: chỉ hướng, không phải hướng tuyến kỹ thuật.

   Vì vậy lớp này luôn kèm một dòng cảnh báo không tắt được: đây là sơ đồ
   minh hoạ, không thay bản đồ quy hoạch pháp lý. Ai cần tra quy hoạch thửa
   đất phải hỏi cơ quan quản lý, không tra ở đây.
   ========================================================================== */

// Vùng của từng phường xã, theo đúng thứ tự dòng trong public/data/phuong-xa.txt.
const QH_PACKED =
  "114124521554415113115114311214114445111115545114311112345111131141214154253451434431445114141511323155343411551542131141413114";
const QH_OF = [...QH_PACKED].map(Number);

const QH_ZONES = [
  {
    id: 1,
    color: "#d9534f",
    name: "Vùng đô thị phía Nam sông Hồng",
    nameEn: "Zone south of the Red River",
    old: "Nội đô lịch sử và mở rộng, Hà Đông, Đan Phượng, Hoài Đức, Thanh Trì",
    oldEn: "The historic and extended inner city, Hà Đông, Đan Phượng, Hoài Đức, Thanh Trì",
  },
  {
    id: 2,
    color: "#2f80c9",
    name: "Vùng đô thị phía Đông",
    nameEn: "Eastern zone",
    old: "Long Biên, Gia Lâm",
    oldEn: "Long Biên, Gia Lâm",
  },
  {
    id: 3,
    color: "#7c5cd6",
    name: "Vùng đô thị phía Bắc",
    nameEn: "Northern zone",
    old: "Đông Anh, Mê Linh, Sóc Sơn — dự kiến lập thành phố phía Bắc",
    oldEn: "Đông Anh, Mê Linh, Sóc Sơn — a northern city is planned here",
  },
  {
    id: 4,
    color: "#3f9e5a",
    name: "Vùng đô thị phía Tây",
    nameEn: "Western zone",
    old: "Sơn Tây, Ba Vì, Phúc Thọ, Quốc Oai, Thạch Thất, Chương Mỹ",
    oldEn: "Sơn Tây, Ba Vì, Phúc Thọ, Quốc Oai, Thạch Thất, Chương Mỹ",
  },
  {
    id: 5,
    color: "#d9932b",
    name: "Vùng đô thị phía Nam",
    nameEn: "Southern zone",
    old: "Thanh Oai, Mỹ Đức, Ứng Hòa, Thường Tín, Phú Xuyên",
    oldEn: "Thanh Oai, Mỹ Đức, Ứng Hòa, Thường Tín, Phú Xuyên",
  },
];

const QH_ZONE_BY_ID = Object.fromEntries(QH_ZONES.map((z) => [z.id, z]));

// Năm trục. Đường sông Hồng lấy theo lòng sông thật trong OpenStreetMap rồi
// cắt vào địa giới Hà Nội; bốn trục còn lại nối các mốc mà quyết định nêu tên.
const QH_AXES = [
  {
    id: "song-hong",
    name: "Trục sông Hồng",
    nameEn: "Red River axis",
    what: "Không gian xanh trung tâm của đô thị trung tâm, kết hợp với sông Đuống.",
    whatEn: "The central green spine of the core city, together with the Đuống River.",
    ends: ["Ba Vì – Sơn Tây", "Phú Xuyên"],
    real: true,
    line: [
      [21.2196, 105.4392], [21.1827, 105.4637], [21.1598, 105.4921], [21.1557, 105.5092],
      [21.1525, 105.5383], [21.1522, 105.5589], [21.1568, 105.5746], [21.1603, 105.5992],
      [21.1722, 105.6189], [21.1613, 105.6402], [21.1473, 105.6471], [21.1332, 105.6639],
      [21.1404, 105.6877], [21.1428, 105.7053], [21.1344, 105.7182], [21.1145, 105.7253],
      [21.1031, 105.7372], [21.0985, 105.7523], [21.0931, 105.7677], [21.0972, 105.7856],
      [21.1028, 105.8038], [21.0965, 105.8225], [21.086, 105.8377], [21.0669, 105.853],
      [21.0529, 105.8567], [21.0288, 105.8661], [21.0124, 105.871], [21.0018, 105.8875],
      [20.9937, 105.9022], [20.9807, 105.9101], [20.9646, 105.9003], [20.9524, 105.8907],
      [20.939, 105.8822], [20.9293, 105.8957], [20.897, 105.8945], [20.8865, 105.9091],
      [20.8732, 105.93], [20.8333, 105.9121], [20.8095, 105.9143], [20.7923, 105.9217],
      [20.7838, 105.9343], [20.7789, 105.9598],
    ],
  },
  {
    id: "ho-tay-ba-vi",
    name: "Trục Hồ Tây – Ba Vì",
    nameEn: "Hồ Tây – Ba Vì axis",
    what: "Nối trung tâm với thành phố phía Tây, gắn văn hoá Thăng Long – Xứ Đoài.",
    whatEn: "Links the centre to the western city, tying Thăng Long and Xứ Đoài culture together.",
    ends: ["Hồ Tây", "Ba Vì"],
    line: [
      [21.058, 105.814], [21.048, 105.77], [21.04, 105.71], [21.035, 105.64],
      [21.03, 105.57], [21.025, 105.5], [21.021, 105.44], [21.0184, 105.393],
    ],
  },
  {
    id: "ho-tay-co-loa",
    name: "Trục Hồ Tây – Cổ Loa",
    nameEn: "Hồ Tây – Cổ Loa axis",
    what: "Trục kết nối di sản, qua cầu Tứ Liên sang thành Cổ Loa.",
    whatEn: "A heritage axis running over the Tứ Liên bridge to the Cổ Loa citadel.",
    ends: ["Hồ Tây", "Cổ Loa"],
    line: [[21.062, 105.821], [21.074, 105.842], [21.09, 105.857], [21.103, 105.87], [21.1136, 105.8766]],
  },
  {
    id: "nhat-tan-noi-bai",
    name: "Trục Nhật Tân – Nội Bài",
    nameEn: "Nhật Tân – Nội Bài axis",
    what: "Trục kinh tế, đô thị thông minh, nối sân bay cửa ngõ quốc tế Nội Bài.",
    whatEn: "An economic and smart-city axis to Nội Bài international gateway airport.",
    ends: ["Cầu Nhật Tân", "Sân bay Nội Bài"],
    line: [[21.0983, 105.8232], [21.125, 105.808], [21.16, 105.798], [21.195, 105.799], [21.2189, 105.8045]],
  },
  {
    id: "nam-ha-noi",
    name: "Trục Nam Hà Nội",
    nameEn: "South Hanoi axis",
    what: "Gắn với trục văn hoá Mỹ Đình – Ba Sao – Bái Đính và sân bay thứ hai vùng Thủ đô.",
    whatEn: "Follows the Mỹ Đình – Ba Sao – Bái Đính cultural corridor and the capital region's second airport.",
    ends: ["Mỹ Đình", "Bái Đính"],
    line: [
      [21.0205, 105.7639], [20.97, 105.775], [20.91, 105.79], [20.84, 105.8],
      [20.77, 105.81], [20.7, 105.815], [20.63, 105.817], [20.5623, 105.818],
      [20.45, 105.84], [20.35, 105.855], [20.2728, 105.864],
    ],
  },
];

function qhAxisGeoJson() {
  const features = [];
  for (const axis of QH_AXES) {
    features.push({
      type: "Feature",
      properties: { ten: LANG === "en" ? axis.nameEn : axis.name, kind: "line" },
      geometry: { type: "LineString", coordinates: axis.line.map(([lat, lng]) => [lng, lat]) },
    });
    [axis.line[0], axis.line[axis.line.length - 1]].forEach((point, i) => {
      features.push({
        type: "Feature",
        properties: { ten: axis.ends[i], kind: "end" },
        geometry: { type: "Point", coordinates: [point[1], point[0]] },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function ensureQhAxes() {
  if (!styleReady()) return false;
  if (mapObj.getSource("qh-truc")) return true;
  mapObj.addSource("qh-truc", { type: "geojson", data: qhAxisGeoJson() });
  // Nét đứt là cố ý, giống lớp vùng phát thải thấp: nhắc rằng đây là hướng
  // minh hoạ chứ không phải một tuyến đã cắm mốc ngoài thực địa.
  mapObj.addLayer({
    id: "qh-truc-line",
    type: "line",
    source: "qh-truc",
    filter: ["==", ["get", "kind"], "line"],
    layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#0f172a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.6, 12, 3, 15, 4.5],
      "line-opacity": 0.72,
      "line-dasharray": [2.4, 1.8],
    },
  });
  mapObj.addLayer({
    id: "qh-truc-dot",
    type: "circle",
    source: "qh-truc",
    filter: ["==", ["get", "kind"], "end"],
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 13, 5.5],
      "circle-color": "#0f172a",
      "circle-stroke-width": 1.6,
      "circle-stroke-color": "#ffffff",
    },
  });
  mapObj.addLayer({
    id: "qh-truc-label",
    type: "symbol",
    source: "qh-truc",
    filter: ["==", ["get", "kind"], "line"],
    layout: {
      visibility: "none",
      "symbol-placement": "line-center",
      "text-field": ["get", "ten"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 13, 13],
      "text-font": ["Noto Sans Regular"],
      "text-padding": 8,
    },
    paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.8 },
  });
  return true;
}

// Vùng quy hoạch của một điểm bất kỳ. Trả về cả phường xã để người dùng đối
// chiếu được: "chỗ này là xã Bát Tràng, nằm trong vùng đô thị phía Đông".
function qhAt(pos) {
  const found = wardAt(pos);
  if (!found) return null;
  const index = wardData.indexOf(found.ward);
  const zone = QH_ZONE_BY_ID[QH_OF[index]];
  return zone ? { zone, ward: found.ward } : null;
}

let qhPick = null;

function syncQhLayer() {
  const on = mapLayerState.qh;
  if (on) ensureQhAxes();
  const show = (id) => {
    if (mapObj?.getLayer(id)) mapObj.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  ["qh-fill", "qh-truc-line", "qh-truc-dot", "qh-truc-label"].forEach(show);
  if (!on) qhPick = null;
}

function tellQhAt(pos) {
  if (!mapLayerState.qh) return;
  const found = qhAt(pos);
  qhPick = found;
  renderMapNote();
  if (!found) {
    toast(t("qhNone"), 4200);
    return;
  }
  const zone = LANG === "en" ? found.zone.nameEn : found.zone.name;
  toast(`${wardLabel(found.ward)} · ${zone}`, 6000);
}

async function toggleQhLayer() {
  if (!mapMode) await setMapMode(true, { silent: true });
  if (!mapObj) return;
  if (!wardData) {
    toast(t("qhLoading"), 8000);
    try {
      await loadWards();
    } catch {
      toast(t("qhFail"), 5200);
      return;
    }
  }
  mapLayerState.qh = !mapLayerState.qh;
  // Đi qua syncMapLayers để dùng chung cơ chế hẹn thử lại khi style chưa xong,
  // thay vì tự gọi rồi im lặng bỏ cuộc.
  syncMapLayers();
  renderMapLayerChips("qh");
  renderMapNote();
  if (mapLayerState.qh) toast(t("qhTap"), 5000);
}

function qhNoteHtml() {
  const zones = QH_ZONES.map((z) => {
    const count = QH_OF.filter((v) => v === z.id).length;
    return (
      `<li><i style="background:${z.color}"></i><b>${escapeHtml(LANG === "en" ? z.nameEn : z.name)}</b>` +
      `<span>${escapeHtml(LANG === "en" ? z.oldEn : z.old)} · ${escapeHtml(t("qhWards", { n: count }))}</span></li>`
    );
  }).join("");
  const axes = QH_AXES.map(
    (a) =>
      `<li><b>${escapeHtml(LANG === "en" ? a.nameEn : a.name)}</b>` +
      `<span>${escapeHtml(LANG === "en" ? a.whatEn : a.what)}</span></li>`,
  ).join("");
  const picked = qhPick
    ? `<p class="map-note__pick"><b>${escapeHtml(wardLabel(qhPick.ward))}</b> — ` +
      `${escapeHtml(LANG === "en" ? qhPick.zone.nameEn : qhPick.zone.name)}</p>`
    : `<p class="map-note__next">${escapeHtml(t("qhTap"))}</p>`;
  return `
    <article class="map-note__block">
      <h3>${escapeHtml(t("qhTitle"))}</h3>
      <p class="map-note__when">${escapeHtml(t("qhWhen"))}</p>
      <p class="map-note__warn map-note__warn--hard">${escapeHtml(t("qhWarn"))}</p>
      ${picked}
      <p>${escapeHtml(t("qhModel"))}</p>
      <h4>${escapeHtml(t("qhZones"))}</h4>
      <ul class="map-note__legend">${zones}</ul>
      <h4>${escapeHtml(t("qhAxes"))}</h4>
      <ul class="map-note__axes">${axes}</ul>
      <p>${escapeHtml(t("qhCity"))}</p>
      <p class="map-note__gap">${escapeHtml(t("qhHowZone"))}</p>
      <p class="map-note__gap">${escapeHtml(t("qhOverlap"))}</p>
      <p class="map-note__gap">${escapeHtml(t("qhHowAxis"))}</p>
      <p class="map-note__srcs">${escapeHtml(t("srcSee"))}: ${sourceLinkHtml("qd-1668-2024")} ${sourceLinkHtml("nq-1656-2025")} ${sourceLinkHtml("geoboundaries")}</p>
    </article>`;
}

/* ---------- Cài về màn hình chính + chạy offline ---------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline là phần thêm, hỏng cũng không sao */
    });
  });
}

/* ---------- Khởi động: nạp Sheet xong mới dựng scene ---------- */

bootLivePlaces().finally(() => {
  init();
  bootWeather();
  bootMapMode();
  bootSources();
  bootMapLayers();
  registerServiceWorker();
});

window.HanoiAtlas = {
  get places() {
    return STARTUPS.length;
  },
  sources: DATA_SOURCES,
  flyToArea: setActiveArea,
};

window.__atlas = {
  scene,
  camera,
  controls,
  project,
  THREE,
  selectStartup,
  setMapMode,
  wardAt,
  qhAt,
  get map() {
    return mapObj;
  },
  debug: () => ({
    lang: LANG,
    filters: [...activeStages],
    userPos,
    viewFit: { ...viewFit },
    mapMode,
    mapPins: mapMarkers.size,
    mapError: mapLastError,
    mapLayers: { ...mapLayerState },
    lezInside: STARTUPS.filter((item) => lezWardOf(item)).length,
    realCoords: Object.keys(REAL_COORDS).length,
  }),
};
