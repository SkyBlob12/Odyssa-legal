/**
 * Sélection des « À lire aussi » par proximité thématique.
 *
 * L'ancienne logique prenait les articles les plus RÉCENTS : tout le site
 * pointait vers les deux mêmes pages, sans rapport de sujet. Ici on classe les
 * candidats par similarité (tag + vocabulaire du titre et de l'extrait), ce qui
 * regroupe les articles en clusters thématiques et répartit le maillage.
 */

/** Mots trop fréquents pour porter du sens — ignorés dans le calcul. */
const STOPWORDS = new Set([
  'avec', 'sans', 'pour', 'dans', 'vous', 'votre', 'vos', 'nos', 'notre', 'plus',
  'tout', 'tous', 'toute', 'toutes', 'faire', 'bien', 'comment', 'quoi', 'quand',
  'cette', 'celui', 'leur', 'leurs', 'entre', 'aussi', 'meme', 'meilleurs',
  'meilleures', 'meilleur', 'meilleure', 'guide', 'complet', 'conseils', 'conseil',
  'astuces', 'astuce', 'idees', 'idee', 'etre', 'avoir', 'peut', 'faut', 'sont',
  'est', 'les', 'des', 'une', 'que', 'qui', 'sur', 'par', 'aux', 'ses', 'son',
  'pas', 'ces', 'ceux', 'chez', 'dont', 'ou', 'et', 'a', 'de', 'du', 'le', 'la',
]);

/** Minuscules sans accents : « Bien-être » et « bien etre » doivent matcher. */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function tokenize(str) {
  return normalize(str)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Transforme les registres en corpus commun, indexé pour le scoring. */
export function buildCorpus({ destinations = [], tips = [] }) {
  const entry = (item, type) => ({
    type,
    slug: item.slug,
    title: item.title,
    tag: item.tag || '',
    date: item.date || '',
    titleTokens: new Set(tokenize(item.title)),
    bodyTokens: new Set(tokenize(item.excerpt)),
    tagKey: normalize(item.tag),
  });

  return [
    ...destinations.map((d) => entry(d, 'destination')),
    ...tips.map((t) => entry(t, 'tip')),
  ];
}

function overlap(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * Score de proximité entre deux entrées du corpus.
 * Le titre pèse plus que l'extrait : c'est lui qui porte le sujet réel.
 */
function score(a, b) {
  let s = 0;
  if (a.tagKey && a.tagKey === b.tagKey) s += 5;
  s += 3 * overlap(a.titleTokens, b.titleTokens);
  s += 2 * overlap(a.titleTokens, b.bodyTokens);
  s += 2 * overlap(a.bodyTokens, b.titleTokens);
  s += 1 * overlap(a.bodyTokens, b.bodyTokens);
  return s;
}

/**
 * Choisit les articles à mettre en « À lire aussi ».
 *
 * On garantit au moins un lien vers l'autre famille (destination ↔ conseil)
 * pour que les deux clusters restent connectés, sinon les destinations et les
 * conseils formeraient deux îlots séparés.
 *
 * @param {string} slug   article courant (exclu des résultats)
 * @param {Array}  corpus sortie de buildCorpus()
 * @param {number} limit  nombre de liens souhaité (3 à 5 recommandé)
 * @returns {Array<{type:string, slug:string, title:string}>}
 */
export function pickRelated(slug, corpus, { limit = 4 } = {}) {
  const self = corpus.find((e) => e.slug === slug);
  if (!self) return [];

  const ranked = corpus
    .filter((e) => e.slug !== slug)
    .map((e) => ({ e, s: score(self, e) }))
    // Tri déterministe : score, puis date récente, puis slug — pour que deux
    // exécutions produisent le même HTML (diffs git propres).
    .sort((x, y) => y.s - x.s || String(y.e.date).localeCompare(x.e.date) || x.e.slug.localeCompare(y.e.slug));

  const chosen = ranked.slice(0, limit).map((r) => r.e);

  // Garantit la passerelle entre les deux familles d'articles.
  if (chosen.length === limit && !chosen.some((e) => e.type !== self.type)) {
    const bridge = ranked.find((r) => r.e.type !== self.type);
    if (bridge) chosen[limit - 1] = bridge.e;
  }

  return chosen.map((e) => ({ type: e.type, slug: e.slug, title: e.title }));
}
