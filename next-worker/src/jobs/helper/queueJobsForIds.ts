import { JobName } from '..';
import { db } from '../../db';

export async function queueJobForIds(name: JobName, ids: number[], priority = 2) {
  if(ids.length === 0) {
    return;
  }

  const batchSize = 200;
  for(let start = 0; start < ids.length; start += batchSize) {
    await db.job.create({ data: { type: name, data: ids.slice(start, start + batchSize), priority }});
  }
}
