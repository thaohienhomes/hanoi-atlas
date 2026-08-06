> **Đã xong, đây là ghi chú lịch sử.** Từ 06/08/2026 dự án deploy thẳng từ
> repo GitHub `thaohienhomes/hanoi-atlas` — sửa file, `git push`, Vercel tự
> build. Không cần làm gì trong tài liệu này nữa. Giữ lại để dò lại lịch sử
> nếu cần, và để hiểu vì sao production trước đó được ghép như vậy.

# Sơ đồ deploy · cách bản production được ghép lại

Đọc file này trước khi deploy lại. Nó là thứ duy nhất ghi lại chuỗi ghép,
và nếu mất thì phải dò lại từ đầu.

## Vì sao lại rắc rối thế này

`src/main.js` đã hơn 230 nghìn ký tự — quá lớn để đẩy thẳng trong một lần
deploy qua API. Nên mã nguồn bị cắt thành nhiều "lớp" `.txt`, mỗi lớp nằm
trên một Vercel deployment **bất biến** (deployment cũ không bao giờ đổi
nội dung). Lúc build, `setup.mjs` tải các lớp về, nối lại, rồi áp lần lượt
các bản vá unified-diff cho từng đợt sửa.

Mọi bước đều **kiểm tra độ dài**. Sai một ký tự là build dừng ngay chứ
không im lặng phát hành bản hỏng. Điều này đã cứu một lần thật: đợt vá
`patch-sources` ghi nhầm 21871 thay vì 21728, build fail, production
không bị đụng tới.

## Bảng lớp

Nền (nối liền theo đúng thứ tự này thành `src/main.js` gốc):

| Lớp | Deployment | Đường dẫn | Ký tự |
|---|---|---|---|
| main-a | `default-h7dyltv1m` | `/main-a.txt` | 29176 |
| main-b | `default-1wv1mtvjf` | `/main-b.txt` | 28863 |
| main-c | `default-a7441imc9` | `/main-c.txt` | 41589 |
| main-d | `hanoi-atlas-crvgh5n9a` | `/main-d.txt` | 37451 |
| main-e | `hanoi-atlas-gpegum5we` | `/main-e.txt` | 42059 |

Các file khác:

| Lớp | Deployment | Đường dẫn | Ký tự |
|---|---|---|---|
| geo | `default-apcujqizb` | `/geo.txt` | 17127 |
| data | `default-2d1b3gmnh` | `/data.txt` | 28178 |
| icons | `hanoi-atlas-o9ot3i3ar` | `/icons.txt` | 9594 |
| styles | `default-jfj7rfnk7` | `/styles.txt` | 22064 |
| styles-extra | `hanoi-atlas-xgux52a8s` | `/styles-extra.txt` | 4807 |

Bản vá, áp **đúng thứ tự này**, mỗi bản viết tiếp lên kết quả của bản trước:

| Bản vá | Deployment | Ký tự | Nội dung |
|---|---|---|---|
| patch-map | `hanoi-atlas-roisvdzpf` | 24803 | Bản đồ đường phố thật + toạ độ thật 45/52 |
| patch-sources | `hanoi-atlas-4iqycfn2q` | 21728 | Bảng Nguồn & đối chiếu |
| patch-lez | `hanoi-atlas-p8yqnl3fw` | 24410 | Vùng phát thải thấp + trạm sạc |

Tất cả có dạng `https://<deployment>-thaohienhomes.vercel.app<đường dẫn>`.

Font `public/fonts/GeistVF.woff2` tải từ deployment
`hanoi-atlas-jnreypsxk` (nhị phân nên không cắt lớp được).

Kết quả sau khi ghép + vá đủ ba bản: `src/main.js` 230771 ký tự,
`src/styles.css` 39533 ký tự.

## Thoát khỏi cách này

Chuỗi trên phụ thuộc vào 13 deployment cũ còn sống. Xoá nhầm một cái là
build gãy và mã nguồn rất khó dựng lại. **Nên chuyển sang git càng sớm
càng tốt**: khi đã có repo, bỏ hẳn `setup.mjs`, trả `installCommand` về
`npm install`, và Vercel build thẳng từ repo như mọi dự án bình thường.

Bản sao đầy đủ của mã nguồn nằm ngay trong gói này — `src/main.js` và
`src/styles.css` ở đây **đã là bản đã vá đủ**, không cần chạy lại chuỗi.

## Nếu vẫn phải deploy theo cách cũ

1. Sửa `src/main.js` / `src/styles.css` ở máy.
2. Dựng lại trạng thái đang chạy: nối các lớp nền rồi áp các bản vá đã có
   (dùng `deploy/applypatch.mjs`).
3. `diff -U1 <bản đang chạy> <bản mới>` để ra bản vá tiếp theo, thêm dòng
   tiêu đề `##### src/main.js <số ký tự mới>`.
4. Deploy bản vá đó lên một Vercel **preview** (không phải production —
   preview cũng bất biến và không đụng tới trang đang chạy).
5. Tải lại chính file vừa deploy, áp thử ở máy, so byte với bản ở máy.
6. Chỉ khi khớp mới deploy production với `setup.mjs` đã thêm lớp mới.
