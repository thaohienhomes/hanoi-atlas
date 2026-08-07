# Hà Nội Atlas

**Hà Nội Atlas** là bản đồ 3D tương tác của Hà Nội: 52 địa điểm **ẩm thực · du lịch · bất động sản**, khám phá theo 7 khu vực với camera bay như phim. Bên cạnh đó là các lớp dữ liệu công dùng được hằng ngày: tra phường xã sau sáp nhập, vùng phát thải thấp, trạm sạc xe điện, sơ đồ quy hoạch khung 2045 — mỗi lớp đều dẫn được về văn bản gốc của nhà nước.

*An interactive 3D map of Hanoi — 52 places to eat, explore, and live, across 7 flyable districts — plus civic data layers with citations back to the original government documents.*

## Bản đồ có gì / What it shows

- 52 địa điểm thuộc 3 nhóm: **Ẩm thực** (phở Bát Đàn, bún chả Obama, cà phê trứng Giảng…), **Du lịch** (Hồ Gươm, Lăng Bác, Văn Miếu, Trấn Quốc…), **BĐS** (Times City, Royal City, Keangnam, Lotte, Ciputra…).
- Địa lý vẽ tay: sông Hồng với **bãi giữa**, Hồ Tây (đúng hình quả thận + bán đảo Quảng An), Hồ Gươm có Tháp Rùa và cầu Thê Húc đỏ, hồ Trúc Bạch, các công viên.
- 4 cây cầu: **Long Biên** (dầm thép có nhịp vồng + tàu hoả chạy qua), Chương Dương, Vĩnh Tuy, **Nhật Tân** (5 trụ dây văng).
- Metro **2A Cát Linh–Hà Đông** (xanh) và **Line 3 Nhổn–Cầu Giấy** (hồng) chạy trên cao đúng như thật; đường sắt quốc gia leo lên cầu Long Biên.
- Giao thông đặc sản: **xe máy chiếm đa số**, taxi Xanh SM màu ngọc, xe buýt vàng kem sọc đỏ, xà lan chở cát trên sông, thuyền thiên nga Hồ Tây, máy bay lên xuống Nội Bài.
- Hơn 20 công trình dựng 3D thủ công: Tháp Rùa, Lăng Bác, Cột cờ, Nhà thờ Lớn, Nhà hát Lớn, chùa Trấn Quốc 11 tầng, Khuê Văn Các, chợ Đồng Xuân, Keangnam 72, Lotte Center, sân Mỹ Đình, Bảo tàng Hà Nội (kim tự tháp ngược)…
- UI song ngữ Việt–Anh, tìm kiếm ⌘K, deep-link `#/place/:id`, thẻ chi tiết có giá tham khảo + nút Google Maps.

## Chạy thử / Getting started

```sh
pnpm install    # hoặc npm install
npm run dev     # http://127.0.0.1:5173
npm run build   # build production vào dist/
npm run preview
npm run logos   # sinh lại icon SVG cho các địa điểm (scripts/make-icons.mjs)
```

Không cần backend, không cần API key — toàn bộ là file tĩnh, deploy được thẳng lên Vercel/Netlify/GitHub Pages.

## Cấu trúc / Structure

```text
├── index.html            # shell + HUD song ngữ + mini map Hà Nội
├── src/
│   ├── data.js           # 52 địa điểm, 8 khu vực, context points — SỬA DỮ LIỆU Ở ĐÂY
│   ├── geo.js            # địa lý Hà Nội vẽ tay: 2 bờ sông, hồ, cầu, metro, đại lộ
│   ├── main.js           # scene Three.js: nhà cửa, landmark, xe cộ, camera, UI
│   └── styles.css        # HUD kính mờ (giữ nguyên từ bản gốc)
├── scripts/make-icons.mjs # sinh icon SVG theo nhóm cho từng địa điểm
└── public/logos/          # icon của từng địa điểm, key theo id
```

## Tiện ích hằng ngày / Everyday tools

