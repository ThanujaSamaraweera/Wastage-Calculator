import sql from 'mssql';
const env = process.env;
export const config = {
  server: env.ERP_DB_SERVER, user: env.ERP_DB_USER, password: env.ERP_DB_PASSWORD,
  database: env.ERP_DB_DATABASE, connectionTimeout: 15000, requestTimeout: 60000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: env.ERP_DB_ENCRYPT !== 'false', trustServerCertificate: env.ERP_DB_TRUST_CERTIFICATE === 'true' }
};
if (config.server?.includes(',')) { const [host, port] = config.server.split(','); config.server = host; config.port = Number(port); }
if (config.server?.includes('\\')) { const [host, instance] = config.server.split('\\'); config.server = host; config.options.instanceName = instance; }
let pending;
export async function database() {
  if (!pending) pending = new sql.ConnectionPool(config).connect().catch(error => { pending = null; throw error; });
  return pending;
}
export { sql };
