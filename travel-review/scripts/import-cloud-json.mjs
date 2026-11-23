import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createPostgresDriver} from '../server/postgres.mjs';
import {openSharedStore} from '../server/cloud-store.mjs';
const file=process.argv[2];
if(!file)throw new Error('用法：npm run db:import-cloud -- "舊版個人資料.json"');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
if(data.schemaVersion>=5)throw new Error('此工具專供舊版個人 JSON。多人共用版的完整還原請使用 PostgreSQL 備份，避免合併不同訪客的評價。');
const owner=createHash('sha256').update('travel-review-legacy-import-v2').digest('hex');
const driver=createPostgresDriver();
try{const store=await openSharedStore(driver);await store.touchVisitor(owner);console.log(JSON.stringify(await store.importData(data,owner)));console.log('舊紀錄已歸入獨立匯入身分，可公開閱讀；管理者可在 Supabase 檢視。');}finally{await driver.close();}
