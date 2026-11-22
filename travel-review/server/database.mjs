import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {places,validateReview} from '../lib/travel-data.ts';
import {webReviewSnapshots} from '../lib/web-reviews.ts';
import {validatePlace,placeKey} from '../lib/catalog-data.ts';
export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const defaultDatabasePath=path.join(projectRoot,'data','travel.sqlite');
export class InputError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const checked=fn=>{try{return fn()}catch(e){throw new InputError(e.message)}};
function publicPlace(r){return {id:r.id,name:r.name,region:r.region,city:r.city,district:r.district,address:r.address,category:r.category,description:r.description,features:JSON.parse(r.features),drawbacks:JSON.parse(r.drawbacks),source:r.source,tags:JSON.parse(r.tags),tone:r.tone,notice:r.notice??undefined,origin:r.origin,mine:r.origin==='community',createdAt:r.created_at};}
function publicReview(r){return {id:r.id,placeId:r.place_id,nickname:r.nickname,overall:r.overall,transport:r.transport,parking:r.parking,cleanliness:r.cleanliness,facilities:r.facilities,vendors:r.vendors,scenery:r.scenery,cost:r.cost,content:r.content,tags:JSON.parse(r.tags),createdAt:r.updated_at,demo:false,mine:true};}
export function openStore(filename=process.env.TRAVEL_DB_PATH?path.resolve(projectRoot,process.env.TRAVEL_DB_PATH):defaultDatabasePath){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>1){db.close();throw new Error('資料庫版本高於此程式支援的版本，請更新程式。');}
  db.exec(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  db.exec('PRAGMA user_version=1');
  const insertPlace=db.prepare('INSERT OR IGNORE INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,created_at,dedupe_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const putPlace=(p,origin,id=randomUUID())=>insertPlace.run(id,p.name,p.region,p.city,p.district??'',p.address??'',p.category,p.description??'',JSON.stringify(p.features??[]),JSON.stringify(p.drawbacks??[]),p.source??'',JSON.stringify(p.tags??[]),p.tone,p.notice??null,origin,new Date().toISOString(),p.dedupeKey??placeKey(p.name,p.city));
  if(!db.prepare("SELECT value FROM app_meta WHERE key='seed-version'").get()){
    db.exec('BEGIN IMMEDIATE');try{
      for(const p of places)putPlace(p,'curated',p.id);
      const put=db.prepare('INSERT OR IGNORE INTO place_web_snapshots VALUES(?,?,?)');
      for(const s of webReviewSnapshots)put.run(s.placeId,JSON.stringify(s),s.checkedAt);
      db.prepare('INSERT INTO app_meta VALUES(?,?)').run('seed-version','2026-11-23-local-42-v1');db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');db.close();throw e;}
  }
  const knownIds=()=>db.prepare('SELECT id FROM destinations').all().map(p=>p.id);
  const listPlaces=()=>db.prepare('SELECT * FROM destinations ORDER BY origin,created_at DESC,name').all().map(publicPlace);
  const listReviews=()=>db.prepare('SELECT * FROM reviews ORDER BY updated_at DESC').all().map(publicReview);
  function createPlace(raw){
    const p=checked(()=>validatePlace(raw));const found=db.prepare('SELECT id FROM destinations WHERE dedupe_key=?').get(p.dedupeKey);
    if(found)throw new InputError('同一縣市已存在同名景點，請先搜尋現有資料。',409);
    const id=randomUUID(),result=putPlace(p,'community',id);if(!result.changes)throw new InputError('同名景點已存在。',409);
    return publicPlace(db.prepare('SELECT * FROM destinations WHERE id=?').get(id));
  }
  function saveReview(raw){
    const r=checked(()=>validateReview(raw,knownIds()));const prior=db.prepare('SELECT id FROM reviews WHERE place_id=?').get(r.placeId),id=prior?.id??randomUUID(),now=new Date().toISOString();
    db.prepare(`INSERT INTO reviews(id,place_id,nickname,overall,transport,parking,cleanliness,facilities,vendors,scenery,cost,content,tags,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(place_id) DO UPDATE SET nickname=excluded.nickname,overall=excluded.overall,transport=excluded.transport,parking=excluded.parking,cleanliness=excluded.cleanliness,facilities=excluded.facilities,vendors=excluded.vendors,scenery=excluded.scenery,cost=excluded.cost,content=excluded.content,tags=excluded.tags,updated_at=excluded.updated_at`).run(id,r.placeId,r.nickname,r.overall,r.transport,r.parking,r.cleanliness,r.facilities,r.vendors,r.scenery,r.cost,r.content,JSON.stringify(r.tags),now,now);
    return {review:publicReview(db.prepare('SELECT * FROM reviews WHERE place_id=?').get(r.placeId)),updated:!!prior};
  }
  function importData(data){
    if(!data||typeof data!=='object'||!Array.isArray(data.places)||!Array.isArray(data.reviews))throw new InputError('請使用網站匯出的 JSON 資料。');
    if(data.places.length>5000||data.reviews.length>10000)throw new InputError('匯入資料筆數超過本機原型限制。');
    const idMap=new Map();let added=0,reviewCount=0,skippedDemo=0;db.exec('BEGIN IMMEDIATE');
    try{
      for(const old of data.places){const p=validatePlace(old);const found=db.prepare('SELECT id FROM destinations WHERE dedupe_key=?').get(p.dedupeKey);const id=found?.id??randomUUID();if(!found){putPlace(p,'community',id);added++;}idMap.set(old.id,id);}
      for(const r of data.reviews){if(r.demo){skippedDemo++;continue;}const placeId=idMap.get(r.placeId)??r.placeId;saveReview({...r,placeId});reviewCount++;}
      db.exec('COMMIT');return {addedPlaces:added,importedReviews:reviewCount,skippedDemo};
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {db,filename,listPlaces,listReviews,createPlace,saveReview,importData,
    webSnapshots:()=>db.prepare('SELECT data FROM place_web_snapshots').all().map(r=>JSON.parse(r.data)),
    deleteReview:placeId=>db.prepare('DELETE FROM reviews WHERE place_id=?').run(placeId),
    close:()=>{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();}};
}
