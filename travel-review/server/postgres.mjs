import pg from 'pg';
import fs from 'node:fs';

export function postgresOptions(env=process.env){
  if(!env.DATABASE_URL)throw new Error('尚未設定 DATABASE_URL。正式線上版需要 Supabase PostgreSQL 連線；本機驗證請執行 npm run demo。');
  let url;
  try{url=new URL(env.DATABASE_URL);}catch{throw new Error('DATABASE_URL 格式錯誤，請使用 Supabase 的 PostgreSQL 連線網址。');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname)throw new Error('DATABASE_URL 必須是 PostgreSQL 連線網址。');
  if(env.DATABASE_PASSWORD)url.password=encodeURIComponent(env.DATABASE_PASSWORD);
  if(/YOUR-(?:DATABASE-)?PASSWORD/.test(url.password)&&!env.DATABASE_PASSWORD)throw new Error('請在主機設定 DATABASE_PASSWORD，或使用已填妥密碼的 DATABASE_URL。');
  // Control TLS explicitly; connection-string SSL options must not override verification.
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
  const ca=env.DATABASE_CA_CERT?.replaceAll('\\n','\n');
  return {connectionString:url.href,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},max:5,
    connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:12000,application_name:'travel-review-shared'};
}
export function createPostgresDriver(env=process.env){
  const pool=new pg.Pool(postgresOptions(env));
  pool.on('error',error=>console.error('PostgreSQL connection error:',error.code||'connection_failed'));
  return {kind:'postgresql',query:(sql,args=[])=>pool.query(sql,args),
    async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
    close:()=>pool.end()};
}
export async function createDemoDriver(directory){
  const {PGlite}=await import('@electric-sql/pglite');
  if(directory)fs.mkdirSync(directory,{recursive:true});
  const db=await PGlite.create(directory||'memory://');
  return {kind:'pglite',query:async(sql,args=[])=>args.length?db.query(sql,args):(await db.exec(sql)).at(-1),
    transaction:fn=>db.transaction(tx=>fn({query:async(sql,args=[])=>args.length?tx.query(sql,args):(await tx.exec(sql)).at(-1)})),
    close:()=>db.close()};
}
