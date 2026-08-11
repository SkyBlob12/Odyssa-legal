/**
 * Régénère le bloc « À lire aussi » sur tous les articles déjà publiés.
 *
 *   node scripts/rebuild-related.mjs          # écrit les fichiers
 *   node scripts/rebuild-related.mjs --dry    # simule et affiche les stats
 *
 * Point d'entrée manuel uniquement : la même étape tourne automatiquement dans
 * generate-weekly.mjs après chaque publication, pour que les anciens articles
 * puissent pointer vers les nouveaux.
 */
import { log } from './lib/util.mjs';
import { rebuildRelated } from './lib/listings.mjs';
import { RELATED_COUNT } from './lib/related.mjs';

const DRY = process.argv.includes('--dry');

async function main() {
  const { updated, total, min, max, skipped } = await rebuildRelated({ dry: DRY });

  log(`${DRY ? '[dry] ' : ''}${updated} articles mis à jour sur ${total}`);
  log(`Liens entrants par article : min ${min}, max ${max} (${RELATED_COUNT} liens sortants par article)`);
  if (skipped.length) {
    log(`⚠ ${skipped.length} article(s) ignoré(s) :`);
    for (const s of skipped) log(`   - ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
