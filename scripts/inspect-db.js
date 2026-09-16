import { database } from '../db.js';
let pool;
try {
  pool = await database();
  const columns = await pool.request().query(`SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('matltran_all','BTE_LOTAging') ORDER BY TABLE_NAME, ORDINAL_POSITION`);
  console.log(JSON.stringify(columns.recordset, null, 2));
} catch (e) { console.error('Database inspection failed:', e.code, e.originalError?.code || '', e.message.replaceAll(process.env.ERP_DB_SERVER || '___', '[server]').replaceAll(process.env.ERP_DB_DATABASE || '___', '[database]')); process.exitCode = 1; }
finally { if (pool) await pool.close(); }
