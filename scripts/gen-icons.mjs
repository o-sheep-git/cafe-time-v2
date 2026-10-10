// アプリのアイコン（PNG）を作る。依存なし。`npm run icons` で public/icons/ に書き出す。
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// 24x24 のドット絵。湯気の立つコーヒーカップ
const ART = [
  '........................',
  '........................',
  '.........s....s.........',
  '........s....s..........',
  '.........s....s.........',
  '..........s....s........',
  '.........s....s.........',
  '........................',
  '.....wwwwwwwwwwwww......',
  '....wkkkkkkkkkkkkkw.....',
  '....wwkkkkkkkkkkkww.www.',
  '....wwwwwwwwwwwwwwww..w.',
  '....wwwwwwwwwwwwwww...w.',
  '....wwwwwwwwwwwwwww...w.',
  '....dwwwwwwwwwwwwwwwww..',
  '.....wwwwwwwwwwwwwd.....',
  '.....dwwwwwwwwwwwd......',
  '......ddwwwwwwwdd.......',
  '..pppppdddddddddppppp...',
  '.ppppppppppppppppppppp..',
  '..qqppppppppppppppqq....',
  '....qqqqqqqqqqqqqq......',
  '........................',
  '........................',
];
const PAL = { w: [246, 237, 220], d: [217, 201, 172], k: [74, 44, 28], p: [239, 227, 202], q: [196, 176, 142], s: [240, 224, 196] };
const BG = [156, 67, 46];
const BG_DARK = [122, 50, 34];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pad) {
  // pad: 絵のまわりの余白（ドット）。マスク用は多めに取る
  const grid = ART.length + pad * 2;
  const cell = size / grid;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell) - pad;
      const gy = Math.floor(y / cell) - pad;
      const ch = ART[gy]?.[gx] ?? '.';
      let c = PAL[ch];
      if (!c) c = Math.floor(y / cell) >= grid - Math.max(2, pad) ? BG_DARK : BG;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), png(192, 4));
writeFileSync(join(outDir, 'icon-512.png'), png(512, 4));
writeFileSync(join(outDir, 'icon-maskable-512.png'), png(512, 4));
console.log('icons written to', outDir);
