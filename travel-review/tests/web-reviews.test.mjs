import test from 'node:test';
import assert from 'node:assert/strict';
import {places,summarize} from '../lib/travel-data.ts';
import {webReviewSnapshots,webReviewsByPlace,publicNoteCount,WEB_CHECKED_AT} from '../lib/web-reviews.ts';

test('已查核景點只有一筆網路星等快照且都對應有效景點',()=>{
  assert.equal(new Set(webReviewSnapshots.map(s=>s.placeId)).size,18);
  assert.ok(webReviewSnapshots.every(s=>places.some(p=>p.id===s.placeId)));
  for(const s of webReviewSnapshots){
    assert.equal(new URL(s.url).protocol,'https:');
    assert.equal(s.checkedAt,WEB_CHECKED_AT);
    assert.ok(s.sourcePlaceName&&s.publisher);
    assert.equal(s.scale,5);
    assert.ok(Number.isFinite(s.overall)&&s.overall>=1&&s.overall<=5);
    assert.ok(s.reviewCount===null||(Number.isInteger(s.reviewCount)&&s.reviewCount>0));
  }
});
test('公開心得保留作者與來源且不把平台平均套到個別作者',()=>{
  assert.equal(publicNoteCount,22);
  for(const s of webReviewSnapshots)for(const n of s.notes){
    assert.ok(n.author&&n.summary.length>=20);
    assert.equal(new URL(n.url).protocol,'https:');
    assert.ok(n.dateLabel===null||typeof n.dateLabel==='string');
    assert.ok(n.overall===null||(n.overall>=1&&n.overall<=5));
    if(s.platform==='Tripadvisor')assert.equal(n.overall,null);
  }
  assert.equal(webReviewsByPlace.gaomei.notes[0].overall,4);
  assert.equal(webReviewsByPlace.gaomei.overall,4.8);
});
test('平台數量、未知評論數與本地統計互相獨立',()=>{
  assert.equal(webReviewsByPlace['yingge-river'].reviewCount,null);
  assert.equal(webReviewsByPlace.gaomei.reviewCount,673);
  for(const p of places){const s=summarize(p.id,[]);assert.equal(s.n,0);assert.equal(s.avg,null);assert.equal(s.parking,null);assert.equal(s.cost,null);}
});
test('易混淆的景點範圍與歷史心得保留說明',()=>{
  assert.match(webReviewsByPlace.liyulake.scopeNote,/花蓮.*苗栗/);
  assert.match(webReviewsByPlace.sunmoon.scopeNote,/不是整個日月潭/);
  assert.match(webReviewsByPlace.sanxiantai.scopeNote,/並非目前本島.*封閉/);
  assert.match(webReviewsByPlace.sunmoon.notes[1].summary,/2021年/);
  assert.match(webReviewsByPlace['yingge-river'].scopeNote,/兩者來源不同/);
});
