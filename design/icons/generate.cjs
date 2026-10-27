// Generates the icon concepts (SVG files and a preview gallery). Run: node design/icons/generate.cjs
const fs = require('fs');
const path = require('path');

const { buildGirlSvg } = require('./girl.cjs');

const OUT_DIR = __dirname;
const GALLERY_PATH = path.join(__dirname, '..', 'icons-preview.html');

// Plane silhouettes in a 512 box, pointing up-right like the classic messenger mark
const PLANES = {
  classic: (fill, shade) => `
    <path d="M104 250 L390 136 Q414 127 409 152 L360 380 Q354 404 333 392 L262 340 L226 374 Q214 385 213 368
      L218 302 L350 182 L198 286 L116 262 Q92 255 104 250Z" fill="${fill}"/>
    <path d="M218 302 L213 368 Q214 385 226 374 L262 340Z" fill="${shade}"/>`,
  dart: (fill, shade) => `
    <path d="M88 286 L424 104 L292 420 L250 306Z" fill="${fill}"/>
    <path d="M250 306 L424 104 L292 420Z" fill="${shade}"/>`,
  origami: (fill, shade) => `
    <path d="M86 262 L426 112 L232 304Z" fill="${fill}"/>
    <path d="M232 304 L426 112 L330 410Z" fill="${shade}"/>
    <path d="M232 304 L246 392 L286 346Z" fill="${shade}" opacity="0.75"/>`,
  jet: (fill, shade) => `
    <path d="M96 286 L420 118 L336 414 L264 334 L196 368 L220 304Z" fill="${fill}"/>
    <path d="M220 304 L196 368 L264 334Z" fill="${shade}"/>`,
  soft: (fill, shade) => `
    <path d="M128 252 L380 152 L336 360 L266 316 L236 346 L240 296 L338 204 L212 280Z" fill="${fill}"
      stroke="${fill}" stroke-width="44" stroke-linejoin="round"/>
    <path d="M240 296 L236 346 L266 316Z" fill="${shade}"/>`,
};

const PLANE_NAMES = {
  classic: 'классический', dart: 'дротик', origami: 'оригами', jet: 'реактивный', soft: 'скруглённый',
};

const SHAPES = {
  circle: (fill) => `<circle cx="256" cy="256" r="256" fill="${fill}"/>`,
  squircle: (fill) => `<rect width="512" height="512" rx="128" fill="${fill}"/>`,
};

const PLANE_VARIANTS = [
  { id: 1, name: 'Кровь', plane: 'classic', shape: 'circle', bg: '#0E0E10', fill: '#E0283F', shade: '#9A1426' },
  { id: 2, name: 'Клинок', plane: 'dart', shape: 'circle', bg: '#0E0E10', fill: 'url(#red)', shade: '#7A0F20' },
  { id: 3, name: 'Ворон', plane: 'origami', shape: 'circle', bg: '#D41F35', fill: '#141218', shade: '#2A2630' },
  { id: 4, name: 'Инверсия', plane: 'classic', shape: 'circle', bg: '#FFFFFF', fill: '#2A9DF4', shade: '#1B6FB0' },
  { id: 5, name: 'Аврора', plane: 'jet', shape: 'circle', bg: 'url(#aurora)', fill: '#FFFFFF', shade: '#D9D2FF' },
  { id: 6, name: 'Неон', plane: 'origami', shape: 'circle', bg: '#0A0F24', fill: '#00E5FF', shade: '#FF2BD6' },
  { id: 7, name: 'Закат', plane: 'dart', shape: 'circle', bg: 'url(#sunset)', fill: '#FFFFFF', shade: '#FFE1CC' },
  { id: 8, name: 'Графит', plane: 'soft', shape: 'squircle', bg: '#26272B', fill: '#F2F2F5', shade: '#BDBDC6' },
  { id: 9, name: 'Мята', plane: 'jet', shape: 'squircle', bg: '#3DDBB4', fill: '#0F2D2A', shade: '#1E4A44' },
  {
    id: 10,
    name: 'Стекло',
    plane: 'classic',
    shape: 'squircle',
    bg: 'url(#glass)',
    fill: 'rgba(255,255,255,0.92)',
    shade: 'rgba(255,255,255,0.6)',
  },
  { id: 11, name: 'Золото', plane: 'origami', shape: 'circle', bg: '#0E0E10', fill: '#E8C36A', shade: '#A9832E' },
  { id: 12, name: 'Ч/Б', plane: 'dart', shape: 'squircle', bg: '#FFFFFF', fill: '#111111', shade: '#444444' },
];

