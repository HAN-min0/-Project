import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {createDemoDriver,postgresOptions} from '../server/postgres.mjs';
import {openSharedStore,InputError} from '../server/cloud-store.mjs';
import {createSharedServer} from '../server/cloud.mjs';
import {summarize,demoReviews} from '../lib/travel-data.ts';
const A='a'.repeat(64),B='b'.repeat(64),password='shared-test-admin-password';
const minimal={name:'共用河岸公園',region:'north',city:'臺北市',category:'城市公園'};
let driver,store;
before(async()=>{driver=await createDemoDriver();store=await openSharedStore(driver);});
beforeEach(async()=>{await driver.query("DELETE FROM admin_sessions; DELETE FROM reviews; DELETE FROM destinations WHERE origin='community'; DELETE FROM visitors;");});
after(async()=>{await driver?.close();});
async function visitors(){await store.touchVisitor(A);await store.touchVisitor(B);}
async function withServer(fn,options={}){
 const app=await createSharedServer({store,isDemo:true,adminPassword:password,...options});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 function client(){const jar=new Map();return async(url,{method='GET',body,headers={}}={})=>{
  const response=await new Promise((resolve,reject)=>{const req=httpRequest(base+url,{method,headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const values=new Headers();for(const [key,value] of Object.entries(res.headers)){for(const item of Array.isArray(value)?value:[value])if(item!==undefined)values.append(key,item);}resolve({status:res.statusCode,headers:values,text:Buffer.concat(chunks).toString('utf8')});});});req.on('error',reject);req.end(body!==undefined?JSON.stringify(body):undefined);});
  for(const item of response.headers.getSetCookie()){const first=item.split(';')[0],split=first.indexOf('=');jar.set(first.slice(0,split),first.slice(split+1));}
  const data=JSON.parse(response.text);return {status:response.status,data,headers:response.headers};
 };}
 try{await fn({client,base});}finally{await new Promise(resolve=>app.server.close(resolve));}
}
test('PostgreSQL 實際建立六表、42景點、18快照並啟用 RLS',async()=>{
 const metadata=await store.metadata();assert.equal(metadata.tables.length,6);assert.equal((await store.listPlaces()).length,42);assert.equal((await store.webSnapshots()).length,18);assert.deepEqual(await store.listReviews(),[]);
 assert.equal(metadata.tables.find(t=>t.name==='destinations').columns.find(c=>c.name==='id').primaryKey,true);
 const flags=(await driver.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'")).rows;assert.equal(flags.length,6);assert.ok(flags.every(r=>r.rowsecurity));
 await openSharedStore(driver);assert.equal((await store.listPlaces()).length,42);
});
test('兩位訪客可各評同一景點且更新不覆蓋他人，空白心得與零元保留',async()=>{
 await visitors();await store.saveReview({placeId:'jiufen',nickname:'甲',overall:5,content:'',cost:0},A);await store.saveReview({placeId:'jiufen',nickname:'乙',overall:1},B);
 let rows=await store.listReviews(A);assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.mine).length,1);assert.equal(summarize('jiufen',rows).avg,3);
 const saved=await store.saveReview({placeId:'jiufen',nickname:'甲',overall:4,content:'很美',cost:0},A);assert.equal(saved.updated,true);
 rows=await store.listReviews(A);assert.equal(rows.length,2);assert.equal(rows.find(r=>!r.mine).overall,1);assert.equal(rows.find(r=>r.mine).cost,0);assert.equal(rows.find(r=>!r.mine).parking,null);
 await store.saveReview({placeId:'jiufen',nickname:'甲',overall:4,content:''},A);assert.equal((await store.listReviews(A)).find(r=>r.mine).content,'');
});
test('刪除操作只影響目前訪客自己的評價',async()=>{
 await visitors();await store.saveReview({placeId:'jiufen',nickname:'甲',overall:5},A);await store.saveReview({placeId:'jiufen',nickname:'乙',overall:3},B);
 assert.deepEqual(await store.deleteReview('jiufen',B),{deleted:true});assert.equal((await store.listReviews(A))[0].nickname,'甲');assert.deepEqual(await store.deleteReview('jiufen',B),{deleted:false});
});
test('並行新增同名景點由資料庫保證去重，文字以參數保存',async()=>{
 await visitors();const results=await Promise.allSettled([store.createPlace(minimal,A),store.createPlace({...minimal,name:' 共用 河岸 公園 '},B)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const place=await store.createPlace({...minimal,name:"公園'); DROP TABLE reviews;--"},A);assert.match(place.name,/DROP TABLE/);assert.deepEqual(await store.listReviews(),[]);
});
test('公開回應不含訪客雜湊、管理登入或連線資訊',async()=>{
 await visitors();await store.createPlace(minimal,A);await store.saveReview({placeId:'jiufen',nickname:'甲',overall:5},A);
 const text=JSON.stringify({places:await store.listPlaces(A),reviews:await store.listReviews(A)});assert.ok(!text.includes(A));assert.ok(!text.includes('actor_hash'));assert.ok(!text.includes('created_by'));assert.ok(!text.includes(password));
});
test('PostgreSQL 本身強制分數、外鍵與每訪客每景點唯一限制',async()=>{
 await visitors();await store.saveReview({placeId:'jiufen',nickname:'甲',overall:4},A);
 await assert.rejects(driver.query('UPDATE reviews SET parking=0'),e=>e.code==='23514');
 await assert.rejects(driver.query('INSERT INTO place_web_snapshots VALUES($1,$2::jsonb,$3)',['missing','{}','2026-11-23']),e=>e.code==='23503');
 await assert.rejects(store.saveReview({placeId:'missing',nickname:'甲',overall:5},A),e=>e instanceof InputError);
 await assert.rejects(store.createPlace(minimal,''),e=>e.status===401);
});
test('舊 JSON 匯入具交易回滾與示範資料排除',async()=>{
 await visitors();const input={places:[{...minimal,id:'old'}],reviews:[{placeId:'old',nickname:'甲',overall:5,content:''},{...demoReviews[0],placeId:'old'}]};
 assert.deepEqual(await store.importData(input,A),{addedPlaces:1,importedReviews:1,skippedDemo:1});
 await assert.rejects(store.importData({places:[{...minimal,id:'bad',name:'錯誤匯入測試'}],reviews:[{placeId:'bad',nickname:'甲',overall:99}]},A));assert.equal((await store.listPlaces()).length,43);assert.equal((await store.listReviews()).length,1);
});
test('無政策的 RLS 表格不會透過低權限角色讀出資料',async()=>{
 await driver.query('CREATE ROLE travel_rls_test NOLOGIN; GRANT USAGE ON SCHEMA public TO travel_rls_test; GRANT SELECT ON destinations TO travel_rls_test;');
 try{await driver.query('SET ROLE travel_rls_test');assert.equal((await driver.query('SELECT COUNT(*)::int AS count FROM destinations')).rows[0].count,0);}finally{await driver.query('RESET ROLE');}
});
test('資料庫檢視有分頁、欄位型別，且拒絕任意 SQL 表名',async()=>{
 const page=await store.tableRows('destinations',25,25);assert.equal(page.total,42);assert.equal(page.rows.length,17);
 await assert.rejects(store.tableRows('destinations; DROP TABLE reviews'),e=>e.status===404);await assert.rejects(store.tableRows('reviews',500),e=>e.status===400);
});
test('HTTP 兩個瀏覽器共用新增景點與評價，但 mine 與刪除權分開',async()=>withServer(async({client})=>{
 const a=client(),b=client();const first=await a('/api/places');assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/SameSite=Lax/);await b('/api/places');
 const made=await a('/api/places',{method:'POST',body:minimal});assert.equal(made.status,201);const placeId=made.data.place.id;
 assert.ok((await b('/api/places')).data.places.some(p=>p.id===placeId));
 assert.equal((await a('/api/reviews',{method:'POST',body:{placeId,nickname:'相同暱稱',overall:5}})).status,200);
 assert.equal((await b('/api/reviews',{method:'POST',body:{placeId,nickname:'相同暱稱',overall:2}})).status,200);
 let view=await b('/api/reviews');assert.equal(view.data.reviews.length,2);assert.equal(view.data.reviews.filter(r=>r.mine).length,1);
 await b('/api/reviews?placeId='+placeId,{method:'DELETE'});view=await a('/api/reviews');assert.equal(view.data.reviews.length,1);assert.equal(view.data.reviews[0].overall,5);
}));
test('管理頁 API 需要登入，密碼不回傳，登出與過期會失效',async()=>withServer(async({client})=>{
 const a=client();assert.equal((await a('/api/admin/overview')).status,401);
 assert.equal((await a('/api/admin/login',{method:'POST',body:{password:'wrong'}})).status,401);
 const login=await a('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);assert.ok(!JSON.stringify(login.data).includes(password));assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 const info=await a('/api/admin/overview');assert.equal(info.data.tables.length,6);assert.equal(info.data.readOnly,false);assert.deepEqual(info.data.deletableTables,['destinations','reviews']);
 assert.equal((await a('/api/admin/tables/reviews',{method:'POST',body:{}})).status,405);
 assert.equal((await a('/api/admin/tables/reviews?limit=1000')).status,400);
 await a('/api/admin/logout',{method:'POST',body:{}});assert.equal((await a('/api/admin/overview')).status,401);
 await a('/api/admin/login',{method:'POST',body:{password}});await driver.query("UPDATE admin_sessions SET expires_at=NOW()-INTERVAL '1 hour'");assert.equal((await a('/api/admin/overview')).status,401);
}));
test('公網模式採固定 HTTPS 網域、Secure Cookie，拒絕跨來源寫入',async()=>withServer(async({client})=>{
 const a=client(),headers={Host:'travel.example'};
 const first=await a('/api/places',{headers});assert.equal(first.status,200);assert.match(first.headers.get('set-cookie'),/; Secure/);
 assert.equal((await a('/api/places',{headers:{Host:'evil.example'}})).status,403);
 assert.equal((await a('/api/places',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:minimal})).status,403);
 assert.equal((await a('/api/places',{method:'POST',headers:{...headers,Origin:'https://travel.example'},body:minimal})).status,201);
 const health=await a('/healthz',{headers:{Host:'internal-health.local'}});assert.equal(health.status,200);assert.deepEqual(health.data,{ok:true});
},{isDemo:false,origin:'https://travel.example'}));
test('公開訪客摘要使用規則，沒有管理登入不呼叫付費模型',async()=>{
 const prior=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-placeholder-never-sent';
 try{await visitors();await store.saveReview({placeId:'jiufen',nickname:'甲',overall:5},A);await withServer(async({client})=>{const a=client();await a('/api/places');assert.equal((await a('/api/summary')).data.aiConfigured,false);const summary=await a('/api/summary',{method:'POST',body:{placeId:'jiufen'}});assert.equal(summary.status,200);assert.equal(summary.data.mode,'rules');});}
 finally{if(prior===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=prior;}
});
test('寫入頻率限制不影響讀取',async()=>withServer(async({client})=>{const a=client();await a('/api/places');assert.equal((await a('/api/reviews',{method:'POST',body:{placeId:'jiufen',nickname:'甲',overall:4}})).status,200);assert.equal((await a('/api/reviews',{method:'POST',body:{placeId:'jiufen',nickname:'甲',overall:5}})).status,429);assert.equal((await a('/api/reviews')).status,200);},{writeLimit:1}));
test('正式 PostgreSQL 連線要求設定，TLS 驗證不能被 URL 關閉',()=>{
 assert.throws(()=>postgresOptions({}),/DATABASE_URL/);assert.throws(()=>postgresOptions({DATABASE_URL:'https://example.com'}),/PostgreSQL/);
 const options=postgresOptions({DATABASE_URL:'postgresql://test:test@db.example/postgres?sslmode=no-verify'});assert.equal(options.ssl.rejectUnauthorized,true);assert.ok(!options.connectionString.includes('sslmode'));
});
test('獨立的資料庫密碼會正確編碼特殊字元，未填的樣板會拒絕啟動',()=>{
 const url='postgresql://postgres.example:[YOUR-PASSWORD]@db.example:5432/postgres';
 assert.throws(()=>postgresOptions({DATABASE_URL:url}),/DATABASE_PASSWORD/);
 assert.throws(()=>postgresOptions({DATABASE_URL:url.replace('YOUR-PASSWORD','YOUR-DATABASE-PASSWORD')}),/DATABASE_PASSWORD/);
 const options=postgresOptions({DATABASE_URL:url,DATABASE_PASSWORD:'test@/#%中文-password'});
 assert.equal(decodeURIComponent(new URL(options.connectionString).password),'test@/#%中文-password');
 assert.equal(new pg.Client(options).connectionParameters.password,'test@/#%中文-password');
});
test('PGlite 實體檔案關閉再開啟後仍保留新增景點及空白心得',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'travel-pg-'));let persistent;
 try{
  persistent=await createDemoDriver(directory);let s=await openSharedStore(persistent);await s.touchVisitor(A);const place=await s.createPlace(minimal,A);await s.saveReview({placeId:place.id,nickname:'甲',overall:5},A);await persistent.close();persistent=null;
  persistent=await createDemoDriver(directory);s=await openSharedStore(persistent);assert.equal((await s.listPlaces()).length,43);assert.equal((await s.listReviews(A))[0].content,'');assert.equal((await s.listReviews(A))[0].mine,true);
 }finally{await persistent?.close();const resolved=path.resolve(directory);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'travel-pg-'))throw new Error('Unexpected temporary database path');fs.rmSync(resolved,{recursive:true,force:true});}
});
