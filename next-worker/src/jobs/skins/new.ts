import { Job } from '../job';
import { getCurrentBuild } from '../helper/getCurrentBuild';
import { loadSkins } from '../helper/loadSkins';
import { CURRENT_VERSION } from './migrate';

export const skinsNew: Job = {
  run: async (db, newIds: number[]) => {
    const build = await getCurrentBuild(db);
    const buildId = build.id;

    // load skins from API
    const skins = await loadSkins(newIds);

    for(const { de, en, es, fr } of skins) {
      const revision_de = await db.revision.create({ data: { data: JSON.stringify(de), language: 'de', buildId, description: 'Added to API' } });
      const revision_en = await db.revision.create({ data: { data: JSON.stringify(en), language: 'en', buildId, description: 'Added to API' } });
      const revision_es = await db.revision.create({ data: { data: JSON.stringify(es), language: 'es', buildId, description: 'Added to API' } });
      const revision_fr = await db.revision.create({ data: { data: JSON.stringify(fr), language: 'fr', buildId, description: 'Added to API' } });

      const icon = en.icon?.match(/\/(?<signature>[^\/]*)\/(?<id>[^\/]*)\.png$/)?.groups as { signature: string, id: number } | undefined;

      if(icon) {
        icon.id = Number(icon.id);

        await db.icon.upsert({
          create: icon,
          update: {},
          where: { id: icon.id }
        });
      }

      const unlockedByItemIds = await db.item.findMany({ where: { unlocksSkinIds: { has: en.id } }, select: { id: true }});

      const i = await db.skin.create({ data: {
        id: en.id,
        name_de: de.name,
        name_en: en.name,
        name_es: es.name,
        name_fr: fr.name,
        iconId: icon?.id,
        rarity: en.rarity,
        type: en.type,
        subtype: en.details?.type,
        weight: en.details?.weight_class,
        version: CURRENT_VERSION,
        currentId_de: revision_de.id,
        currentId_en: revision_en.id,
        currentId_es: revision_es.id,
        currentId_fr: revision_fr.id,
        history: { createMany: { data: [{ revisionId: revision_de.id }, { revisionId: revision_en.id }, { revisionId: revision_es.id }, { revisionId: revision_fr.id }]} },
        unlockedByItems: { connect: unlockedByItemIds }
      }});
    }

    return `Added ${skins.length} skins`;
  }
}
