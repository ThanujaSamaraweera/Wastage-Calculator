import { database } from '../db.js';
const pool = await database();
try {
for (const [label, query] of Object.entries({
  periods: `SELECT MIN(trans_date) firstDate, MAX(trans_date) lastDate, COUNT_BIG(*) rows FROM dbo.matltran_all WHERE reason_code IN ('W21','W22','W20','W24','W25','B02') OR trans_type='I'`,
  signs: `SELECT reason_code, wc, trans_type, SIGN(qty) qtySign, COUNT_BIG(*) rows, SUM(qty) qty FROM dbo.matltran_all WHERE (reason_code IN ('W21','W22','W20','W24','W25','B02') OR trans_type='I') AND trans_date >= DATEADD(year,-1,GETDATE()) GROUP BY reason_code,wc,trans_type,SIGN(qty)`,
  items: `SELECT TOP 12 Item,itemdescription,FLV,FLVGroup FROM dbo.BTE_LOTAging WHERE Item LIKE 'PM%'`,
  sites: `SELECT DISTINCT site_ref FROM dbo.matltran_all`
})) { console.log(label, JSON.stringify((await pool.request().query(query)).recordset)); }
} finally { await pool.close(); }
