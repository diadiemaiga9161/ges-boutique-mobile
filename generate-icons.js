/**
 * Génère les icônes PWA en vrai PNG — logo Maïga Consulting (MC)
 * Fond : dégradé bleu marine sombre  ·  Lettres M (blanc) + C (bleu vif)
 * Pur Node.js, aucune dépendance npm.
 * Lancer : node generate-icons.js
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes  = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, 'src', 'assets', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/* ── Pixel-art 9×9 pour "M" (colonne 0-4) et "C" (colonne 5-8) ─────────────
   On les dessine à l'échelle dans l'icône.
   0 = fond,  1 = blanc (M),  2 = bleu vif (C)
──────────────────────────────────────────────────────────────────────────── */
const GLYPH = [
  [1,0,0,0,1, 0, 2,2,2],
  [1,1,0,1,1, 0, 2,0,0],
  [1,0,1,0,1, 0, 2,0,0],
  [1,0,0,0,1, 0, 2,0,0],
  [1,0,0,0,1, 0, 2,0,0],
  [1,0,0,0,1, 0, 2,0,0],
  [1,0,0,0,1, 0, 2,2,2],
];
const GR = GLYPH.length;   // 7 rows
const GC = GLYPH[0].length; // 9 cols

/* ── Génère les pixels RGBA d'une icône de taille `size` ─────────────────── */
function makePng(size) {
  const w = size, h = size;
  const pixels = new Uint8Array(w * h * 4);
  const radius = Math.round(size * 0.20);

  // Couleurs
  const BG0 = [0x08, 0x16, 0x48]; // bleu marine foncé (#081648)
  const BG1 = [0x0d, 0x2b, 0x85]; // bleu marine moyen (#0d2b85)
  const COL_WHITE = [0xff, 0xff, 0xff];
  const COL_BLUE  = [0x29, 0x9a, 0xff]; // bleu vif (#299aff)

  // Dimensions du glyphe dans l'icône (60% de la taille)
  const glyphH  = Math.round(size * 0.56);
  const glyphW  = Math.round(glyphH * (GC / GR));
  const glyphX0 = Math.round((size - glyphW) / 2);
  const glyphY0 = Math.round((size - glyphH) / 2);
  const cellW   = glyphW / GC;
  const cellH   = glyphH / GR;

  // Arc décoratif (cercle partiel) — reproduit l'arc du logo
  function isOnArc(x, y) {
    const cx = size * 0.52, cy = size * 0.45;
    const R  = size * 0.40;
    const dr = Math.abs(Math.sqrt((x-cx)**2 + (y-cy)**2) - R);
    const thick = Math.max(2, size * 0.015);
    if (dr > thick) return false;
    // seulement le demi-cercle supérieur-droit
    const angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
    return angle >= -170 && angle <= 0;
  }

  function inRounded(x, y) {
    const dx = Math.max(radius - x - 1, 0, x - (w - radius));
    const dy = Math.max(radius - y - 1, 0, y - (h - radius));
    return dx * dx + dy * dy <= radius * radius;
  }

  function getGlyphColor(x, y) {
    const col = Math.floor((x - glyphX0) / cellW);
    const row = Math.floor((y - glyphY0) / cellH);
    if (row < 0 || row >= GR || col < 0 || col >= GC) return null;
    const v = GLYPH[row][col];
    if (v === 1) return COL_WHITE;
    if (v === 2) return COL_BLUE;
    return null;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      if (!inRounded(x, y)) {
        pixels[idx+3] = 0; // transparent
        continue;
      }

      // Facteur dégradé diagonal
      const t = (x / w * 0.4 + y / h * 0.6);

      // Couleur glyphe ?
      const gc = getGlyphColor(x, y);
      if (gc) {
        pixels[idx]   = gc[0];
        pixels[idx+1] = gc[1];
        pixels[idx+2] = gc[2];
        pixels[idx+3] = 255;
        continue;
      }

      // Arc décoratif ?
      if (isOnArc(x, y)) {
        pixels[idx]   = Math.round(COL_BLUE[0] * 0.7);
        pixels[idx+1] = Math.round(COL_BLUE[1] * 0.7);
        pixels[idx+2] = Math.round(COL_BLUE[2] * 0.7);
        pixels[idx+3] = 200;
        continue;
      }

      // Fond dégradé
      pixels[idx]   = Math.round(BG0[0] + (BG1[0] - BG0[0]) * t);
      pixels[idx+1] = Math.round(BG0[1] + (BG1[1] - BG0[1]) * t);
      pixels[idx+2] = Math.round(BG0[2] + (BG1[2] - BG0[2]) * t);
      pixels[idx+3] = 255;
    }
  }
  return encodePng(pixels, w, h);
}

/* ── Encodeur PNG minimal ─────────────────────────────────────────────────── */
function encodePng(rgba, w, h) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=ihdr[11]=ihdr[12]=0;

  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y*(1+w*4)] = 0;
    for (let x = 0; x < w; x++) {
      const si=(y*w+x)*4, di=y*(1+w*4)+1+x*4;
      raw[di]=rgba[si]; raw[di+1]=rgba[si+1]; raw[di+2]=rgba[si+2]; raw[di+3]=rgba[si+3];
    }
  }
  const idat = zlib.deflateSync(raw, {level:6});

  function chunk(type, data) {
    const lb=Buffer.alloc(4); lb.writeUInt32BE(data.length);
    const tb=Buffer.from(type);
    const cb=Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb,data]))>>>0);
    return Buffer.concat([lb,tb,data,cb]);
  }
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);return c^0xFFFFFFFF;}

/* ── Génération ─────────────────────────────────────────────────────────── */
sizes.forEach(size => {
  const png  = makePng(size);
  const file = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ icon-${size}x${size}.png  (${(png.length/1024).toFixed(1)} KB)`);
});
fs.writeFileSync(
  path.join(__dirname,'src','assets','icon','favicon.png'),
  fs.readFileSync(path.join(outDir,'icon-192x192.png'))
);
console.log('✓ favicon.png mis à jour');
console.log('\n✅ Icônes Maïga Consulting (MC) générées !');