- **Nút VI | EN** trên HUD đổi toàn bộ giao diện *và* mô tả địa điểm. Mặc định theo ngôn ngữ trình duyệt (khách nước ngoài mở là ra tiếng Anh), nhớ lựa chọn cho lần sau, ép bằng `?lang=en`. Dữ liệu song ngữ viết theo mẫu `Tiếng Việt. · English.` trong `blurb` và `description` — app tự tách theo dấu ` · `.
- **Chip Ăn / Chơi / Ở** ngay dưới danh sách khu vực vừa là chú thích màu vừa là bộ lọc: chạm để chỉ hiện một nhóm, số đếm khu vực và mini map cập nhật theo, link chia sẻ giữ nguyên bộ lọc (`?nhom=an`, `?nhom=choi`, `?nhom=o`).
- **Gần tôi** xin quyền định vị, cắm một chấm sáng ở chỗ bạn đang đứng, bay tới địa điểm gần nhất và hiện khoảng cách trên thẻ chi tiết cùng trong ô tìm kiếm.
- **Chỉ đường** mở thẳng Google Maps điều hướng. Điểm đến gửi đi bằng **tên + địa chỉ** để Google khớp đúng cửa hàng thật (dữ liệu POI của Google ở Hà Nội chính xác hơn một toạ độ ước lượng).
- **Đèn đêm**: khi trời tối (thật hoặc `?wx=night`), đèn cao áp dọc các đại lộ, đèn cầu Long Biên – Nhật Tân, dải metro trên cao và đèn cửa sổ nhà dân cùng sáng lên.
- **Khung hình tự co**: màn hình càng dọc camera càng lùi và nghiêng xuống, nên mở trên điện thoại vẫn thấy trọn Hồ Tây – Phố cổ thay vì một góc phố.
- **Cài về màn hình chính**: có manifest + service worker, khách du lịch "Add to Home Screen" là dùng như app, mạng yếu vẫn mở được.
- **Đang mở cửa**: điền cột **Giờ mở** trong Sheet (ví dụ `6:00–10:00 & 18:00–20:30`) là thẻ chi tiết tự hiện "Mở đến 22:00" hay "Mở lại 6:00" theo giờ Hà Nội thật.

## Bản đồ đường phố thật / Real street map

