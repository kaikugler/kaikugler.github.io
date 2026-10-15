#!/usr/bin/env node
// Erzeugt bg.svg: WordNet-Ausschnitt als 3D-Graph (Perspektive: vorne größer und heller, hinten kleiner und grauer).
// Aufruf: node tools/make_bg.js public/bg.svg
// Layout ist deterministisch (fester Startwert); SEED, AY, AX wurden so gewählt, dass sich Beschriftungen kaum überlappen.
const fs = require('fs');

//const SEED = 4, AY = 0.9, AX = -0.25, D = 3.5;
//const W = 800, H = 760, CX = 420, CY = 530, SX = 330, SY = 310;

const SEED = 36, AY = 1.3, AX = -0.2, D = 3.5;
const W = 520, H = 640, CX = 260, CY = 320, SX = 245, SY = 245;   // portrait box

const words = ['entity','abstraction','communication','change','shift','drift','language','text','sign','symbol',
  'writing','speech','vocabulary','lexicon','word','noun','verb','term','name','phrase','synonym','homonym',
  'sense','meaning','context','semantics','gloss','usage','corpus'];
const edges = [['entity','abstraction'],['abstraction','communication'],['abstraction','change'],['change','shift'],
  ['change','drift'],['communication','language'],['communication','text'],['communication','sign'],
  ['sign','symbol'],['text','writing'],['text','corpus'],['communication','speech'],['language','vocabulary'],
  ['vocabulary','lexicon'],['language','word'],['word','noun'],['word','verb'],['word','term'],['word','name'],
  ['word','phrase'],['word','synonym'],['word','homonym'],['word','sense'],['sense','meaning'],
  ['meaning','context'],['meaning','semantics'],['meaning','gloss'],['meaning','usage'],['drift','meaning'],
  ['shift','sense']];

const n = words.length;
const idx = Object.fromEntries(words.map((w, i) => [w, i]));
const E = edges.map(([a, b]) => [idx[a], idx[b]]);

let seed = SEED;
function rnd() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// Kräftemodell in 3D
const P = words.map(() => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
for (let it = 0; it < 500; it++) {
  const F = P.map(() => [0, 0, 0]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d3 = [0, 1, 2].map(k => P[i][k] - P[j][k]);
    const d2 = d3[0] ** 2 + d3[1] ** 2 + d3[2] ** 2 + 0.01, d = Math.sqrt(d2);
    const f = 0.22 / d2 + (d < 0.45 ? (0.45 - d) * 1.2 : 0);
    for (let k = 0; k < 3; k++) { F[i][k] += d3[k] / d * f; F[j][k] -= d3[k] / d * f; }
  }
  for (const [a, b] of E) {
    const e3 = [0, 1, 2].map(k => P[b][k] - P[a][k]);
    const d = Math.hypot(...e3) + 1e-6, f = 0.1 * (d - 0.8);
    for (let k = 0; k < 3; k++) { F[a][k] += e3[k] / d * f; F[b][k] -= e3[k] / d * f; }
  }
  const s = 0.5 * (1 - it / 500) + 0.05;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const step = (F[i][k] - P[i][k] * 0.012) * s;
    P[i][k] += Math.max(-0.1, Math.min(0.1, step));
  }
}

// zentrieren, normieren, Mitte etwas auflockern
const c = [0, 1, 2].map(k => P.reduce((s, p) => s + p[k], 0) / n);
P.forEach(p => { for (let k = 0; k < 3; k++) p[k] -= c[k]; });
const maxR = Math.max(...P.map(p => Math.hypot(...p)));
P.forEach(p => {
  const r = Math.hypot(...p) / maxR + 1e-6, nr = 0.55 + 0.45 * r;
  for (let k = 0; k < 3; k++) p[k] = p[k] / maxR / r * nr;
});

