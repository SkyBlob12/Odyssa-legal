import { join } from 'node:path';
import { escapeHtml, readText, writeText, readJson, sizeAttrs, ROOT, SITE_URL } from './util.mjs';

function replaceBetween(content, startMarker, endMarker, inner) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(`Marqueurs introuvables : ${startMarker}`);
  }
  return content.slice(0, start + startMarker.length) + '\n' + inner + '\n        ' + content.slice(end);
}

function destCard(d, { hrefBase, photoPrefix }) {
  const photo = d.cover
    ? `<div class="blog-card-photo"><img src="${photoPrefix}${escapeHtml(d.cover)}" alt="${escapeHtml(d.title)}"${sizeAttrs(d.cover)} loading="lazy" decoding="async"></div>`
    : `<div class="blog-card-photo">${escapeHtml(d.tag || d.title)}</div>`;
  return `        <a href="${hrefBase}${d.slug}/" class="blog-card">
          ${photo}
          <div class="blog-card-body">
            <span class="blog-card-tag">${escapeHtml(d.tag || 'Destination')}</span>
            <h3>${escapeHtml(d.title)}</h3>
            <p>${escapeHtml(d.excerpt)}</p>
            <div class="blog-card-meta">
              <span>${escapeHtml(d.readingTime)}</span>
              <span class="blog-card-arrow">Lire →</span>
            </div>
          </div>
        </a>`;
}

function tipCard(t, { hrefBase, photoPrefix }) {
  const photo = t.cover
    ? `<div class="blog-card-photo"><img src="${photoPrefix}${escapeHtml(t.cover)}" alt="${escapeHtml(t.title)}"${sizeAttrs(t.cover)} loading="lazy" decoding="async"></div>`
    : `<div class="blog-card-photo">${escapeHtml(t.tag)}</div>`;
  return `        <a href="${hrefBase}${t.slug}/" class="blog-card">
          ${photo}
          <div class="blog-card-body">
            <span class="blog-card-tag ${t.tagClass || ''}">${escapeHtml(t.tag)}</span>
            <h3>${escapeHtml(t.title)}</h3>
            <p>${escapeHtml(t.excerpt)}</p>
            <div class="blog-card-meta">
              <span>${escapeHtml(t.readingTime)}</span>
              <span class="blog-card-arrow">Lire →</span>
            </div>
          </div>
        </a>`;
}

function homeCard(a) {
  const photo = a.cover
    ? `<img src="${escapeHtml(a.cover)}" alt="${escapeHtml(a.title)}"${sizeAttrs(a.cover)} loading="lazy" decoding="async">`
    : '';
  return `        <a href="${a.href}" class="home-blog-card">
          <div class="home-blog-card-photo">${photo}
            <span class="home-blog-card-tag">${escapeHtml(a.tag)}</span>
          </div>
          <div class="home-blog-card-body">
            <h3>${escapeHtml(a.title)}</h3>
            <p>${escapeHtml(a.excerpt)}</p>
            <span class="home-blog-card-meta">${escapeHtml(a.readingTime)}</span>
          </div>
        </a>`;
}

const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

/**
 * Arrondit un compteur vers le bas pour l'afficher en « + de N » : la home n'a
 * plus besoin d'être mise à jour à chaque publication.
 * Sous le premier palier, on garde la valeur exacte (« + de 0 » n'a aucun sens).
 */
function roundedStat(n) {
  const step = n >= 100 ? 50 : n >= 50 ? 25 : n >= 20 ? 10 : 5;
  const count = Math.floor(n / step) * step;
  return count >= step ? { count, prefix: '+ de ' } : { count: n, prefix: '' };
}

