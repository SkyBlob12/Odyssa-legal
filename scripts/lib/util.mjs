import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..', '..'); // racine du repo

export const SITE_URL = 'https://odyssa-app.com';

export function log(...args) {
  console.log('[blog]', ...args);
}

/** Slug propre, sans accents, kebab-case. */
export function slugify(str) {
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 70);
}

/** Échappe le HTML (texte injecté dans le contenu). */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Échappe pour un attribut JSON-LD / JSON inline. */
export function escapeJson(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

/** Remplace tous les {{TOKEN}} d'un template par les valeurs fournies. */
export function fillTemplate(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m
  );
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function readText(path) {
  return readFile(path, 'utf8');
}

export async function writeText(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/**
 * Dimensions d'un WebP, lues dans l'en-tête du fichier (sync, sans décodage).
 * Sert à écrire width/height sur les <img> : sans eux le navigateur ne réserve
 * pas la place de l'image et la page saute au chargement (mauvais score CLS).
 * @returns {{width:number,height:number}|null} null si le fichier est illisible.
 */
export function webpSize(absPath) {
  let buf;
  try {
    buf = readFileSync(absPath);
  } catch {
    return null;
  }
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF') return null;

  switch (buf.toString('ascii', 12, 16)) {
    case 'VP8 ': // lossy
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    case 'VP8L': { // lossless : 14 bits par dimension, empaquetés
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    case 'VP8X': // étendu : 24 bits little-endian par dimension
      return {
        width: buf.readUIntLE(24, 3) + 1,
        height: buf.readUIntLE(27, 3) + 1,
      };
    default:
      return null;
  }
}

/** Attributs `width="…" height="…"` d'une image, ou '' si dimensions inconnues. */
export function sizeAttrs(relPath) {
  const d = webpSize(resolve(ROOT, relPath));
  return d ? ` width="${d.width}" height="${d.height}"` : '';
}

/**
 * Titre de la balise <title>, sous le budget d'affichage de Google.
 *
 * Google tronque autour de 60 caractères : au-delà, la fin du titre est
 * remplacée par « … » et n'est plus lue. La marque n'est donc ajoutée que si
 * elle tient — mieux vaut un titre complet sans marque qu'un titre coupé.
 *
 * @param {string} base   titre de l'article
 * @param {object} opts   limit (60), brand (' | Odyssa')
 */
export function seoTitle(base, { limit = 60, brand = ' | Odyssa' } = {}) {
  const title = String(base || '').trim();
  if (title.length + brand.length <= limit) return title + brand;
  if (title.length > limit) {
    log(`⚠ Titre trop long pour Google (${title.length} > ${limit}) : « ${title} »`);
  }
  return title;
}

/** Temps de lecture estimé (≈200 mots/min). */
export function readingTime(wordCount) {
  return `${Math.max(2, Math.round(wordCount / 200))} min de lecture`;
}

/** Date du jour au format YYYY-MM-DD. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Numéro de semaine ISO, pour nommer les branches/PR. */
export function isoWeekTag(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((date - firstThursday) / 604800000);
  return `${date.getUTCFullYear()}-w${String(week).padStart(2, '0')}`;
}
