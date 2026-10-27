// Pixel-art brand mascot, drawn by the project's author. The sprite comes from reference.png through
// import-reference.cjs and is stored in girl-sprite.json.

const sprite = require('./girl-sprite.json');

const CANVAS = 512;
const FILL = 0.92;

function buildGirlSvg(background) {
  const columns = sprite.rows[0].length;
  const rows = sprite.rows.length;
  // A little smaller than the canvas, so the round badge does not cut into the cheeks
  const pixel = Math.floor((CANVAS * FILL) / columns);
  const offsetX = Math.floor((CANVAS - columns * pixel) / 2);
  // Anchored to the bottom, so the shoulders run off the edge of the badge
  const offsetY = CANVAS - rows * pixel;
  const rects = [];
  sprite.rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (key === '.') return;
    rects.push(`<rect x="${offsetX + x * pixel}" y="${offsetY + y * pixel}" width="${pixel}" height="${pixel}" `
      + `fill="${sprite.palette[key]}"/>`);
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" shape-rendering="crispEdges">
  ${background}
  <g clip-path="url(#clip)">${rects.join('')}</g>
</svg>`;
}

module.exports = { buildGirlSvg };
