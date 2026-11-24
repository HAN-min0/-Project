import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createDemoDriver} from '../server/postgres.mjs';
import {openSharedStore} from '../server/cloud-store.mjs';
import {createSharedServer} from '../server/cloud.mjs';

const A='a'.repeat(64),B='b'.repeat(64),password='admin-deletion-test-password';
let driver,store;
before(async()=>{driver=await createDemoDriver();store=await openSharedStore(driver);});
beforeEach(async()=>{
 await driver.query("DELETE FROM admin_sessions; DELETE FROM reviews; DELETE FROM place_web_snapshots WHERE place_id IN (SELECT id FROM destinations WHERE origin='community'); DELETE FROM destinations WHERE origin='community'; DELETE FROM visitors;");
});
after(async()=>{await driver.close();});
async function fixture(){
 await store.touchVisitor(A);await store.touchVisitor(B);
 const place=await store.createPlace({name:'管理刪除測試景點',city:'臺北市',region:'north',category:'城市公園'},A);
 const keep=await store.createPlace({name:'保留景點',city:'臺北市',region:'north',category:'城市公園'},B);
 const first=(await store.saveReview({placeId:place.id,nickname:'測試甲',overall:5,content:''},A)).review;
 const second=(await store.saveReview({placeId:place.id,nickname:'測試乙',overall:2,content:'應一起刪除的評價'},B)).review;
 const kept=(await store.saveReview({placeId:keep.id,nickname:'保留旅人',overall:4},A)).review;
 await driver.query('INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES($1,$2::jsonb,$3)',[place.id,JSON.stringify({placeId:place.id,overall:4.5}),'2026-11-25']);
 return {place,keep,first,second,kept};
}
async function withServer(fn,options={}){
 const app=await createSharedServer({store,isDemo:true,adminPassword:password,...options});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 function client(){
  const jar=new Map();
  return async(url,{method='GET',body,headers={}}={})=>{
   const payload=body!==undefined?JSON.stringify(body):undefined;
   const reply=await new Promise((resolve,reject)=>{
    const req=httpRequest(base+url,{method,headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),...(payload!==undefined?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...headers}},res=>{
     const chunks=[];res.on('data',part=>chunks.push(part));res.on('end',()=>{try{resolve({status:res.statusCode,headers:res.headers,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){reject(error);}});
    });req.on('error',reject);req.end(payload);
   });
   for(const cookie of reply.headers['set-cookie']??[]){const first=cookie.split(';')[0],split=first.indexOf('=');jar.set(first.slice(0,split),first.slice(split+1));}
   return reply;
  };
 }
 try{await fn({client});}finally{await new Promise(resolve=>app.server.close(resolve));}
}

test('管理刪除預覽回傳正確名稱與關聯筆數，不洩漏訪客雜湊',async()=>{
 const f=await fixture(),preview=await store.previewAdminDeletion('destinations',f.place.id);
 assert.equal(preview.title,f.place.name);assert.deepEqual(preview.counts,{destinations:1,reviews:2,place_web_snapshots:1});assert.match(preview.revision,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(preview).includes(A));
 const review=await store.previewAdminDeletion('reviews',f.first.id);assert.equal(review.content,'');assert.equal(review.placeName,f.place.name);assert.deepEqual(review.counts,{destinations:0,reviews:1,place_web_snapshots:0});
 assert.equal((await store.listReviews()).length,3);
});
test('管理者可刪除他人單筆評價，保留景點、其他評價與來源',async()=>{
 const f=await fixture(),preview=await store.previewAdminDeletion('reviews',f.second.id);
 const deleted=await store.deleteAdminRecord('reviews',f.second.id,preview.revision);assert.equal(deleted.deleted,true);
 assert.deepEqual((await store.listReviews()).map(row=>row.id).sort(),[f.first.id,f.kept.id].sort());
 assert.ok((await store.listPlaces()).some(row=>row.id===f.place.id));assert.equal((await store.webSnapshots()).length,19);
});
test('管理者刪除景點時以交易移除其評價與快照，其他景點維持原狀',async()=>{
 const f=await fixture(),preview=await store.previewAdminDeletion('destinations',f.place.id);
 const result=await store.deleteAdminRecord('destinations',f.place.id,preview.revision);assert.deepEqual(result.counts,preview.counts);
 assert.ok(!(await store.listPlaces()).some(row=>row.id===f.place.id));assert.ok((await store.listPlaces()).some(row=>row.id===f.keep.id));
 assert.deepEqual((await store.listReviews()).map(row=>row.id),[f.kept.id]);assert.equal((await store.webSnapshots()).length,18);
});
test('預覽後新增評價會拒絕舊確認，重新預覽後才可刪除',async()=>{
 const f=await fixture(),preview=await store.previewAdminDeletion('destinations',f.keep.id);
 await store.saveReview({placeId:f.keep.id,nickname:'新加入旅人',overall:3},B);
 await assert.rejects(store.deleteAdminRecord('destinations',f.keep.id,preview.revision),error=>error.status===409);
 assert.equal((await store.listReviews()).length,4);
 const refreshed=await store.previewAdminDeletion('destinations',f.keep.id);assert.equal(refreshed.counts.reviews,2);
 await store.deleteAdminRecord('destinations',f.keep.id,refreshed.revision);assert.equal((await store.listReviews()).length,2);
});
test('評價、景點或快照內容變動，即使筆數未變也拒絕舊確認',async()=>{
 const f=await fixture();
 for(const change of [
  ()=>store.saveReview({placeId:f.place.id,nickname:'測試甲',overall:4,content:'更新內容'},A),
  ()=>driver.query('UPDATE destinations SET description=$1 WHERE id=$2',['新介紹',f.place.id]),
  ()=>driver.query('UPDATE place_web_snapshots SET data=$1::jsonb WHERE place_id=$2',[JSON.stringify({overall:3}),f.place.id])
 ]){
  const preview=await store.previewAdminDeletion('destinations',f.place.id);await change();
  await assert.rejects(store.deleteAdminRecord('destinations',f.place.id,preview.revision),error=>error.status===409);
 }
 const preview=await store.previewAdminDeletion('reviews',f.second.id);
 await store.saveReview({placeId:f.place.id,nickname:'測試乙',overall:3},B);
 await assert.rejects(store.deleteAdminRecord('reviews',f.second.id,preview.revision),error=>error.status===409);
});
test('刪除途中失敗會回滾，景點與已刪除的關聯資料全部保留',async()=>{
 const f=await fixture();let fail=false;
 const wrapped={...driver,transaction:fn=>driver.transaction(tx=>fn({query:(sql,args)=>{if(fail&&sql.startsWith('DELETE FROM destinations'))throw new Error('test-rollback');return tx.query(sql,args);}}))};
 const guarded=await openSharedStore(wrapped),preview=await guarded.previewAdminDeletion('destinations',f.place.id);fail=true;
 await assert.rejects(guarded.deleteAdminRecord('destinations',f.place.id,preview.revision),/test-rollback/);
 assert.ok((await store.listPlaces()).some(row=>row.id===f.place.id));assert.equal((await store.listReviews()).length,3);assert.equal((await store.webSnapshots()).length,19);
});
test('刪除限景點與評價，拒絕其他表、任意表名與未預覽請求',async()=>{
 const f=await fixture();
 for(const table of ['visitors','admin_sessions','app_meta','place_web_snapshots','reviews; DROP TABLE reviews']){
  await assert.rejects(store.previewAdminDeletion(table,f.place.id),error=>error.status===403);
  await assert.rejects(store.deleteAdminRecord(table,f.place.id,'a'.repeat(64)),error=>error.status===403);
 }
 await assert.rejects(store.previewAdminDeletion('destinations',"' OR 1=1--"),error=>error.status===400);
 await assert.rejects(store.deleteAdminRecord('destinations',f.place.id),error=>error.status===400);
 await assert.rejects(store.deleteAdminRecord('destinations',f.place.id,'a'.repeat(64)),error=>error.status===409);
 assert.equal((await store.listReviews()).length,3);
});
test('刪除預覽與實際刪除都需要管理者登入，登出或過期即失效',async()=>{
 const f=await fixture(),endpoint='/api/admin/records/reviews/'+f.first.id;
 await withServer(async({client})=>{
  const visitor=client(),admin=client();await visitor('/api/places');
  assert.equal((await visitor(endpoint)).status,401);assert.equal((await visitor(endpoint,{method:'DELETE',body:{revision:'a'.repeat(64)}})).status,401);
  assert.equal((await admin('/api/admin/login',{method:'POST',body:{password}})).status,200);
  const preview=await admin(endpoint);assert.equal(preview.status,200);
  await admin('/api/admin/logout',{method:'POST',body:{}});
  assert.equal((await admin(endpoint,{method:'DELETE',body:{revision:preview.data.revision}})).status,401);
  await admin('/api/admin/login',{method:'POST',body:{password}});await driver.query("UPDATE admin_sessions SET expires_at=NOW()-INTERVAL '1 second'");
  assert.equal((await admin(endpoint)).status,401);assert.equal((await store.listReviews()).length,3);
 });
});
test('管理刪除拒絕跨來源與不支援方法，登入後可完成指定刪除',async()=>{
 const f=await fixture();
 await withServer(async({client})=>{
  const admin=client(),headers={Host:'travel.example'};
  await admin('/api/admin/login',{method:'POST',headers,body:{password}});
  const endpoint='/api/admin/records/reviews/'+f.first.id,preview=await admin(endpoint,{headers});assert.equal(preview.status,200);
  assert.equal((await admin(endpoint,{method:'DELETE',headers:{...headers,Origin:'https://evil.example'},body:{revision:preview.data.revision}})).status,403);
  assert.equal((await admin(endpoint,{method:'POST',headers,body:{}})).status,405);
  assert.equal((await admin(endpoint,{method:'DELETE',headers,body:{}})).status,400);
  assert.equal((await admin('/api/admin/records/visitors/'+A,{headers})).status,403);
  assert.equal((await admin('/api/admin/records/reviews/missing',{headers})).status,404);
  assert.equal((await admin(endpoint,{method:'DELETE',headers:{...headers,Origin:'https://travel.example'},body:{revision:preview.data.revision}})).status,200);
  assert.equal((await admin(endpoint,{method:'DELETE',headers,body:{revision:preview.data.revision}})).status,404);
  assert.equal((await store.listReviews()).length,2);
 },{isDemo:false,origin:'https://travel.example'});
});
test('管理者刪除初始景點後，後端再次初始化不會將它加回',async()=>{
 const isolated=await createDemoDriver();
 try{
  const s=await openSharedStore(isolated),preview=await s.previewAdminDeletion('destinations','jiufen');
  await s.deleteAdminRecord('destinations','jiufen',preview.revision);
  const restarted=await openSharedStore(isolated);assert.equal((await restarted.listPlaces()).length,41);assert.equal((await restarted.webSnapshots()).length,17);
  assert.ok(!(await restarted.listPlaces()).some(place=>place.id==='jiufen'));
 }finally{await isolated.close();}
});
