// Hà Nội Atlas data. The engine keeps the original export names (STARTUPS,
// COMPANY_INFO...) — here a "startup" is simply a place on the map.
//
// Mỗi địa điểm thuộc một trong ba nhóm (field `stage`):
//   "Ẩm thực"  — quán ăn, cà phê / food & drink
//   "Du lịch"  — di tích, bảo tàng, danh thắng / sights
//   "BĐS"      — dự án nhà ở, khu đô thị / real-estate projects
//
// Toạ độ là vị trí xấp xỉ để hiển thị trên bản đồ cách điệu, không phải dữ
// liệu trắc địa. Pins are approximate, for a stylized map — not GIS data.

export const DATA_SOURCES = {
  osm: "https://www.openstreetmap.org/relation/1903516",
  note: "Dữ liệu chọn lọc thủ công · Hand-curated, August 2026",
};

export const AREAS = [
  {
    id: "all",
    number: "01",
    label: "Toàn cảnh Hà Nội",
    shortLabel: "Toàn cảnh",
    focus: { lat: 21.0345, lng: 105.8185, distance: 92, height: 64, rotation: 0.62 },
    description:
      "52 địa điểm ẩm thực, du lịch và bất động sản, trải từ Phố cổ qua Hồ Tây đến Mỹ Đình. · 52 places to eat, explore, and live — from the Old Quarter to West Lake and the new west.",
  },
  {
    id: "pho-co",
    number: "02",
    label: "Phố cổ & Hồ Gươm",
    shortLabel: "Phố cổ",
    focus: { lat: 21.0322, lng: 105.8502, distance: 24, height: 20, rotation: 0.5 },
    description:
      "36 phố phường quanh Hồ Gươm: phở, cà phê trứng, bia hơi và những mái ngói trăm năm. · The ancient 36 streets: phở, egg coffee, bia hơi, and century-old rooftops around the lake.",
  },
  {
    id: "phap",
    number: "03",
    label: "Khu phố Pháp",
    shortLabel: "Phố Pháp",
    focus: { lat: 21.0228, lng: 105.852, distance: 26, height: 22, rotation: 0.62 },
    description:
      "Ô bàn cờ thời thuộc địa: Nhà hát Lớn, biệt thự, kem Tràng Tiền và bún chả tổng thống. · The colonial grid: the Opera House, villas, Tràng Tiền ice cream, and presidential bún chả.",
  },
  {
    id: "ba-dinh",
    number: "04",
    label: "Ba Đình & Văn Miếu",
    shortLabel: "Ba Đình",
    focus: { lat: 21.0338, lng: 105.8372, distance: 28, height: 23, rotation: 0.72 },
    description:
      "Quảng trường Ba Đình, Hoàng thành, Cột cờ và nghìn năm bia đá Quốc Tử Giám. · Ba Đình Square, the citadel, the Flag Tower, and a millennium of stone stelae.",
  },
  {
    id: "ho-tay",
    number: "05",
    label: "Hồ Tây",
    shortLabel: "Hồ Tây",
    focus: { lat: 21.056, lng: 105.8235, distance: 42, height: 30, rotation: 0.95 },
    description:
      "Mặt gương lớn nhất thành phố: Trấn Quốc, Phủ Tây Hồ, bánh tôm và những căn hộ view hồ. · The city's great mirror: Trấn Quốc pagoda, lakeside shrines, shrimp cakes, and lake-view towers.",
  },
  {
    id: "tay-moi",
    number: "06",
    label: "Cầu Giấy & Mỹ Đình",
    shortLabel: "Khu Tây",
    focus: { lat: 21.0195, lng: 105.7845, distance: 34, height: 23, rotation: 0.5 },
    description:
      "Đường chân trời mới của Hà Nội: Keangnam, Lotte, sân Mỹ Đình và các khu căn hộ triệu đô. · Hanoi's new skyline: Keangnam, Lotte, the national stadium, and the high-rise west.",
  },
  {
    id: "nam",
    number: "07",
    label: "Nam thành phố",
    shortLabel: "Phía Nam",
    focus: { lat: 21.006, lng: 105.84, distance: 56, height: 36, rotation: 0.35 },
    description:
      "Vành đai nam: công viên Thống Nhất và hai 'thành phố trong thành phố' Times City, Royal City. · The southern belt: Thống Nhất park and the twin mega-projects Times City and Royal City.",
  },
  {
    id: "song-hong",
    number: "08",
    label: "Sông Hồng & Long Biên",
    shortLabel: "Sông Hồng",
    focus: { lat: 21.0445, lng: 105.8615, distance: 34, height: 25, rotation: 1.05 },
    description:
      "Cây cầu thép 1902, bãi giữa xanh mướt và bờ đông đang vươn mình. · The 1902 steel bridge, the green mid-river islet, and the rising east bank.",
  },
];