Nút **Bản đồ thật** (phím `M`) lật từ thành phố 3D vẽ tay sang nền OpenStreetMap thật, dựng bằng [MapLibre GL JS](https://maplibre.org) + [OpenFreeMap](https://openfreemap.org) — miễn phí, không cần API key, không giới hạn lượt gọi. Thành phố 3D đẹp để nhìn tổng thể nhưng không đi theo được; nền này có đủ từng ngõ, từng số nhà, nên đây mới là chỗ để dò đường.

- **Toạ độ thật**: 45/52 địa điểm đã dò lại vị trí ngoài thực địa từ OpenStreetMap (Nominatim, có gợi ý tên riêng cho từng nơi, ngưỡng loại 900 m — sai lệch trung bình **192 m**). Bảng `REAL_COORDS` trong `src/main.js`. 7 điểm OSM chưa có hoặc trùng tên vẫn dùng toạ độ vẽ và hiện **viền đứt** để khỏi hiểu nhầm. `lat`/`lng` trong `data.js` giữ nguyên là toạ độ *cách điệu* — chúng đặt pin đúng chỗ trên bản 3D.
- **Dùng chung trạng thái với bản 3D**: chip lọc Ăn / Chơi / Ở, nút VI | EN (nhãn đường phố cũng đổi theo `name:en`), thanh khu vực, thẻ chi tiết, ô tìm kiếm ⌘K, deep-link `#/place/:id` — tất cả hoạt động y hệt ở cả hai chế độ.
- **Nhẹ cho người không dùng**: thư viện MapLibre nằm ở chunk riêng, chỉ tải khi bấm nút.
- **Link chia sẻ**: `?che-do=ban-do` mở thẳng vào bản đồ thật. Đổi nền bằng `?nen=duong` (mặc định), `?nen=sang`, `?nen=dam`, hoặc dán link style JSON bất kỳ.
- Khi đang ở bản đồ thật, vòng lặp vẽ 3D tạm ngừng cho đỡ tốn pin; bấm quay lại là hiện ngay.

Nền bản đồ này cũng là chỗ để chồng các lớp dữ liệu thật sắp tới: vùng phát thải thấp, trạm sạc xe điện, ranh giới phường mới sau sáp nhập.

## Lớp dữ liệu công / Civic data layers

Trên nền bản đồ đường phố thật có bốn chip bật lớp (`?lop=lez,sac,phuong,quy-hoach` để mở sẵn):

**Vùng phát thải thấp.** Ranh giới 9 phường lấy từ OpenStreetMap (`admin_level=6`, mức phường sau sáp nhập 2025), rút gọn Douglas–Peucker ngưỡng 25 m — 756 xuống 171 đỉnh, lệch tối đa 28 m so với ranh giới gốc. Vẽ **nét đứt** là cố ý. Bảng ghi chú nói rõ: *đường kẻ là ranh giới PHƯỜNG, không phải ranh giới vùng cấm; vùng thí điểm chỉ là một số khu vực bên trong.* **39/52 địa điểm** nằm trong 9 phường này — thẻ chi tiết của chúng có thêm một chip cảnh báo. Khung giờ cấm **không hiện**, vì Nghị quyết 57/2025/NQ-HĐND không ấn định giờ.

**Trạm sạc xe điện.** 259 điểm từ OpenStreetMap (`amenity=charging_station`), gom về lưới ~11 m và mã hoá delta còn 2,1 KB. 228 điểm của VinFast. Ghi chú nói thẳng rằng OSM hầu như **không ghi trạm nào nhận xe máy điện** — đúng nhóm phương tiện bị ảnh hưởng nhất từ 1/7/2026 — nên đừng coi đây là bản đồ đủ.

Cả hai lớp đều đi qua `registerLayer()` và có link mở văn bản gốc ngay trong bảng ghi chú.

## Tra phường xã sau sáp nhập / Ward lookup

Từ 01/7/2025 Hà Nội còn **126 đơn vị cấp xã** — 51 phường và 75 xã — theo Nghị quyết 1656/NQ-UBTVQH15. Rất nhiều người vẫn chưa rõ nhà mình nay thuộc phường nào, mà cái đó thì cần cho giấy tờ và ghi địa chỉ.

Bật chip **Phường xã mới** trên bản đồ đường phố thật (`?lop=phuong` để mở sẵn), rồi chạm vào bất kỳ chỗ nào là biết chỗ đó thuộc đâu; vùng vừa tra được tô xanh nhạt. Bấm **Gần tôi** thì nó tra luôn chỗ bạn đang đứng.

- Ranh giới nằm ở `public/data/phuong-xa.txt` (61 KB, mã hoá delta), **chỉ tải khi bật lớp** nên ai không dùng không phải tải.
- Bản GeoJSON đầy đủ để phân tích: `data/hanoi-126-phuong-xa.geojson`, mở được bằng QGIS.
- Đã rút gọn ngưỡng 40 m, nên **đứng sát mép thì đừng tin ngay** — app tự cảnh báo khi điểm tra cách ranh giới dưới 120 m.
- Không hiện dân số: OSM chỉ gắn cho 72/126 đơn vị, đưa vào là ra một con số thiếu gần một nửa số xã.

## Sơ đồ quy hoạch khung 2045 / Framework master plan

Bật chip **Quy hoạch 2045** (`?lop=quy-hoach` để mở sẵn) là hiện **5 vùng đô thị** tô màu và **5 trục không gian** vẽ nét đứt, theo Quyết định 1668/QĐ-TTg ngày 27/12/2024. Chạm vào bản đồ để biết chỗ đó thuộc vùng nào.

Có một chỗ vênh phải nói thẳng, và app cũng nói thẳng ngay trong ghi chú:

- **Quyết định mô tả vùng theo quận, huyện cũ** — những đơn vị đã bỏ từ 01/7/2025. Muốn vẽ lên bản đồ hôm nay thì phải quy chiếu sang 126 phường xã mới. Cách làm: lấy ranh giới quận huyện trước sáp nhập từ [geoBoundaries](https://www.geoboundaries.org) (CC BY 4.0), rải lưới điểm bên trong từng phường xã mới, phần lớn diện tích rơi vào huyện cũ nào thì xếp theo vùng của huyện ấy. Đếm lại thì **số phường xã của cả 30 quận huyện cũ khớp đúng Nghị quyết 1656**. Dù vậy ranh giới vùng vẫn chỉ là tương đối — Hồng Hà, Phú Xuyên, Yên Xuân… nằm vắt qua hai huyện cũ.
- **Quyết định xếp Thanh Oai và Thường Tín vào vùng phía Nam, đồng thời ghi "một phần Thanh Oai, Thường Tín" thuộc vùng phía Nam sông Hồng.** Ranh giới giữa hai vùng ở đó không đọc ra được từ văn bản, nên bản đồ để cả hai huyện cũ ở vùng phía Nam và ghi rõ chỗ vênh này.
- **Năm trục chỉ được nêu tên mốc, không kèm toạ độ**, nên vẽ nét đứt nối các mốc ấy: chỉ hướng, không phải hướng tuyến kỹ thuật. Riêng trục sông Hồng lấy theo lòng sông thật trong OpenStreetMap rồi cắt vào địa giới Hà Nội.
- Vì vậy lớp này luôn kèm một dòng cảnh báo **không tắt được**: đây là sơ đồ minh hoạ, **không phải bản đồ quy hoạch pháp lý**, không dùng để tra quy hoạch thửa đất, xin phép xây dựng hay mua bán nhà đất.

Số phường xã mỗi vùng: Nam sông Hồng 55 · phía Đông 8 · phía Bắc 14 · phía Tây 29 · phía Nam 20 (tổng 126).

## Nguồn & đối chiếu / Sources and citations

Nguyên tắc của dự án: **điều gì bản đồ khẳng định mà dựa vào văn bản nhà nước thì phải dẫn được về văn bản gốc.** Bảng **Nguồn & đối chiếu** (link ở chân thanh bên, chạm vào huy hiệu thời tiết, hoặc mở thẳng `#/nguon`) liệt kê từng văn bản kèm số hiệu, cơ quan ban hành, người ký, ngày ký, ngày hiệu lực, văn bản bị thay thế, dòng "Bản đồ dùng để…", và nút **Mở văn bản gốc ↗** trỏ về cổng thông tin nhà nước để người dùng tự đọc.

- `SOURCES` trong `src/main.js` là sổ đăng ký. Mọi trường đều tuỳ chọn — chỉ hiện những gì đã thực sự đối chiếu, không bịa ngày hiệu lực cho đủ ô.
- `SOURCE_CHECKED` là ngày gần nhất mở lại từng văn bản. Quá `SOURCE_STALE_DAYS` (180) là bảng tự hiện cảnh báo vàng nhắc người dùng kiểm tra trước khi tin.
- `SOURCE_GAPS` ghi những chỗ **cố tình để trống**. Ví dụ: Nghị quyết 57/2025/NQ-HĐND nêu loại phương tiện và các mốc thời gian nhưng **không ấn định khung giờ cấm** — chi tiết chờ đề án của UBND thành phố. Bản đồ sẽ không hiện giờ nào cho tới khi có văn bản, vì một khung giờ bịa ra là có người đi nhầm đường thật.
- `registerLayer(layerId, sourceIds)` bắt mọi lớp dữ liệu pháp lý khai nguồn trước khi được vẽ; thiếu là cảnh báo ngay ở console.

Văn bản đang tham chiếu: Luật Thủ đô số 39/2024/QH15, Nghị quyết 57/2025/NQ-HĐND, Chỉ thị 20/CT-TTg, Nghị quyết 1656/NQ-UBTVQH15, Quyết định 1668/QĐ-TTg. Dữ liệu mở: OpenStreetMap (ODbL), OpenFreeMap, Open-Meteo, geoBoundaries (CC BY 4.0).

## Dữ liệu thời gian thực / Live data

**Thời tiết + AQI thật (tự bật):** mỗi lần mở trang, bản đồ gọi [Open-Meteo](https://open-meteo.com) (miễn phí, không cần key) lấy thời tiết + chất lượng không khí Hà Nội hiện tại rồi đổ vào cảnh 3D: bầu trời, sương mù, mưa hạt, mây, mặt nước, ánh đèn và cả kính phát sáng của các tháp về đêm. Huy hiệu góc phải trên hiển thị `28° Mưa phùn · AQI 137`, tự làm mới mỗi 15 phút. Xem trước mọi chế độ trời bằng query: `?wx=rain`, `?wx=night`, `?wx=storm`, `?wx=fog`, `?wx=dusk`, kết hợp `&aqi=180`… (badge sẽ ghi "demo").

**Google Sheet làm CMS (tuỳ chọn):** bản đồ có thể nạp danh sách địa điểm từ một Google Sheet đã "Publish to web → CSV" — sửa Sheet là bản đồ đổi theo ở lần tải sau, không cần build lại.

1. Import file `hanoi-atlas-dia-diem.csv` (đủ 52 địa điểm mẫu) vào một Google Sheet mới.
2. File → Share → **Publish to web** → chọn sheet + định dạng **CSV** → Publish, copy link.
3. Thử ngay: `https://hanoi-atlas.vercel.app/?sheet=<link CSV>`.
4. Cố định: dán link đó vào hằng `LIVE_SHEET_URL` trong `src/main.js` rồi deploy lại.

Cột nhận diện linh hoạt (có dấu/không dấu/tiếng Anh): `Tên/name`, `Nhóm/stage` (Ẩm thực · Du lịch · BĐS), `Lat`, `Lng`, `Khu vực/area` (bỏ trống sẽ tự gán khu gần nhất), `Loại hình`, `Thông tin`, `Giá`, `Giờ mở`, `Địa chỉ`, `Website`, `Mô tả`, `Vị trí`, `Nguồn` (=`xấp xỉ` nếu toạ độ ước lượng). Dòng thiếu tên/toạ độ hoặc nằm ngoài khung Hà Nội bị bỏ qua; Sheet lỗi/mất mạng thì bản đồ im lặng dùng dữ liệu đóng gói trong `src/data.js`. Địa điểm mới chưa có icon riêng sẽ tự dùng icon nhóm (`_cat-*.svg`).

Ảnh social preview `public/og.jpg` được sinh lúc build bởi `scripts/make-og.mjs` (cần `sharp`, là optional dependency — thiếu cũng không sao).

## Thêm địa điểm mới / Adding a place

1. Thêm 1 dòng vào `STARTUPS` trong `src/data.js` (id kebab-case, toạ độ, `area`, `stage` = `"Ẩm thực" | "Du lịch" | "BĐS"`, `sector`, `price`…).
2. Thêm blurb song ngữ vào `COMPANY_INFO` cùng file.
3. Gán glyph trong `scripts/make-icons.mjs` (`GLYPH_BY_ID`) rồi chạy `npm run logos`.
4. Cập nhật số đếm "52 địa điểm" trong `index.html` nếu tổng thay đổi, rồi `npm run build`.

## Ghi chú dữ liệu / Data notes

Toạ độ là vị trí xấp xỉ phục vụ bản đồ cách điệu, không phải dữ liệu trắc địa; các mục `source: "approx"` chỉ đúng đến mức khu phố. Giá cả chỉ mang tính tham khảo. Đề xuất địa điểm: nút **"Đề xuất địa điểm"** trong app.

## Giấy phép / Licence

**Mã nguồn theo giấy phép MIT** — xem [LICENSE](LICENSE). Dùng lại thoải mái, kể cả cho cơ quan nhà nước hay doanh nghiệp, chỉ cần giữ dòng bản quyền.

**Dữ liệu thì không phải MIT.** Ranh giới 126 phường xã, vùng phát thải thấp và trạm sạc đều suy ra từ OpenStreetMap, mà OSM phát hành theo **ODbL 1.0** — giấy phép có điều khoản chia sẻ tương tự. Ai dùng lại những tệp đó phải giữ ODbL và ghi "© những người đóng góp OpenStreetMap". Danh sách tệp cụ thể nằm trong LICENSE. Ranh giới quận huyện cũ dùng cho lớp quy hoạch lấy từ geoBoundaries (CC BY 4.0).

Phông Geist theo SIL OFL 1.1. Mô tả địa điểm, hình vẽ tay địa lý Hà Nội trong `src/geo.js` và bộ biểu tượng trong `public/logos` là do dự án tự làm.

## Credits

- Xây dựng bằng [Three.js](https://threejs.org) và [Vite](https://vite.dev), không backend, không API key.
- Nền bản đồ đường phố: [MapLibre GL JS](https://maplibre.org) + [OpenFreeMap](https://openfreemap.org).
- Font: Geist (SIL OFL, tự host).
- Dữ liệu địa điểm: chọn lọc thủ công, 2026.
