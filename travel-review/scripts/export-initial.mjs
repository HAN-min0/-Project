import fs from 'node:fs';import path from 'node:path';import {openStore,projectRoot} from '../server/database.mjs';
const filename=path.resolve(process.argv[2]||path.join(projectRoot,'outputs','travel-initial.sqlite'));
if(fs.existsSync(filename))throw new Error('檔案已存在，請指定新的輸出路徑。');
const store=openStore(filename);try{console.log(JSON.stringify({filename,places:store.listPlaces().length,webSnapshots:store.webSnapshots().length,reviews:store.listReviews().length,integrity:store.db.prepare('PRAGMA integrity_check').get().integrity_check}));}finally{store.close()}
