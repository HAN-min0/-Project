import fs from 'node:fs';import path from 'node:path';import {openStore} from '../server/database.mjs';
if(!process.argv[2])throw new Error('用法 npm run db:import -- 匯出資料.json');
const data=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8'));const store=openStore();
try{console.log(JSON.stringify(store.importData(data)));}finally{store.close()}