// drehen und perspektivisch projizieren (z größer = weiter hinten)
const cy = Math.cos(AY), sy = Math.sin(AY), cx = Math.cos(AX), sx = Math.sin(AX);
const Q = P.map((p, i) => {
  const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
  const y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
  const sc = D / (D + z2);
  return { w: words[i], X: CX - y2 * sc * SX, Y: CY + x1 * sc * SY, z: z2, sc, t: (1 - z2) / 2 };
  // return { w: words[i], X: CX + x1 * sc * SX, Y: CY + y2 * sc * SY, z: z2, sc, t: (1 - z2) / 2 };
});

const far = [169, 169, 169], near = [144, 238, 144];   // hellgrau -> hellgrün
const mix = t => 'rgb(' + far.map((v, m) => Math.round(v + (near[m] - v) * t)).join(',') + ')';
const f1 = v => v.toFixed(1);

const DIM = 0.6;   // overall dimming, baked in so that hover can lift a node to full opacity
let body = '';
E.map(([a, b]) => [Q[a], Q[b]])
  .sort((a, b) => (b[0].z + b[1].z) - (a[0].z + a[1].z))
  .forEach(([a, b]) => {
    const t = (a.t + b.t) / 2, sc = (a.sc + b.sc) / 2;
    body += `  <line data-n="${a.w} ${b.w}" x1="${f1(a.X)}" y1="${f1(a.Y)}" x2="${f1(b.X)}" y2="${f1(b.Y)}" stroke="#c0c0c0" stroke-width="${(0.9 * sc).toFixed(2)}" stroke-opacity="${(DIM * (0.12 + 0.5 * t)).toFixed(2)}"/>\n`;
  });
[...Q].sort((a, b) => b.z - a.z).forEach(q => {
  const r = 3.5 * q.sc, col = mix(q.t);
  body += `  <g class="node" data-w="${q.w}" opacity="${(DIM * (0.25 + 0.75 * q.t)).toFixed(2)}" fill="${col}">\n` +
    `    <circle class="hit" cx="${f1(q.X)}" cy="${f1(q.Y)}" r="${Math.max(14, r + 8).toFixed(1)}"/>\n` +
    `    <circle cx="${f1(q.X)}" cy="${f1(q.Y)}" r="${r.toFixed(2)}"/>\n` +
    `    <text x="${f1(q.X)}" y="${f1(q.Y - r - 5)}" font-size="${(13 * q.sc).toFixed(1)}" text-anchor="middle" stroke="#000" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${q.w}</text>\n  </g>\n`;
});

// Hover: only nodes take pointer events; the hovered node lights up and its edges are highlighted.
const edgeRules = words.map(w =>
  `.wordnet:has(.node[data-w="${w}"]:hover) line[data-n~="${w}"]{stroke:#90ee90;stroke-opacity:.9}`).join('\n');
const style = `<style>
.wordnet{pointer-events:none}
.wordnet .node{pointer-events:auto;cursor:default}
.wordnet .hit{fill:none;pointer-events:all}
.wordnet .node circle:not(.hit){transform-box:fill-box;transform-origin:center;transition:transform .15s,fill .15s}
.wordnet .node text{transition:fill .15s}
.wordnet .node:hover{opacity:1}
.wordnet .node:hover circle:not(.hit){transform:scale(1.8);fill:#d8ffd8}
.wordnet .node:hover text{fill:#d8ffd8}
.wordnet line{transition:stroke .15s,stroke-opacity .15s}
${edgeRules}
@media (prefers-reduced-motion:reduce){.wordnet *{transition:none!important}}
</style>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg class="wordnet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMax meet" width="${W}" height="${H}" font-family="Courier New, Courier, monospace" aria-hidden="true" focusable="false">
  <title>Excerpt from WordNet: words and their relations</title>
${style}
${body}</svg>
`;
const out = process.argv[2] || 'bg.svg';
fs.writeFileSync(out, svg);
console.log('geschrieben:', out);