const BRAND_VARIANTS = [
  { id: 'A', name: 'Винный круг', shape: 'circle', bg: '#2B1320' },
  { id: 'B', name: 'Кремовый круг', shape: 'circle', bg: '#F1E7DA' },
  { id: 'C', name: 'Синий квадрат', shape: 'squircle', bg: '#1C1F33' },
];

const GRADIENTS = `<defs>
  <linearGradient id="red" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#FF4D5E"/><stop offset="1" stop-color="#B3122B"/>
  </linearGradient>
  <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7F5AF0"/><stop offset="0.55" stop-color="#3DA9FC"/><stop offset="1" stop-color="#2CB67D"/>
  </linearGradient>
  <linearGradient id="sunset" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FF6B6B"/><stop offset="0.5" stop-color="#FFB347"/><stop offset="1" stop-color="#C06C84"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#E05FA8"/><stop offset="1" stop-color="#5E6AD2"/>
  </linearGradient>
</defs>`;

function buildPlaneSvg(variant) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${GRADIENTS}
  ${SHAPES[variant.shape](variant.bg)}
  <g transform="translate(-6 10)">${PLANES[variant.plane](variant.fill, variant.shade)}</g>
</svg>`;
}

function buildBrandSvg(variant) {
  const clip = variant.shape === 'circle'
    ? '<circle cx="256" cy="256" r="256"/>'
    : '<rect width="512" height="512" rx="128"/>';
  return buildGirlSvg(`<defs><clipPath id="clip">${clip}</clipPath></defs>${SHAPES[variant.shape](variant.bg)}`);
}

function buildCard(id, name, svg, note) {
  const encoded = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return `<figure class="card">
    <img class="big" src="${encoded}" alt="">
    <div class="sizes">
      <img src="${encoded}" width="48" height="48" alt="">
      <img src="${encoded}" width="32" height="32" alt="">
      <span class="tray"><img src="${encoded}" width="16" height="16" alt=""></span>
    </div>
    <figcaption><b>${id}</b> ${name}${note ? `<span>${note}</span>` : ''}</figcaption>
  </figure>`;
}

function buildGallery() {
  const brandCards = BRAND_VARIANTS.map((variant) => {
    const svg = buildBrandSvg(variant);
    fs.writeFileSync(path.join(OUT_DIR, `brand-${variant.id}.svg`), svg);
    return buildCard(variant.id, variant.name, svg);
  });
  const planeCards = PLANE_VARIANTS.map((variant) => {
    const svg = buildPlaneSvg(variant);
    fs.writeFileSync(path.join(OUT_DIR, `plane-${variant.id}.svg`), svg);
    return buildCard(variant.id, variant.name, svg, `форма: ${PLANE_NAMES[variant.plane]}`);
  });

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Значки Abudjagram</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; --bg: #F4F4F6; --card: #FFFFFF; --text: #16161A; --muted: #6B6B76; }
  @media (prefers-color-scheme: dark) { :root { --bg: #121216; --card: #1D1D23; --text: #EDEDF2; --muted: #9A9AA6; } }
  body { margin: 0; padding: 24px 16px 48px; font-family: "Segoe UI", system-ui, sans-serif;
    background: var(--bg); color: var(--text); }
  h1 { margin: 0 0 4px; font-size: 24px; }
  h2 { margin: 32px 0 12px; font-size: 18px; }
  p { margin: 0; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .card { margin: 0; padding: 16px; border-radius: 16px; background: var(--card);
    display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .big { width: 128px; height: 128px; }
  .sizes { display: flex; gap: 10px; align-items: center; }
  .tray { display: inline-flex; padding: 6px; border-radius: 6px; background: #202020; }
  figcaption { text-align: center; font-size: 14px; }
  figcaption span { display: block; color: var(--muted); font-size: 12px; }
</style></head>
<body>
  <h1>Значки Abudjagram — примеры</h1>
  <p>Под каждым значком — как он выглядит в размерах 48 и 32 px и в трее (16 px на тёмной панели задач).</p>
  <h2>Фирменный значок — по вашему рисунку</h2>
  <div class="grid">${brandCards.join('')}</div>
  <h2>Самолёты — разные формы и цвета</h2>
  <div class="grid">${planeCards.join('')}</div>
</body></html>`;
}

module.exports = { buildPlaneSvg, buildBrandSvg, PLANE_VARIANTS, BRAND_VARIANTS };

if (require.main === module) {
  fs.writeFileSync(GALLERY_PATH, buildGallery());
  console.log(`Gallery written to ${GALLERY_PATH}`);
}
