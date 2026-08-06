// Bộ vá unified-diff tối giản, dùng chung giữa bản thử ở máy và setup.mjs khi build.
export function applyUnifiedDiff(source, patch, label = "file") {
  const src = source.split("\n");
  const out = [];
  const lines = patch.split("\n");
  let cursor = 0; // vị trí đang đọc trong src (0-based)
  let i = 0;

  while (i < lines.length) {
    const head = lines[i];
    if (!head.startsWith("@@")) {
      i += 1;
      continue;
    }
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(head);
    if (!m) throw new Error(`${label}: hunk header lạ: ${head}`);
    const oldStart = Number(m[1]) - 1;
    const oldCount = m[2] === undefined ? 1 : Number(m[2]);
    i += 1;

    if (oldStart < cursor) throw new Error(`${label}: hunk chồng nhau tại dòng ${oldStart + 1}`);
    while (cursor < oldStart) out.push(src[cursor++]);

    let taken = 0;
    while (i < lines.length && taken < oldCount) {
      const line = lines[i];
      if (line.startsWith("@@")) break;
      if (line.startsWith("\\")) {
        i += 1;
        continue; // "\ No newline at end of file"
      }
      // Dòng ngữ cảnh của một dòng trống có thể là " " hoặc rỗng hẳn, tuỳ chỗ
      // bản vá đi qua có bị cắt khoảng trắng cuối dòng hay không. Nhận cả hai.
      const kind = line === "" ? " " : line[0];
      const text = line === "" ? "" : line.slice(1);
      if (kind === " ") {
        if (src[cursor] !== text) throw new Error(`${label}: lệch ngữ cảnh ở dòng ${cursor + 1}`);
        out.push(src[cursor++]);
        taken += 1;
      } else if (kind === "-") {
        if (src[cursor] !== text) throw new Error(`${label}: dòng cần xoá không khớp ở ${cursor + 1}`);
        cursor += 1;
        taken += 1;
      } else if (kind === "+") {
        out.push(text);
      } else {
        throw new Error(`${label}: ký tự lạ đầu dòng: ${JSON.stringify(line.slice(0, 12))}`);
      }
      i += 1;
    }
    // phần "+" còn lại ngay sau khi đã tiêu thụ đủ oldCount
    while (i < lines.length && lines[i].startsWith("+")) {
      out.push(lines[i].slice(1));
      i += 1;
    }
  }

  while (cursor < src.length) out.push(src[cursor++]);
  return out.join("\n");
}
