// 把 Parser.gs / Logic.gs 載入同一個沙盒，模擬 Apps Script 的全域環境。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export function loadGs() {
  const ctx = vm.createContext({ console });
  for (const f of ['Parser.gs', 'Logic.gs']) {
    vm.runInContext(fs.readFileSync(path.join(dir, '..', f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

export function fixture(name) {
  const text = fs.readFileSync(path.join(dir, 'fixtures', name), 'utf8');
  const i = text.indexOf('\n\n');
  return { subject: text.slice(0, i).replace(/^Subject:\s*/, ''), body: text.slice(i + 2) };
}

/** 台北時間 → epoch 毫秒（測試用）。 */
export function tpe(y, m, d, h, mi) {
  return Date.UTC(y, m - 1, d, h - 8, mi);
}