/** Régénère les grilles de cartes dans les pages de listing. */
export async function rebuildListings() {
  const destinations = (await readJson(join(ROOT, 'data/destinations.json'))).sort(byDateDesc);
  const tips = (await readJson(join(ROOT, 'data/tips.json'))).sort(byDateDesc);

  // --- blog/index.html : section Destinations (limitée à 6) + section Conseils (limitée à 6) ---
  const blogIndexPath = join(ROOT, 'blog/index.html');
  let blogIndex = await readText(blogIndexPath);
  blogIndex = replaceBetween(
    blogIndex,
    '<!-- AUTO:DEST_CARDS:START -->',
    '<!-- AUTO:DEST_CARDS:END -->',
    destinations.slice(0, 6).map((d) => destCard(d, { hrefBase: 'destinations/', photoPrefix: '../' })).join('\n\n')
  );
  blogIndex = replaceBetween(
    blogIndex,
    '<!-- AUTO:TIPS_CARDS:START -->',
    '<!-- AUTO:TIPS_CARDS:END -->',
    tips.slice(0, 6).map((t) => tipCard(t, { hrefBase: '', photoPrefix: '../' })).join('\n\n')
  );
  await writeText(blogIndexPath, blogIndex);

  // --- blog/destinations/index.html : toutes les destinations ---
  const destIndexPath = join(ROOT, 'blog/destinations/index.html');
  let destIndex = await readText(destIndexPath);
  destIndex = replaceBetween(
    destIndex,
    '<!-- AUTO:DEST_CARDS:START -->',
    '<!-- AUTO:DEST_CARDS:END -->',
    destinations.map((d) => destCard(d, { hrefBase: '', photoPrefix: '../../' })).join('\n\n')
  );
  await writeText(destIndexPath, destIndex);

  // --- blog/conseils/index.html : tous les conseils ---
  const conseilsIndexPath = join(ROOT, 'blog/conseils/index.html');
  let conseilsIndex = await readText(conseilsIndexPath);
  conseilsIndex = replaceBetween(
    conseilsIndex,
    '<!-- AUTO:TIPS_CARDS:START -->',
    '<!-- AUTO:TIPS_CARDS:END -->',
    tips.map((t) => tipCard(t, { hrefBase: '../', photoPrefix: '../../' })).join('\n\n')
  );
  await writeText(conseilsIndexPath, conseilsIndex);

  // --- index.html : 3 destinations + 3 conseils, mélangés du plus récent au plus ancien ---
  // (on réserve des places aux deux catégories pour que la home ne se retrouve jamais 100 % conseils)
  const latest = [
    ...destinations.slice(0, 3).map((d) => ({ ...d, href: `blog/destinations/${d.slug}/`, tag: d.tag || 'Destination' })),
    ...tips.slice(0, 3).map((t) => ({ ...t, href: `blog/${t.slug}/` })),
  ].sort(byDateDesc);

  const homePath = join(ROOT, 'index.html');
  let home = await readText(homePath);
  home = replaceBetween(
    home,
    '<!-- AUTO:HOME_BLOG_CARDS:START -->',
    '<!-- AUTO:HOME_BLOG_CARDS:END -->',
    latest.map(homeCard).join('\n\n')
  );

  // Bandeau défilant des destinations — la liste est dupliquée pour boucler sans couture
  const marqueeItems = destinations.map(
    (d) => `          <a href="blog/destinations/${d.slug}/" class="destband-item">${escapeHtml(d.tag || d.title)}</a>`
  );
  const marquee = [
    ...marqueeItems,
    ...destinations.map(
      (d) => `          <a href="blog/destinations/${d.slug}/" class="destband-item" aria-hidden="true" tabindex="-1">${escapeHtml(d.tag || d.title)}</a>`
    ),
  ].join('\n');
  home = replaceBetween(home, '<!-- AUTO:DEST_MARQUEE:START -->', '<!-- AUTO:DEST_MARQUEE:END -->', marquee);

  // Compteurs animés du bloc blog — valeurs arrondies vers le bas (« + de 30 »)
  const stats = [
    { value: destinations.length + tips.length, label: 'articles publiés' },
    { value: destinations.length, label: 'destinations décryptées' },
  ]
    .map(({ value, label }) => {
      const { count, prefix } = roundedStat(value);
      const prefixHtml = prefix ? `<span class="home-blog-stats-prefix">${prefix}</span>` : '';
      return `            <li><strong>${prefixHtml}<span data-count-to="${count}">0</span></strong><span>${escapeHtml(label)}</span></li>`;
    })
    .join('\n');
  home = replaceBetween(home, '<!-- AUTO:HOME_BLOG_STATS:START -->', '<!-- AUTO:HOME_BLOG_STATS:END -->', stats);

  await writeText(homePath, home);
}

/** Régénère sitemap.xml à partir des pages statiques + registres. */
export async function rebuildSitemap() {
  const destinations = await readJson(join(ROOT, 'data/destinations.json'));
  const tips = await readJson(join(ROOT, 'data/tips.json'));

  // <lastmod> n'est utile que s'il est honnête : on ne le met que là où on
  // connaît une vraie date de publication. Un lastmod toujours à « aujourd'hui »
  // est ignoré par Google.
  const url = (loc, changefreq, priority, lastmod) =>
    `  <url>\n    <loc>${loc}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
    `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const latest = (list) =>
    list.map((i) => i.date).filter(Boolean).sort().pop();
  const latestDest = latest(destinations);
  const latestTip = latest(tips);
  const latestAny = [latestDest, latestTip].filter(Boolean).sort().pop();

  const entries = [
    url(`${SITE_URL}/`, 'weekly', '1.0', latestAny),
    url(`${SITE_URL}/blog/`, 'weekly', '0.8', latestAny),
    url(`${SITE_URL}/blog/destinations/`, 'weekly', '0.8', latestDest),
    url(`${SITE_URL}/blog/conseils/`, 'weekly', '0.8', latestTip),
    ...destinations.map((d) => url(`${SITE_URL}/blog/destinations/${d.slug}/`, 'monthly', '0.7', d.date)),
    ...tips.map((t) => url(`${SITE_URL}/blog/${t.slug}/`, 'monthly', '0.7', t.date)),
    url(`${SITE_URL}/about/`, 'monthly', '0.6'),
    url(`${SITE_URL}/support/`, 'monthly', '0.5'),
    url(`${SITE_URL}/privacy-policy/`, 'yearly', '0.3'),
    url(`${SITE_URL}/terms-of-service/`, 'yearly', '0.3'),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  await writeText(join(ROOT, 'sitemap.xml'), xml);
}
