// Turns the gridded pixel-art drawing (reference.png) into the mascot sprite (girl-sprite.json):
// finds the grid, samples every cell, removes the paper background and merges near-identical colors.
// Run with Electron, which decodes the image: npx electron design/icons/import-reference.cjs
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'reference.png');
const OUTPUT = path.join(__dirname, 'girl-sprite.json');
const MIN_CELL = 8.5;
const MAX_CELL = 10.5;
// Colors closer than this (RGB distance) are merged; screenshots blend neighbouring cells slightly
const MERGE_DISTANCE = 22;
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

app.whenReady().then(() => {
  const image = nativeImage.createFromPath(INPUT);
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap(); // BGRA
  const pixel = (x, y) => {
    const i = (y * width + x) * 4;
    return [bitmap[i + 2], bitmap[i + 1], bitmap[i]];
  };
  const lum = (x, y) => {
    const [r, g, b] = pixel(x, y);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  const { columns, rows } = findGrid(width, height, lum);
  const cells = sampleCells(width, height, pixel, columns, rows);
  removeBackground(cells);
  const sprite = buildSprite(cells);

  fs.writeFileSync(OUTPUT, `${JSON.stringify(sprite, undefined, 1)}\n`);
  console.log(`${sprite.rows[0].length}×${sprite.rows.length} cells, ${Object.keys(sprite.palette).length} colors`);
  app.quit();
});

// Grid lines leave regular edges; the period and phase with the strongest edges on them win
function findGrid(width, height, lum) {
  const columnEdges = new Array(width).fill(0);
  const rowEdges = new Array(height).fill(0);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      columnEdges[x] += Math.abs(lum(x, y) - lum(x - 1, y));
      rowEdges[y] += Math.abs(lum(x, y) - lum(x, y - 1));
    }
  }
  return { columns: findPeriod(columnEdges), rows: findPeriod(rowEdges) };
}

function findPeriod(signal) {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  let best = { period: 0, phase: 0, score: -Infinity };
  for (let period = MIN_CELL; period <= MAX_CELL; period += 0.01) {
    for (let phase = 0; phase < period; phase += 0.1) {
      let onLine = 0;
      let count = 0;
      for (let k = phase; k < signal.length; k += period) {
        onLine += signal[Math.round(k)] || 0;
        count++;
      }
      const score = onLine / count - mean;
      if (score > best.score) best = { period, phase, score };
    }
  }
  return best;
}

function sampleCells(width, height, pixel, columns, rows) {
  const cells = [];
  for (let top = rows.phase - rows.period; top < height; top += rows.period) {
    if (top < 0 || top + rows.period > height) continue;
    const row = [];
    for (let left = columns.phase - columns.period; left < width; left += columns.period) {
      if (left < 0 || left + columns.period > width) continue;
      // The middle of the cell, away from the grid lines; the median resists anti-aliasing
      const insetX = columns.period * 0.3;
      const insetY = rows.period * 0.3;
      const samples = [];
      for (let y = Math.ceil(top + insetY); y < top + rows.period - insetY; y++) {
        for (let x = Math.ceil(left + insetX); x < left + columns.period - insetX; x++) samples.push(pixel(x, y));
      }
      row.push([0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]));
    }
    cells.push(row);
  }
  return cells;
}

// The paper background is the light, unsaturated area connected to the image border
function removeBackground(cells) {
  const isPaper = (color) => {
    const [r, g, b] = color;
    return r > 200 && g > 190 && b > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
  };
  const stack = [];
  cells.forEach((row, y) => row.forEach((color, x) => {
    const isBorder = y === 0 || x === 0 || y === cells.length - 1 || x === row.length - 1;
    if (isBorder && color && isPaper(color)) stack.push([x, y]);
  }));
  while (stack.length) {
    const [x, y] = stack.pop();
    const color = cells[y] && cells[y][x];
    if (!color || !isPaper(color)) continue;
    cells[y][x] = undefined;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

// Greedy merge of near colors, most frequent first, then one key per color
function buildSprite(cells) {
  const counts = new Map();
  cells.flat().filter(Boolean).forEach((color) => {
    const hex = toHex(color);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  });

  const centers = [];
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([hex]) => {
    const color = fromHex(hex);
    if (!centers.some((center) => distance(center, color) < MERGE_DISTANCE)) centers.push(color);
  });
  if (centers.length > KEYS.length) throw new Error(`Too many colors: ${centers.length}`);

  const palette = {};
  centers.forEach((center, i) => {
    palette[KEYS[i]] = toHex(center);
  });
  const rows = cells.map((row) => row.map((color) => {
    if (!color) return '.';
    let bestIndex = 0;
    centers.forEach((center, i) => {
      if (distance(center, color) < distance(centers[bestIndex], color)) bestIndex = i;
    });
    return KEYS[bestIndex];
  }).join(''));

  return { palette, rows };
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toHex(color) {
  return `#${color.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function fromHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