// Field map (giữ tên field gốc của engine):
//   stage  -> nhóm địa điểm: "Ẩm thực" | "Du lịch" | "BĐS"
//   sector -> loại hình chi tiết (Phở bò, Bảo tàng, Khu đô thị...)
//   office -> một dòng thông tin ngắn (năm mở, CĐT, vé...)
//   price  -> mức giá tham khảo (hiện ở thẻ chi tiết)
export const STARTUPS = [
  // ---------------- Ẩm thực · Food & drink ----------------
  { id: "pho-bat-dan", name: "Phở Bát Đàn", lat: 21.0338, lng: 105.8465, area: "pho-co", stage: "Ẩm thực", sector: "Phở bò", office: "Từ thập niên 1960", website: null, source: "curated", price: "~60–70k/bát", address: "49 Bát Đàn, Hoàn Kiếm" },
  { id: "pho-10-ly-quoc-su", name: "Phở 10 Lý Quốc Sư", lat: 21.0296, lng: 105.8482, area: "pho-co", stage: "Ẩm thực", sector: "Phở bò", office: null, website: "https://pho10lyquocsu.com.vn/", source: "curated", price: "~65–90k/bát", address: "10 Lý Quốc Sư, Hoàn Kiếm" },
  { id: "pho-thin-lo-duc", name: "Phở Thìn Lò Đúc", lat: 21.018, lng: 105.8583, area: "phap", stage: "Ẩm thực", sector: "Phở tái lăn", office: "Từ 1979", website: null, source: "curated", price: "~70–90k/bát", address: "13 Lò Đúc, Hai Bà Trưng" },
  { id: "bun-cha-huong-lien", name: "Bún chả Hương Liên", lat: 21.0152, lng: 105.8555, area: "phap", stage: "Ẩm thực", sector: "Bún chả", office: "Combo Obama 2016", website: null, source: "curated", price: "~50–110k/suất", address: "24 Lê Văn Hưu, Hai Bà Trưng" },
  { id: "bun-cha-dac-kim", name: "Bún chả Đắc Kim", lat: 21.0325, lng: 105.8478, area: "pho-co", stage: "Ẩm thực", sector: "Bún chả", office: "Từ 1966", website: null, source: "curated", price: "~60–90k/suất", address: "1 Hàng Mành, Hoàn Kiếm" },
  { id: "cha-ca-la-vong", name: "Chả cá Lã Vọng", lat: 21.0348, lng: 105.8478, area: "pho-co", stage: "Ẩm thực", sector: "Chả cá", office: "Hơn 130 năm, phố Chả Cá", website: null, source: "curated", price: "~150–250k/người", address: "14 Chả Cá, Hoàn Kiếm" },
  { id: "ca-phe-giang", name: "Cà phê Giảng", lat: 21.0318, lng: 105.8532, area: "pho-co", stage: "Ẩm thực", sector: "Cà phê trứng", office: "Từ 1946 — nơi khai sinh cà phê trứng", website: "https://giangcafehanoi.com/", source: "curated", price: "~35–50k", address: "39 Nguyễn Hữu Huân, Hoàn Kiếm" },
  { id: "ca-phe-dinh", name: "Cà phê Đinh", lat: 21.0295, lng: 105.852, area: "pho-co", stage: "Ẩm thực", sector: "Cà phê gác hai", office: "Ban công nhìn ra Hồ Gươm", website: null, source: "curated", price: "~30–45k", address: "13 Đinh Tiên Hoàng, Hoàn Kiếm" },
  { id: "cong-ca-phe", name: "Cộng Cà Phê Nhà Thờ", lat: 21.0288, lng: 105.8481, area: "pho-co", stage: "Ẩm thực", sector: "Cà phê", office: "Cốt dừa cà phê nổi tiếng", website: "https://congcaphe.com/", source: "curated", price: "~45–65k", address: "27 Nhà Thờ, Hoàn Kiếm" },
  { id: "kem-trang-tien", name: "Kem Tràng Tiền", lat: 21.0248, lng: 105.8555, area: "phap", stage: "Ẩm thực", sector: "Kem", office: "Từ 1958", website: "https://kemtrangtien.vn/", source: "curated", price: "~10–20k/que", address: "35 Tràng Tiền, Hoàn Kiếm" },
  { id: "bia-ta-hien", name: "Bia hơi Tạ Hiện", lat: 21.035, lng: 105.8515, area: "pho-co", stage: "Ẩm thực", sector: "Bia hơi", office: "'Ngã tư quốc tế'", website: null, source: "curated", price: "~15–25k/cốc", address: "Tạ Hiện × Lương Ngọc Quyến" },
  { id: "banh-mi-25", name: "Bánh Mì 25", lat: 21.0355, lng: 105.8495, area: "pho-co", stage: "Ẩm thực", sector: "Bánh mì", office: null, website: "https://banhmi25.net/", source: "curated", price: "~25–45k", address: "25 Hàng Cá, Hoàn Kiếm" },
  { id: "xoi-yen", name: "Xôi Yến", lat: 21.033, lng: 105.854, area: "pho-co", stage: "Ẩm thực", sector: "Xôi", office: "Mở gần như cả ngày", website: null, source: "curated", price: "~30–60k", address: "35B Nguyễn Hữu Huân, Hoàn Kiếm" },
  { id: "bun-thang-ba-duc", name: "Bún thang Bà Đức", lat: 21.0342, lng: 105.851, area: "pho-co", stage: "Ẩm thực", sector: "Bún thang", office: "Ba thế hệ", website: null, source: "curated", price: "~50–70k/bát", address: "48 Cầu Gỗ, Hoàn Kiếm" },
  { id: "pho-cuon-ngu-xa", name: "Phở cuốn Ngũ Xã", lat: 21.045, lng: 105.8408, area: "ba-dinh", stage: "Ẩm thực", sector: "Phở cuốn", office: "Làng nghề Ngũ Xã, Trúc Bạch", website: null, source: "curated", price: "~60–100k/người", address: "Ngũ Xã, Ba Đình" },
  { id: "banh-tom-ho-tay", name: "Bánh tôm Hồ Tây", lat: 21.0468, lng: 105.8372, area: "ho-tay", stage: "Ẩm thực", sector: "Bánh tôm", office: "Từ 1958, đường Thanh Niên", website: null, source: "curated", price: "~80–130k/suất", address: "1 Thanh Niên, Tây Hồ" },
  { id: "quan-an-ngon", name: "Quán Ăn Ngon", lat: 21.027, lng: 105.8443, area: "phap", stage: "Ẩm thực", sector: "Ẩm thực ba miền", office: "Trong biệt thự Pháp cổ", website: "https://ngonhanoi.com.vn/", source: "curated", price: "~100–250k/người", address: "18 Phan Bội Châu, Hoàn Kiếm" },

  // ---------------- Du lịch · Sights ----------------
  { id: "ho-guom", name: "Hồ Gươm & Tháp Rùa", lat: 21.0281, lng: 105.8517, area: "pho-co", stage: "Du lịch", sector: "Danh thắng", office: "Trái tim Hà Nội", website: null, source: "curated", price: "Miễn phí" },
  { id: "den-ngoc-son", name: "Đền Ngọc Sơn & cầu Thê Húc", lat: 21.031, lng: 105.8524, area: "pho-co", stage: "Du lịch", sector: "Đền", office: "Đảo Ngọc, Hồ Gươm", website: null, source: "curated", price: "Vé ~50k" },
  { id: "cho-dong-xuan", name: "Chợ Đồng Xuân", lat: 21.0382, lng: 105.8494, area: "pho-co", stage: "Du lịch", sector: "Chợ truyền thống", office: "Từ 1889", website: null, source: "curated", price: null, address: "Đồng Xuân, Hoàn Kiếm" },
  { id: "o-quan-chuong", name: "Ô Quan Chưởng", lat: 21.0368, lng: 105.8527, area: "pho-co", stage: "Du lịch", sector: "Cửa ô cổ", office: "Cửa ô cuối cùng còn lại, 1749", website: null, source: "curated", price: "Miễn phí" },
  { id: "nha-tho-lon", name: "Nhà thờ Lớn Hà Nội", lat: 21.0287, lng: 105.8489, area: "pho-co", stage: "Du lịch", sector: "Nhà thờ", office: "Khánh thành 1886", website: null, source: "curated", price: "Miễn phí" },
  { id: "pho-duong-tau", name: "Phố cà phê đường tàu", lat: 21.0338, lng: 105.8445, area: "pho-co", stage: "Du lịch", sector: "Trải nghiệm", office: "Đoạn Phùng Hưng – Trần Phú", website: null, source: "curated", price: null },
  { id: "nha-hat-lon", name: "Nhà hát Lớn Hà Nội", lat: 21.0243, lng: 105.8578, area: "phap", stage: "Du lịch", sector: "Nhà hát", office: "Hoàn thành 1911", website: "https://hanoioperahouse.org.vn/", source: "curated", price: "Theo suất diễn" },
  { id: "hoa-lo", name: "Di tích Nhà tù Hỏa Lò", lat: 21.0253, lng: 105.8465, area: "phap", stage: "Du lịch", sector: "Bảo tàng – di tích", office: "Tour đêm rất được yêu thích", website: "https://hoalo.vn/", source: "curated", price: "Vé ~50k" },
  { id: "bao-tang-phu-nu", name: "Bảo tàng Phụ nữ Việt Nam", lat: 21.023, lng: 105.85, area: "phap", stage: "Du lịch", sector: "Bảo tàng", office: null, website: "https://baotangphunu.org.vn/", source: "curated", price: "Vé ~40k", address: "36 Lý Thường Kiệt, Hoàn Kiếm" },
  { id: "lang-bac", name: "Lăng Chủ tịch Hồ Chí Minh", lat: 21.0368, lng: 105.8347, area: "ba-dinh", stage: "Du lịch", sector: "Di tích quốc gia", office: "Mở cửa buổi sáng", website: "https://bqllang.gov.vn/", source: "curated", price: "Miễn phí" },
  { id: "chua-mot-cot", name: "Chùa Một Cột", lat: 21.0359, lng: 105.8334, area: "ba-dinh", stage: "Du lịch", sector: "Chùa", office: "Nguyên bản từ 1049", website: null, source: "curated", price: "Miễn phí" },
  { id: "hoang-thanh", name: "Hoàng thành Thăng Long", lat: 21.0348, lng: 105.8402, area: "ba-dinh", stage: "Du lịch", sector: "Di sản UNESCO", office: "Di sản thế giới 2010", website: "https://hoangthanhthanglong.vn/", source: "curated", price: "Vé ~70k" },
  { id: "cot-co", name: "Cột cờ Hà Nội", lat: 21.0325, lng: 105.8398, area: "ba-dinh", stage: "Du lịch", sector: "Di tích", office: "Xây 1805–1812, cao 33 m", website: null, source: "curated", price: null },
  { id: "van-mieu", name: "Văn Miếu – Quốc Tử Giám", lat: 21.0287, lng: 105.8356, area: "ba-dinh", stage: "Du lịch", sector: "Di tích", office: "Trường đại học đầu tiên, 1070", website: "https://vanmieu.gov.vn/", source: "curated", price: "Vé ~70k" },
  { id: "chua-tran-quoc", name: "Chùa Trấn Quốc", lat: 21.048, lng: 105.8355, area: "ho-tay", stage: "Du lịch", sector: "Chùa", office: "Hơn 1.500 năm, đảo Hồ Tây", website: null, source: "curated", price: "Miễn phí" },
  { id: "phu-tay-ho", name: "Phủ Tây Hồ", lat: 21.0632, lng: 105.8288, area: "ho-tay", stage: "Du lịch", sector: "Đền phủ", office: "Bán đảo Quảng An", website: null, source: "curated", price: "Miễn phí" },
  { id: "duong-thanh-nien", name: "Đường Thanh Niên", lat: 21.0458, lng: 105.8368, area: "ho-tay", stage: "Du lịch", sector: "Con đường ven hồ", office: "Giữa Hồ Tây và Trúc Bạch", website: null, source: "curated", price: null },
  { id: "cau-long-bien", name: "Cầu Long Biên", lat: 21.0435, lng: 105.8558, area: "song-hong", stage: "Du lịch", sector: "Cầu lịch sử", office: "Daydé & Pillé, 1899–1902", website: null, source: "curated", price: null },
  { id: "bai-da-song-hong", name: "Bãi đá sông Hồng", lat: 21.065, lng: 105.839, area: "song-hong", stage: "Du lịch", sector: "Vườn hoa chụp ảnh", office: "Ven đê Âu Cơ, Nhật Tân", website: null, source: "approx", price: "Vé ~50–100k" },
  { id: "cv-thong-nhat", name: "Công viên Thống Nhất", lat: 21.0165, lng: 105.8455, area: "nam", stage: "Du lịch", sector: "Công viên", office: "Quanh hồ Bảy Mẫu", website: null, source: "curated", price: "Miễn phí" },
  { id: "svd-my-dinh", name: "SVĐ Quốc gia Mỹ Đình", lat: 21.0205, lng: 105.7638, area: "tay-moi", stage: "Du lịch", sector: "Sân vận động", office: "40.192 chỗ ngồi", website: null, source: "curated", price: "Theo trận đấu" },
  { id: "bao-tang-dan-toc-hoc", name: "Bảo tàng Dân tộc học", lat: 21.0407, lng: 105.799, area: "tay-moi", stage: "Du lịch", sector: "Bảo tàng", office: "54 dân tộc Việt Nam", website: "https://vme.org.vn/", source: "curated", price: "Vé ~40k" },
  { id: "bao-tang-ha-noi", name: "Bảo tàng Hà Nội", lat: 21.0107, lng: 105.7797, area: "tay-moi", stage: "Du lịch", sector: "Bảo tàng", office: "Toà kim tự tháp ngược", website: null, source: "curated", price: "Miễn phí" },

  // ---------------- BĐS · Real estate ----------------
  { id: "vin-metropolis", name: "Vinhomes Metropolis", lat: 21.0308, lng: 105.814, area: "tay-moi", stage: "BĐS", sector: "Căn hộ cao cấp", office: "CĐT Vingroup · 3 toà", website: "https://vinhomes.vn/", source: "curated", address: "29 Liễu Giai, Ba Đình" },
  { id: "lotte-center", name: "Lotte Center Hà Nội", lat: 21.0318, lng: 105.812, area: "tay-moi", stage: "BĐS", sector: "Phức hợp KS – VP – căn hộ", office: "272 m · 65 tầng", website: "https://lottecenter.com.vn/", source: "curated", address: "54 Liễu Giai, Ba Đình" },
  { id: "keangnam-l72", name: "Keangnam Landmark 72", lat: 21.017, lng: 105.7827, area: "tay-moi", stage: "BĐS", sector: "Phức hợp", office: "336 m · toà nhà cao nhất Hà Nội", website: null, source: "curated", address: "Phạm Hùng, Nam Từ Liêm" },
  { id: "vin-skylake", name: "Vinhomes Skylake", lat: 21.015, lng: 105.785, area: "tay-moi", stage: "BĐS", sector: "Căn hộ cao cấp", office: "CĐT Vingroup", website: "https://vinhomes.vn/", source: "curated", address: "Phạm Hùng, Nam Từ Liêm" },
  { id: "ciputra", name: "Ciputra Hanoi", lat: 21.0805, lng: 105.806, area: "ho-tay", stage: "BĐS", sector: "Khu đô thị quốc tế", office: "300 ha · từ 2002", website: "https://www.ciputrahanoi.com.vn/", source: "curated", address: "Phú Thượng, Tây Hồ" },
  { id: "sunshine-city", name: "Sunshine City", lat: 21.0815, lng: 105.8185, area: "ho-tay", stage: "BĐS", sector: "Căn hộ cao cấp", office: "Khu Ciputra, ven sông Hồng", website: null, source: "approx", address: "Phú Thượng, Tây Hồ" },
  { id: "dle-roi-soleil", name: "D'. Le Roi Soleil", lat: 21.0648, lng: 105.8265, area: "ho-tay", stage: "BĐS", sector: "Căn hộ hạng sang", office: "Bán đảo Quảng An", website: null, source: "approx", address: "Đặng Thai Mai, Tây Hồ" },
  { id: "sun-thuy-khue", name: "Sun Grand City Thụy Khuê", lat: 21.0425, lng: 105.8195, area: "ho-tay", stage: "BĐS", sector: "Căn hộ cao cấp", office: "Sát Hồ Tây", website: null, source: "approx", address: "69B Thụy Khuê, Tây Hồ" },
  { id: "vin-times-city", name: "Vinhomes Times City", lat: 21.0028, lng: 105.8687, area: "nam", stage: "BĐS", sector: "Khu đô thị", office: "CĐT Vingroup · có thuỷ cung", website: "https://vinhomes.vn/", source: "curated", address: "458 Minh Khai, Hai Bà Trưng" },
  { id: "vin-royal-city", name: "Vinhomes Royal City", lat: 21.0022, lng: 105.8155, area: "nam", stage: "BĐS", sector: "Khu đô thị", office: "TTTM ngầm từng lớn nhất châu Á", website: "https://vinhomes.vn/", source: "curated", address: "72A Nguyễn Trãi, Thanh Xuân" },
  { id: "vin-riverside", name: "Vinhomes Riverside", lat: 21.038, lng: 105.898, area: "song-hong", stage: "BĐS", sector: "Biệt thự sinh thái", office: "Kênh đào kiểu Venice", website: "https://vinhomes.vn/", source: "approx", address: "Việt Hưng, Long Biên" },
  { id: "mipec-riverside", name: "Mipec Riverside", lat: 21.0448, lng: 105.8672, area: "song-hong", stage: "BĐS", sector: "Căn hộ ven sông", office: "View trọn cầu Long Biên", website: null, source: "approx", address: "Ngọc Lâm, Long Biên" },
];

