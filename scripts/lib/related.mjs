/**
 * Sélection des articles « À lire aussi ».
 *
 * L'ancienne règle (les 2 conseils les plus récents) concentrait tous les liens
 * internes sur les deux derniers articles publiés : le reste du blog se
 * retrouvait à 2 liens entrants, trop peu pour que Google dépense du budget de
 * crawl dessus. On choisit désormais par proximité thématique, avec une pénalité
 * sur les cibles déjà très liées pour que chaque article reçoive sa part.
 */

export const RELATED_COUNT = 6;

// Poids du rééquilibrage : plus il est haut, plus les liens sont répartis
// uniformément au détriment de la pertinence thématique.
const SPREAD = 0.6;

const STOPWORDS = new Set([
  'avec', 'sans', 'pour', 'dans', 'chez', 'vers', 'depuis', 'entre', 'entiere',
  'votre', 'vos', 'nos', 'notre', 'leur', 'leurs', 'cette', 'cet', 'ces', 'les',
  'des', 'une', 'aux', 'que', 'qui', 'quoi', 'dont', 'plus', 'moins', 'tout',
  'tous', 'toute', 'toutes', 'meme', 'aussi', 'ainsi', 'donc', 'mais', 'car',
  'faire', 'fait', 'etre', 'avoir', 'peut', 'sur', 'par', 'est', 'son', 'sa',
  'ses', 'comment', 'pourquoi', 'quand', 'guide', 'complet', 'conseils',
  'astuces', 'pratiques', 'idees', 'top', 'les', 'ultime', 'reussi', 'reussie',
  'bien', 'mieux', 'tres', 'petit', 'grand', 'nouveau', 'voyage', 'voyages',
  'voyager', 'partir', 'vacances',
]);

// Diacritiques combinants laissés par la décomposition NFD (accents français).
const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Minuscules, accents retirés. */
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
}

function tokenize(str) {
  return new Set(
    normalize(str)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}

/** Représentation commune aux conseils et aux destinations. */
function toNode(entry, type) {
  return {
    type,
    slug: entry.slug,
    title: entry.title,
    tag: normalize(entry.tag),
    country: normalize(entry.country || ''),
    date: String(entry.date || ''),
    tokens: tokenize(`${entry.title} ${entry.excerpt || ''} ${entry.tag || ''}`),
    key: `${type}:${entry.slug}`,
  };
}

/** Score de proximité entre deux articles. */
function affinity(a, b) {
  let shared = 0;
  for (const t of a.tokens) if (b.tokens.has(t)) shared += 1;

  let score = shared * 2;
  if (a.tag && a.tag === b.tag) score += 3;
  if (a.country && a.country === b.country) score += 2;
  // Un lien conseil ↔ destination relie les deux silos du blog : les
  // destinations sont sinon accessibles uniquement via leur propre listing.
  if (a.type !== b.type) score += 1.5;
  return score;
}

/**
 * Construit la table des articles liés pour tout le blog.
 *
 * @returns {Map<string, Array<{type: string, slug: string, title: string}>>}
 *          clé « tip:<slug> » ou « destination:<slug> ».
 */
export function buildRelatedMap({ destinations = [], tips = [], count = RELATED_COUNT } = {}) {
  const nodes = [
    ...destinations.map((d) => toNode(d, 'destination')),
    ...tips.map((t) => toNode(t, 'tip')),
  ];

  const inbound = new Map(nodes.map((n) => [n.key, 0]));
  const result = new Map();

  // Ordre stable (du plus ancien au plus récent) : le résultat ne dépend pas de
  // l'ordre des registres, et les articles anciens se servent en premier.
  const sources = nodes.slice().sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));

  for (const src of sources) {
    const ranked = nodes
      .filter((n) => n.key !== src.key)
      .map((n) => ({ node: n, base: affinity(src, n) }))
      .sort((x, y) => {
        const sx = x.base - SPREAD * inbound.get(x.node.key);
        const sy = y.base - SPREAD * inbound.get(y.node.key);
        return sy - sx || y.node.date.localeCompare(x.node.date);
      });

    const picked = [];
    // On réserve une place à l'autre silo pour ne jamais isoler les destinations.
    const otherType = ranked.find((r) => r.node.type !== src.type);
    if (otherType) picked.push(otherType.node);
    for (const r of ranked) {
      if (picked.length >= count) break;
      if (!picked.includes(r.node)) picked.push(r.node);
    }

    for (const n of picked) inbound.set(n.key, inbound.get(n.key) + 1);
    result.set(src.key, picked.map((n) => ({ type: n.type, slug: n.slug, title: n.title })));
  }

  return result;
}

/** Statistiques de maillage, pour vérifier qu'aucun article n'est orphelin. */
export function inboundStats(relatedMap) {
  const counts = new Map();
  for (const items of relatedMap.values()) {
    for (const it of items) {
      const k = `${it.type}:${it.slug}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  for (const key of relatedMap.keys()) if (!counts.has(key)) counts.set(key, 0);
  const values = [...counts.values()].sort((a, b) => a - b);
  return { counts, min: values[0] ?? 0, max: values[values.length - 1] ?? 0 };
}
