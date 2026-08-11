/**
 * Régénère les visuels d'app de la landing (assets/*.webp) à partir des captures
 * brutes de l'iPhone (assets/*.PNG, 1170 x 2532).
 *
 * Usage : npm run build:screenshots
 *
 * Pour mettre à jour la landing après une nouvelle version de l'app, il suffit de
 * remplacer les PNG ci-dessous par les nouvelles captures (même nom de fichier)
 * puis de relancer le script.
 */
import sharp from 'sharp';
import { join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'assets');

// Largeur d'affichage max dans la maquette (le <img> de la home est en 720 x 1558).
const WIDTH = 720;

/** base = nom de fichier sans extension, partagé par le PNG source et le WebP produit. */
const SCREENS = [
  { base: 'odyssa-app-mockup', usage: 'hero — liste des voyages' },
  { base: 'screenshot-ia', usage: 'showcase — assistant IA' },
  { base: 'screenshot-itineraire', usage: 'showcase — itinéraire jour par jour' },
  { base: 'screenshot-carte', usage: 'showcase — carte du voyage' },
  { base: 'screenshot-budget', usage: 'showcase — budget partagé' },
  { base: 'screenshot-journal', usage: 'showcase — carnet de voyage' },
  { base: 'screenshot-globe', usage: 'showcase — globe des pays visités' },
];

const kb = (n) => `${Math.round(n / 1024)} ko`;

// Les captures arrivent tantôt en .PNG (iOS), tantôt en .png : on cherche sans tenir
// compte de la casse pour que le script marche aussi sur un système sensible à la casse.
const files = await readdir(ASSETS);
const findSource = (base) => files.find((f) => f.toLowerCase() === `${base.toLowerCase()}.png`);

for (const { base, usage } of SCREENS) {
  const name = findSource(base);
  if (!name) {
    console.warn(`⚠  ${base}.png absent — ${usage} conserve l'ancien visuel`);
    continue;
  }
  const src = join(ASSETS, name);
  const out = join(ASSETS, `${base}.webp`);
  await sharp(src).resize({ width: WIDTH }).webp({ quality: 82, effort: 5 }).toFile(out);
  const { size } = await stat(out);
  console.log(`✓ ${base}.webp (${kb(size)}) — ${usage}`);
}