// Blurb song ngữ + vị trí xấp xỉ (phố · khu, không phải số nhà chính xác).
export const COMPANY_INFO = {
  "pho-bat-dan": { blurb: "Phở bò 'xếp hàng tự bưng' trứ danh, nước dùng đậm kiểu cũ. · Old-school beef phở where you queue, pay, and carry your own bowl.", loc: "Bát Đàn · Phố cổ" },
  "pho-10-ly-quoc-su": { blurb: "Thương hiệu phở bò nổi tiếng với nước trong, thịt mềm. · A Hanoi phở institution — clear broth, tender brisket.", loc: "Lý Quốc Sư · Phố cổ" },
  "pho-thin-lo-duc": { blurb: "Phở tái lăn xào lửa lớn nhiều hành — một trường phái riêng. · Wok-seared 'tái lăn' phở, a school of its own since 1979.", loc: "Lò Đúc · Hai Bà Trưng" },
  "bun-cha-huong-lien": { blurb: "Quán bún chả nơi Tổng thống Obama và Anthony Bourdain dùng bữa năm 2016. · Where Obama and Bourdain shared bún chả and beer in 2016.", loc: "Lê Văn Hưu · Hai Bà Trưng" },
  "bun-cha-dac-kim": { blurb: "Bún chả Hàng Mành đầy ụ, kèm nem cua bể. · Overflowing bowls of bún chả with crab spring rolls.", loc: "Hàng Mành · Phố cổ" },
  "cha-ca-la-vong": { blurb: "Chả cá lăng rán trên chảo ngay tại bàn, món ăn sinh ra con phố. · Turmeric fish sizzled tableside — the dish that named its street.", loc: "Phố Chả Cá · Phố cổ" },
  "ca-phe-giang": { blurb: "Nơi ông Nguyễn Văn Giảng sáng tạo cà phê trứng năm 1946. · Birthplace of Hanoi egg coffee, invented here in 1946.", loc: "Nguyễn Hữu Huân · Phố cổ" },
  "ca-phe-dinh": { blurb: "Gác hai nhỏ xíu nhìn ra Hồ Gươm, cà phê trứng của con gái cụ Giảng. · A tiny balcony over the lake; egg coffee by Giảng's daughter.", loc: "Đinh Tiên Hoàng · Hồ Gươm" },
  "cong-ca-phe": { blurb: "Chuỗi cà phê phong cách bao cấp, cốt dừa cà phê đáng thử nhất. · Retro subsidy-era chain; try the coconut coffee slush.", loc: "Nhà Thờ · Phố cổ" },
  "kem-trang-tien": { blurb: "Que kem cốm, sô-cô-la huyền thoại — đứng ăn ngay vỉa hè từ 1958. · Legendary young-rice ice cream bars, eaten curbside since 1958.", loc: "Tràng Tiền · Phố Pháp" },
  "bia-ta-hien": { blurb: "Ghế nhựa, bia hơi tươi và cả thế giới đi ngang 'ngã tư quốc tế'. · Plastic stools, fresh draft beer, the world walking by.", loc: "Tạ Hiện · Phố cổ" },
  "banh-mi-25": { blurb: "Bánh mì giòn nổi tiếng với du khách, có cả góc ngồi cà phê. · Crackly baguettes beloved by travellers, with a café corner.", loc: "Hàng Cá · Phố cổ" },
  "xoi-yen": { blurb: "Xôi xéo hành phi ngập topping, mở tới khuya. · Mounded sticky rice with mung bean and fried shallots, open late.", loc: "Nguyễn Hữu Huân · Phố cổ" },
  "bun-thang-ba-duc": { blurb: "Bún thang thanh nhã — 'bát bún của người Hà Nội cũ'. · The refined 'ladder noodle' soup of old Hanoi families.", loc: "Cầu Gỗ · Phố cổ" },
  "pho-cuon-ngu-xa": { blurb: "Bánh phở cuốn thịt bò rau thơm, đặc sản làng đúc đồng Ngũ Xã. · Fresh rice-sheet rolls from the old bronze-casting village.", loc: "Ngũ Xã · Trúc Bạch" },
  "banh-tom-ho-tay": { blurb: "Bánh tôm chiên giòn ăn nhìn ra mặt hồ, hương vị từ 1958. · Crisp shrimp fritters with a lake view, unchanged since 1958.", loc: "Thanh Niên · Hồ Tây" },
  "quan-an-ngon": { blurb: "Món ăn đường phố ba miền hội tụ trong sân biệt thự Pháp. · Street food from all three regions in a French villa courtyard.", loc: "Phan Bội Châu · Phố Pháp" },

  "ho-guom": { blurb: "Hồ thiêng giữa lòng thành phố với Tháp Rùa trăm năm soi bóng. · The sacred lake at the city's heart, Turtle Tower at its centre.", loc: "Hồ Hoàn Kiếm" },
  "den-ngoc-son": { blurb: "Qua cầu Thê Húc đỏ son vào đền trên đảo Ngọc. · Cross the scarlet Thê Húc bridge to the island temple.", loc: "Đảo Ngọc · Hồ Gươm" },
  "cho-dong-xuan": { blurb: "Chợ lớn nhất phố cổ từ 1889, thiên đường đồ khô và vải vóc. · The Old Quarter's grand market since 1889.", loc: "Đồng Xuân · Phố cổ" },
  "o-quan-chuong": { blurb: "Cửa ô cuối cùng của kinh thành Thăng Long xưa. · The last surviving gate of the old citadel walls.", loc: "Hàng Chiếu · Phố cổ" },
  "nha-tho-lon": { blurb: "Nhà thờ neo-Gothic 1886, điểm hẹn trà chanh vỉa hè. · Neo-Gothic cathedral of 1886, ringed by lemon-tea stools.", loc: "Nhà Thờ · Phố cổ" },
  "pho-duong-tau": { blurb: "Đoàn tàu lướt sát hiên nhà — trải nghiệm chỉ có ở Hà Nội. · Trains brushing past café balconies — only in Hanoi.", loc: "Phùng Hưng · Cửa Đông" },
  "nha-hat-lon": { blurb: "Bản giao hưởng kiến trúc Pháp 1911, phỏng theo Opéra Garnier. · The 1911 opera house, modelled on the Palais Garnier.", loc: "Tràng Tiền · Phố Pháp" },
  "hoa-lo": { blurb: "Nhà tù thời thuộc địa — 'Hanoi Hilton', nay là bảo tàng ký ức. · The colonial prison later dubbed the 'Hanoi Hilton'.", loc: "Hỏa Lò · Phố Pháp" },
  "bao-tang-phu-nu": { blurb: "Câu chuyện người phụ nữ Việt qua chiến tranh và đời thường. · Vietnamese women's stories in war and daily life.", loc: "Lý Thường Kiệt · Phố Pháp" },
  "lang-bac": { blurb: "Nơi an nghỉ của Chủ tịch Hồ Chí Minh bên quảng trường Ba Đình. · Hồ Chí Minh's resting place on Ba Đình Square.", loc: "Quảng trường Ba Đình" },
  "chua-mot-cot": { blurb: "Ngôi chùa toà sen trên một cột đá giữa hồ vuông, biểu tượng từ 1049. · The lotus pagoda on a single pillar, first raised in 1049.", loc: "Chùa Một Cột · Ba Đình" },
  "hoang-thanh": { blurb: "Trục di sản 13 thế kỷ của các vương triều Thăng Long. · Thirteen centuries of royal citadel, a UNESCO site.", loc: "Hoàng Diệu · Ba Đình" },
  "cot-co": { blurb: "Tháp cờ 33 m thời Nguyễn, biểu tượng của thủ đô. · The 33 m Nguyễn-dynasty flag tower, an icon of the capital.", loc: "Điện Biên Phủ · Ba Đình" },
  "van-mieu": { blurb: "Văn Miếu 1070 và 82 bia tiến sĩ trên lưng rùa đá. · The 1070 Temple of Literature and its 82 turtle-borne stelae.", loc: "Quốc Tử Giám · Đống Đa" },
  "chua-tran-quoc": { blurb: "Bảo tháp đỏ 11 tầng trên đảo nhỏ Hồ Tây, cổ nhất Hà Nội. · The red 11-tier stupa on a West Lake islet — Hanoi's oldest pagoda.", loc: "Thanh Niên · Hồ Tây" },
  "phu-tay-ho": { blurb: "Phủ thờ Mẫu Liễu Hạnh nơi bán đảo nhô ra mặt hồ. · Shrine to Mother Goddess Liễu Hạnh on the lake peninsula.", loc: "Quảng An · Hồ Tây" },
  "duong-thanh-nien": { blurb: "'Con đường tình yêu' chạy giữa hai mặt nước Hồ Tây – Trúc Bạch. · The lovers' causeway between two lakes.", loc: "Thanh Niên · Tây Hồ" },
  "cau-long-bien": { blurb: "Cầu thép 1902 mang vết tích bom đạn, tàu vẫn chạy mỗi ngày. · The battle-scarred 1902 steel bridge; trains still cross daily.", loc: "Sông Hồng" },
  "bai-da-song-hong": { blurb: "Vườn hoa bãi bồi ven sông — điểm chụp ảnh cưới yêu thích. · Riverside flower fields, a wedding-photo favourite.", loc: "Âu Cơ · Nhật Tân" },
  "cv-thong-nhat": { blurb: "Lá phổi xanh phía nam với hồ Bảy Mẫu và đường dạo rợp cây. · The southern green lung around Bảy Mẫu lake.", loc: "Trần Nhân Tông · Hai Bà Trưng" },
  "svd-my-dinh": { blurb: "Chảo lửa của bóng đá Việt Nam từ SEA Games 2003. · The cauldron of Vietnamese football since 2003.", loc: "Mỹ Đình · Nam Từ Liêm" },
  "bao-tang-dan-toc-hoc": { blurb: "Nhà rông, nhà dài và văn hoá 54 dân tộc trong vườn kiến trúc. · Stilt houses and the cultures of Vietnam's 54 peoples.", loc: "Nguyễn Văn Huyên · Cầu Giấy" },
  "bao-tang-ha-noi": { blurb: "Kim tự tháp ngược kể nghìn năm Thăng Long – Hà Nội. · An inverted pyramid holding a millennium of Hanoi.", loc: "Phạm Hùng · Nam Từ Liêm" },

  "vin-metropolis": { blurb: "Ba toà tháp cao cấp cạnh Lotte, tiện ích khép kín trung tâm Ba Đình. · Three luxury towers beside Lotte Center.", loc: "Liễu Giai · Ba Đình" },
  "lotte-center": { blurb: "Toà tháp 65 tầng với đài quan sát sky deck nhìn trọn thành phố. · 65 floors with a glass sky deck over the whole city.", loc: "Liễu Giai · Ba Đình" },
  "keangnam-l72": { blurb: "Toà nhà cao nhất Hà Nội (336 m): văn phòng, căn hộ, khách sạn. · Hanoi's tallest tower at 336 m — offices, flats, hotel.", loc: "Phạm Hùng · Nam Từ Liêm" },
  "vin-skylake": { blurb: "Ba toà căn hộ nhìn xuống công viên hồ điều hoà Mỹ Đình. · Lakeside towers over the Mỹ Đình park.", loc: "Phạm Hùng · Mỹ Đình" },
  "ciputra": { blurb: "Khu đô thị quốc tế đầu tiên của Hà Nội: biệt thự, sân golf view sông. · Hanoi's first international township — villas and golf by the river.", loc: "Phú Thượng · Tây Hồ" },
  "sunshine-city": { blurb: "Tổ hợp căn hộ ánh vàng ven đê sông Hồng khu Ciputra. · Gold-tinted towers by the river dyke at Ciputra.", loc: "Phú Thượng · Tây Hồ" },
  "dle-roi-soleil": { blurb: "Căn hộ hạng sang đầu bán đảo Quảng An, view hai mặt nước. · Ultra-luxury flats at the tip of the Quảng An peninsula.", loc: "Đặng Thai Mai · Hồ Tây" },
  "sun-thuy-khue": { blurb: "Hai toà tháp sát mép nước phía nam Hồ Tây. · Twin towers at the lake's southern rim.", loc: "Thụy Khuê · Tây Hồ" },
  "vin-times-city": { blurb: "'Thành phố trong lòng phố' với thuỷ cung và quảng trường nhạc nước. · A city-within-a-city with an aquarium and light fountains.", loc: "Minh Khai · Hai Bà Trưng" },
  "vin-royal-city": { blurb: "Quần thể tháp kiểu châu Âu trên nền nhà máy cũ, TTTM ngầm khổng lồ. · European-style towers over a vast underground mall.", loc: "Nguyễn Trãi · Thanh Xuân" },
  "vin-riverside": { blurb: "Biệt thự ven kênh đào phong cách Venice phía đông sông Hồng. · Canal-side villas east of the river.", loc: "Việt Hưng · Long Biên" },
  "mipec-riverside": { blurb: "Căn hộ đầu cầu Long Biên, ngắm trọn sông Hồng và phố cổ. · Towers at the bridgehead with full river views.", loc: "Ngọc Lâm · Long Biên" },
};

