import { Job } from '../job';
import fetch from 'node-fetch';
import { db } from '../../db';

export const SkinsUnlocks: Job = {
  run: async () => {
    const unlockData: { total: number, updatedAt: string, data: Record<string, number> } = await fetch('https://api.gw2efficiency.com/tracking/unlocks?id=skins').then((r) => {
      if(r.status !== 200) {
        throw new Error(`https://api.gw2efficiency.com/tracking/unlocks?id=skins returned ${r.status} ${r.statusText}`);
      }

      return r.json();
    });

    const updates: { id: number, unlocks: number }[] = [];

    for(const [skinIdString, unlocks] of Object.entries(unlockData.data)) {
      const skinId = Number(skinIdString);

      if(skinId.toString() !== skinIdString) {
        continue;
      }

      updates.push({ id: skinId, unlocks: unlocks / unlockData.total });
    }

    // update all skins in a single transaction
    // use `updateMany` to not fail if the skin is missing in the db
    const updated = (
      await db.$transaction(
        updates.map(({ id, unlocks }) => db.skin.updateMany({ where: { id }, data: { unlocks }}))
      )
    ).reduce((total, { count }) => count + total, 0);

    return `Updated ${updated}/${updates.length} skin unlocks from gw2efficiency`;
  }
};
