import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {places,validateReview} from '../lib/travel-data.ts';
import {webReviewSnapshots} from '../lib/web-reviews.ts';
import {validatePlace,placeKey} from '../lib/catalog-data.ts';
import {InputError} from './errors.mjs';

export {InputError};
export const TABLES=['destinations','reviews','place_web_snapshots','app_meta','visitors','admin_sessions'];
const orders={destinations:'created_at DESC, id',reviews:'updated_at DESC, id',place_web_snapshots:'place_id',app_meta:'key',visitors:'created_at DESC, actor_hash',admin_sessions:'created_at DESC, session_hash'};
const iso=value=>value instanceof Date?value.toISOString():value;
const array=value=>typeof value==='string'?JSON.parse(value):value;
const checked=fn=>{try{return fn();}catch(error){throw new InputError(error.message);}};
function publicPlace(row,actorHash=''){return {id:row.id,name:row.name,region:row.region,city:row.city,district:row.district,address:row.address,category:row.category,description:row.description,features:array(row.features),drawbacks:array(row.drawbacks),source:row.source,tags:array(row.tags),tone:row.tone,notice:row.notice??undefined,origin:row.origin,mine:!!actorHash&&row.created_by===actorHash,createdAt:iso(row.created_at)};}
function publicReview(row,actorHash=''){return {id:row.id,placeId:row.place_id,nickname:row.nickname,overall:row.overall,transport:row.transport,parking:row.parking,cleanliness:row.cleanliness,facilities:row.facilities,vendors:row.vendors,scenery:row.scenery,cost:row.cost,content:row.content,tags:array(row.tags),createdAt:iso(row.updated_at),demo:false,mine:!!actorHash&&row.actor_hash===actorHash};}
const actorValid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export async function openSharedStore(driver){
  async function putPlace(client,p,origin,actorHash=null,id=randomUUID()){
    const values=[id,p.name,p.region,p.city,p.district??'',p.address??'',p.category,p.description??'',JSON.stringify(p.features??[]),JSON.stringify(p.drawbacks??[]),p.source??'',JSON.stringify(p.tags??[]),p.tone,p.notice??null,origin,p.dedupeKey??placeKey(p.name,p.city),actorHash];
    return client.query('INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,$17) RETURNING *',values);
  }
  await driver.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(2026112301)');
    await tx.query(fs.readFileSync(new URL('./cloud-schema.sql',import.meta.url),'utf8'));
    const existing=await tx.query("SELECT value FROM app_meta WHERE key='schema-version'");
    if(existing.rows.length&&existing.rows[0].value!=='2')throw new Error('雲端資料庫版本不相容，請先確認資料表版本。');
    const seed=await tx.query("SELECT value FROM app_meta WHERE key='seed-version'");
    if(!seed.rows.length){
      for(const p of places){const prior=await tx.query('SELECT id FROM destinations WHERE dedupe_key=$1',[placeKey(p.name,p.city)]);if(!prior.rows.length)await putPlace(tx,p,'curated',null,p.id);}
      for(const s of webReviewSnapshots)await tx.query('INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(place_id) DO NOTHING',[s.placeId,JSON.stringify(s),s.checkedAt]);
      await tx.query("INSERT INTO app_meta(key,value) VALUES('seed-version','2026-11-23-shared-42-v1')");
    }
    await tx.query("INSERT INTO app_meta(key,value) VALUES('schema-version','2') ON CONFLICT(key) DO NOTHING");
  });
  async function requireActor(actorHash){
    if(!actorValid(actorHash)||!(await driver.query('SELECT 1 FROM visitors WHERE actor_hash=$1',[actorHash])).rows.length)throw new InputError('請重新整理網頁以建立訪客身分。',401);
  }
  async function createPlace(raw,actorHash){
    await requireActor(actorHash);const p=checked(()=>validatePlace(raw));
    try{return publicPlace((await putPlace(driver,p,'community',actorHash)).rows[0],actorHash);}
    catch(error){if(error.code==='23505')throw new InputError('同一縣市已存在同名景點，請先搜尋現有資料。',409);throw error;}
  }
  async function writeReview(client,raw,actorHash){
    const known=(await client.query('SELECT id FROM destinations WHERE id=$1',[typeof raw?.placeId==='string'?raw.placeId:''])).rows.map(p=>p.id);
    const r=checked(()=>validateReview(raw,known));
    const prior=await client.query('SELECT id FROM reviews WHERE place_id=$1 AND actor_hash=$2',[r.placeId,actorHash]);
    const saved=await client.query(`INSERT INTO reviews(id,place_id,actor_hash,nickname,overall,transport,parking,cleanliness,facilities,vendors,scenery,cost,content,tags)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT(place_id,actor_hash) DO UPDATE SET nickname=EXCLUDED.nickname,overall=EXCLUDED.overall,transport=EXCLUDED.transport,parking=EXCLUDED.parking,cleanliness=EXCLUDED.cleanliness,facilities=EXCLUDED.facilities,vendors=EXCLUDED.vendors,scenery=EXCLUDED.scenery,cost=EXCLUDED.cost,content=EXCLUDED.content,tags=EXCLUDED.tags,updated_at=NOW() RETURNING *`,
      [randomUUID(),r.placeId,actorHash,r.nickname,r.overall,r.transport,r.parking,r.cleanliness,r.facilities,r.vendors,r.scenery,r.cost,r.content,JSON.stringify(r.tags)]);
    return {review:publicReview(saved.rows[0],actorHash),updated:prior.rows.length>0};
  }
  async function importData(data,actorHash){
    await requireActor(actorHash);
    if(!data||!Array.isArray(data.places)||!Array.isArray(data.reviews))throw new InputError('請選擇網站匯出的 JSON。');
    if(data.places.length>5000||data.reviews.length>10000)throw new InputError('匯入筆數超過限制。');
    return driver.transaction(async tx=>{
      const map=new Map();let addedPlaces=0,importedReviews=0,skippedDemo=0;
      for(const old of data.places){const p=checked(()=>validatePlace(old));const found=await tx.query('SELECT id FROM destinations WHERE dedupe_key=$1',[p.dedupeKey]);let id=found.rows[0]?.id;if(!id){id=(await putPlace(tx,p,'community',actorHash)).rows[0].id;addedPlaces++;}map.set(old.id,id);}
      for(const old of data.reviews){if(old.demo){skippedDemo++;continue;}await writeReview(tx,{...old,placeId:map.get(old.placeId)??old.placeId},actorHash);importedReviews++;}
      return {addedPlaces,importedReviews,skippedDemo};
    });
  }
  const metadata=async()=>{
    const schema=await driver.query(`SELECT c.table_name,c.column_name,c.data_type,c.is_nullable,c.ordinal_position,
      EXISTS(SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage ku ON ku.constraint_name=tc.constraint_name AND ku.table_schema=tc.table_schema WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=c.table_schema AND tc.table_name=c.table_name AND ku.column_name=c.column_name) AS primary_key
      FROM information_schema.columns c WHERE c.table_schema='public' ORDER BY c.table_name,c.ordinal_position`);
    const tables=[];
    for(const name of TABLES){const count=await driver.query(`SELECT COUNT(*)::int AS count FROM "${name}"`);tables.push({name,count:count.rows[0].count,columns:schema.rows.filter(c=>c.table_name===name).map(c=>({name:c.column_name,type:c.data_type,nullable:c.is_nullable==='YES',primaryKey:c.primary_key}))});}
    const info=await driver.query('SELECT current_database() AS name, version() AS version');
    return {storage:driver.kind,database:info.rows[0],tables,readOnly:true};
  };
  return {kind:driver.kind,createPlace,importData,
    touchVisitor:actorHash=>{if(!actorValid(actorHash))throw new InputError('訪客格式不正確。');return driver.query('INSERT INTO visitors(actor_hash) VALUES($1) ON CONFLICT(actor_hash) DO UPDATE SET last_seen_at=NOW()',[actorHash]);},
    listPlaces:async(actorHash='')=>(await driver.query('SELECT * FROM destinations ORDER BY origin,created_at DESC,name')).rows.map(r=>publicPlace(r,actorHash)),
    listReviews:async(actorHash='')=>(await driver.query('SELECT * FROM reviews ORDER BY updated_at DESC,id')).rows.map(r=>publicReview(r,actorHash)),
    webSnapshots:async()=>(await driver.query('SELECT data FROM place_web_snapshots ORDER BY place_id')).rows.map(r=>typeof r.data==='string'?JSON.parse(r.data):r.data),
    saveReview:async(raw,actorHash)=>{await requireActor(actorHash);return writeReview(driver,raw,actorHash);},
    deleteReview:async(placeId,actorHash)=>{await requireActor(actorHash);const r=await driver.query('DELETE FROM reviews WHERE place_id=$1 AND actor_hash=$2 RETURNING id',[placeId,actorHash]);return {deleted:r.rows.length>0};},
    metadata,
    tableRows:async(name,limit=25,offset=0)=>{if(!TABLES.includes(name))throw new InputError('找不到這個資料表。',404);if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0||offset>1000000)throw new InputError('分頁參數不正確。');const count=await driver.query(`SELECT COUNT(*)::int AS count FROM "${name}"`);const r=await driver.query(`SELECT * FROM "${name}" ORDER BY ${orders[name]} LIMIT $1 OFFSET $2`,[limit,offset]);return {table:name,total:count.rows[0].count,limit,offset,rows:r.rows};},
    createAdminSession:async hash=>{await driver.query('DELETE FROM admin_sessions WHERE expires_at<=NOW()');await driver.query("INSERT INTO admin_sessions(session_hash,expires_at) VALUES($1,NOW()+INTERVAL '8 hours')",[hash]);},
    hasAdminSession:async hash=>(await driver.query('SELECT 1 FROM admin_sessions WHERE session_hash=$1 AND expires_at>NOW()',[hash])).rows.length>0,
    deleteAdminSession:hash=>driver.query('DELETE FROM admin_sessions WHERE session_hash=$1',[hash]),
    health:async()=>{await driver.query('SELECT 1');return true;},close:()=>driver.close()};
}