// Context layer: các điểm tham chiếu quanh thành phố.
export const CONTEXT_POINTS = [
  { id: "metropole", name: "Sofitel Legend Metropole", category: "Khách sạn", lat: 21.0252, lng: 105.857 },
  { id: "intercon-westlake", name: "InterContinental Westlake", category: "Khách sạn", lat: 21.0555, lng: 105.8332 },
  { id: "jw-marriott", name: "JW Marriott Hanoi", category: "Khách sạn", lat: 21.0075, lng: 105.7832 },
  { id: "daewoo", name: "Hotel du Parc Hà Nội", category: "Khách sạn", lat: 21.0318, lng: 105.8095 },
  { id: "melia", name: "Meliá Hanoi", category: "Khách sạn", lat: 21.0245, lng: 105.8455 },
  { id: "trang-tien-plaza", name: "Tràng Tiền Plaza", category: "Chợ & TTTM", lat: 21.0245, lng: 105.8542 },
  { id: "vincom-ba-trieu", name: "Vincom Bà Triệu", category: "Chợ & TTTM", lat: 21.0113, lng: 105.8494 },
  { id: "cho-hom", name: "Chợ Hôm – Đức Viên", category: "Chợ & TTTM", lat: 21.0165, lng: 105.8525 },
  { id: "cho-long-bien", name: "Chợ đầu mối Long Biên", category: "Chợ & TTTM", lat: 21.0405, lng: 105.852 },
  { id: "cho-hoa-quang-ba", name: "Chợ hoa đêm Quảng Bá", category: "Chợ & TTTM", lat: 21.0688, lng: 105.8245 },
  { id: "aeon-long-bien", name: "Aeon Mall Long Biên", category: "Chợ & TTTM", lat: 21.0275, lng: 105.8985 },
  { id: "lotte-mall-tay-ho", name: "Lotte Mall Tây Hồ", category: "Chợ & TTTM", lat: 21.0705, lng: 105.8125 },
  { id: "hust", name: "ĐH Bách khoa Hà Nội", category: "Đại học", lat: 21.0055, lng: 105.8431 },
  { id: "vnu", name: "ĐHQG Hà Nội (Xuân Thủy)", category: "Đại học", lat: 21.0378, lng: 105.7822 },
  { id: "ftu", name: "ĐH Ngoại thương", category: "Đại học", lat: 21.0225, lng: 105.8035 },
  { id: "neu", name: "ĐH Kinh tế Quốc dân", category: "Đại học", lat: 20.9995, lng: 105.8465 },
];
