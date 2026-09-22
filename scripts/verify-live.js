import assert from 'node:assert/strict';
import { database, sql } from '../db.js';
import { buildReport } from '../public/report.js';
const port = process.env.PORT || 6500;
const metadata=await (await fetch(`http://127.0.0.1:${port}/api/metadata`)).json();
const year=metadata.years[0];
const data=await (await fetch(`http://127.0.0.1:${port}/api/report?year=${year}&refresh=true`)).json();
assert.ok(Array.isArray(data.rows));
const report=buildReport(data.rows,{year});
const pool=await database();
try {
 const result=await pool.request().input('start',sql.DateTime,new Date(Date.UTC(year,0,1))).input('end',sql.DateTime,new Date(Date.UTC(year+1,0,1))).query(`SELECT -SUM(CASE WHEN trans_type='I' THEN qty ELSE 0 END) issued, -SUM(CASE WHEN reason_code IN ('W21','W22','W20','W24','W25','B02') THEN qty ELSE 0 END) waste FROM dbo.matltran_all WHERE trans_date>=@start AND trans_date<@end AND (trans_type='I' OR reason_code IN ('W21','W22','W20','W24','W25','B02'))`);
 const actual=result.recordset[0];
 console.log(JSON.stringify({issuedDifference:report.totals.issued-actual.issued,wasteDifference:report.totals.waste-actual.waste}));
 assert.ok(Math.abs(report.totals.issued-actual.issued)<0.001,'Issued agrees with independent raw-table sum');
 assert.ok(Math.abs(report.totals.waste-actual.waste)<0.001,'Wastage agrees with independent raw-table sum');
 const keys=data.rows.map(r=>`${r.item}|${r.site}|${r.month}`);assert.equal(new Set(keys).size,keys.length,'No duplicated item-site-month rows');
 console.log(JSON.stringify({status:'PASS',year,monthlyRows:data.rows.length,items:report.items.length,missingDescriptions:report.items.filter(i=>i.description==='Description unavailable').length,checks:['Raw-table issued reconciliation','Raw-table wastage reconciliation','No duplicate item-site-month joins']}));
} finally {await pool.close();}
