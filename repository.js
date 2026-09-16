import { database, sql } from './db.js';
export const inclusion = `(reason_code IN ('W21','W22','W20','W24','W25','B02') OR trans_type = 'I')`;
let metadataCache;
const cache = new Map();
const inFlight = new Map();
export async function metadata() {
  if (metadataCache && Date.now() - metadataCache.time < 300000) return metadataCache.data;
  const pool = await database();
  const result = await pool.request().query(`SELECT DISTINCT YEAR(trans_date) AS year FROM dbo.matltran_all WHERE ${inclusion} AND trans_date IS NOT NULL ORDER BY year DESC; SELECT DISTINCT RTRIM(site_ref) AS site FROM dbo.matltran_all ORDER BY site;`);
  const data = {years: result.recordsets[0].map(r=>r.year), sites: result.recordsets[1].map(r=>r.site)};
  metadataCache = {time: Date.now(), data}; return data;
}
export async function yearlyRows(year, refresh = false) {
  if (!refresh && cache.has(year) && Date.now() - cache.get(year).time < 300000) return cache.get(year);
  if (inFlight.has(year)) return inFlight.get(year);
  const request = (async () => {
    const pool = await database();
    const result = await pool.request().input('start', sql.DateTime, new Date(Date.UTC(year,0,1))).input('end', sql.DateTime, new Date(Date.UTC(year+1,0,1))).query(`
      WITH monthly AS (
        SELECT RTRIM(item) AS item, RTRIM(site_ref) AS site, MONTH(trans_date) AS month,
          -SUM(CASE WHEN trans_type='I' THEN qty ELSE 0 END) AS issued,
          -SUM(CASE WHEN reason_code IN ('W21','W22','W20','W24','W25','B02') THEN qty ELSE 0 END) AS waste,
          COUNT_BIG(*) AS transactions
        FROM dbo.matltran_all
        WHERE trans_date >= @start AND trans_date < @end AND ${inclusion}
        GROUP BY RTRIM(item), RTRIM(site_ref), MONTH(trans_date)
      ), descriptions AS (
        SELECT RTRIM(Item) AS item, MAX(NULLIF(RTRIM(itemdescription),'')) AS description,
          MAX(NULLIF(RTRIM(FLVGroup),'')) AS flvGroup
        FROM dbo.BTE_LOTAging WHERE Item IN (SELECT item FROM monthly) GROUP BY RTRIM(Item)
      )
      SELECT m.*, d.description, d.flvGroup FROM monthly m LEFT JOIN descriptions d ON d.item=m.item
      ORDER BY m.item, m.month;`);
    const entry = {rows: result.recordset, time: Date.now()}; cache.set(year, entry);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return entry;
  })();
  inFlight.set(year, request);
  try { return await request; } finally { inFlight.delete(year); }
}
