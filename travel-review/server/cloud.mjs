import {createServer} from 'node:http';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSharedStore,InputError} from './cloud-store.mjs';
import {createPostgresDriver,createDemoDriver} from './postgres.mjs';
import {summarizeReviews} from './summary.mjs';

export const cloudProjectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const validToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const cookieValue=(req,name)=>{for(const item of (req.headers.cookie||'').split(';')){const [key,...value]=item.trim().split('=');if(key===name)return value.join('=');}return '';};
const cookie=(name,value,secure,age=31536000)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
const safeEqual=(a,b)=>timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function readBody(req){
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new InputError('請使用 JSON 傳送資料。',415);
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>12000)throw new InputError('資料過長。',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new InputError('輸入格式錯誤。');}
}
export async function createSharedServer({store,origin,isDemo=false,adminPassword,development=false,projectRef='',writeLimit=60}={}){
  if(!store)throw new Error('Database store is required.');
  if(typeof adminPassword!=='string'||adminPassword.length<16)throw new Error('請在主機設定至少 16 字元的 ADMIN_PASSWORD。');
  let configuredOrigin;
  if(origin){const parsed=new URL(origin);if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('PUBLIC_ORIGIN 只能包含網站的協定與網域。');if(!isDemo&&parsed.protocol!=='https:')throw new Error('正式線上網址必須使用 HTTPS。');configuredOrigin=parsed.origin;}
  if(!isDemo&&!configuredOrigin)throw new Error('請設定 PUBLIC_ORIGIN，或在 Render 使用自動提供的 RENDER_EXTERNAL_URL。');
  const secure=!!configuredOrigin?.startsWith('https:');
  const sessionHash=value=>createHmac('sha256',adminPassword).update(value).digest('hex');
  const rates=new Map();
  function limit(key,max,windowMs=60000){const now=Date.now();if(rates.size>5000)for(const [k,v] of rates)if(v.until<now)rates.delete(k);let entry=rates.get(key);if(!entry||entry.until<now){entry={until:now+windowMs,count:0};rates.set(key,entry);}if(++entry.count>max)throw new InputError('操作較頻繁，請稍後再試。',429);}
  const actor=req=>{const raw=cookieValue(req,'travel_actor');return validToken(raw)?hash(raw):'';};
  const adminHash=req=>{const raw=cookieValue(req,'travel_admin');return validToken(raw)?sessionHash(raw):'';};
  const admin=async req=>{const h=adminHash(req);return !!h&&await store.hasAdminSession(h);};
  async function requireAdmin(req){if(!await admin(req))throw new InputError('請先登入資料庫管理頁。',401);}
  let vite;
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
    if(!development)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
    try{
      const method=req.method||'GET';
      // Render health probes may use an internal Host header. This route discloses no records.
      if(req.url==='/healthz'&&method==='GET'){try{await store.health();return json(res,200,{ok:true});}catch{return json(res,503,{ok:false});}}
      const host=req.headers.host||'';
      const expected=configuredOrigin||(isDemo&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)?`http://${host}`:'');
      if(!expected||host.toLowerCase()!==new URL(expected).host.toLowerCase())throw new InputError('請從設定的網站網址開啟。',403);
      const url=new URL(req.url||'/',expected);if(url.origin!==expected)throw new InputError('網址不正確。',403);
      if(!['GET','HEAD'].includes(method)){
        if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==expected))throw new InputError('請從本站送出資料。',403);
        if(Number(req.headers['content-length']||0)>12000)throw new InputError('資料過長。',413);
      }
      if(url.pathname==='/api/admin/login'){
        if(method!=='POST')return json(res,405,{error:'不支援的操作。'});
        limit('admin-login:'+req.socket.remoteAddress,10,300000);
        const body=await readBody(req);
        if(typeof body?.password!=='string'||body.password.length>256||!safeEqual(body.password,adminPassword))throw new InputError('管理密碼不正確。',401);
        const raw=token();await store.createAdminSession(sessionHash(raw));res.setHeader('Set-Cookie',cookie('travel_admin',raw,secure,28800));return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/admin/logout'){
        if(method!=='POST')return json(res,405,{error:'不支援的操作。'});
        const h=adminHash(req);if(h)await store.deleteAdminSession(h);res.setHeader('Set-Cookie',cookie('travel_admin','',secure,0));return json(res,200,{ok:true});
      }
      if(url.pathname.startsWith('/api/admin/')){
        await requireAdmin(req);
        const record=/^\/api\/admin\/records\/([^/]+)\/([^/]+)$/.exec(url.pathname);
        if(record){
          const table=decodeURIComponent(record[1]),id=decodeURIComponent(record[2]);
          if(method==='GET')return json(res,200,await store.previewAdminDeletion(table,id));
          if(method==='DELETE'){
            limit('admin-delete:'+adminHash(req),30);
            const body=await readBody(req);
            return json(res,200,await store.deleteAdminRecord(table,id,body?.revision));
          }
          return json(res,405,{error:'不支援的操作。'});
        }
        if(method!=='GET')return json(res,405,{error:'請使用景點或評價的刪除功能。'});
        if(url.pathname==='/api/admin/overview')return json(res,200,{...await store.metadata(),mode:isDemo?'local-demo':'online',dashboardUrl:/^[a-z0-9]{12,32}$/.test(projectRef)?`https://supabase.com/dashboard/project/${projectRef}/editor`:null});
        if(url.pathname.startsWith('/api/admin/tables/'))return json(res,200,await store.tableRows(decodeURIComponent(url.pathname.slice('/api/admin/tables/'.length)),Number(url.searchParams.get('limit')||25),Number(url.searchParams.get('offset')||0)));
        return json(res,404,{error:'找不到管理介面。'});
      }
      if(url.pathname==='/api/places'){
        if(method==='GET'){
          let raw=cookieValue(req,'travel_actor');if(!validToken(raw)){raw=token();res.setHeader('Set-Cookie',cookie('travel_actor',raw,secure));}
          const owner=hash(raw);limit('visitor-bootstrap',300);await store.touchVisitor(owner);
          const [places,webSnapshots]=await Promise.all([store.listPlaces(owner),store.webSnapshots()]);
          return json(res,200,{places,webSnapshots,canWrite:true,storage:store.kind,mode:isDemo?'local-demo':'online'});
        }
        if(method==='POST'){const owner=actor(req);limit('write:'+owner,writeLimit);limit('write-global',500);return json(res,201,{place:await store.createPlace(await readBody(req),owner),storage:store.kind});}
        return json(res,405,{error:'不支援的操作。'});
      }
      if(url.pathname==='/api/reviews'){
        if(method==='GET')return json(res,200,{reviews:await store.listReviews(actor(req)),canWrite:true,storage:store.kind});
        if(method==='POST'){const owner=actor(req);limit('write:'+owner,writeLimit);limit('write-global',500);return json(res,200,await store.saveReview(await readBody(req),owner));}
        if(method==='DELETE'){const owner=actor(req),placeId=url.searchParams.get('placeId');if(!placeId)throw new InputError('缺少景點。');limit('write:'+owner,writeLimit);return json(res,200,{ok:true,...await store.deleteReview(placeId,owner)});}
        return json(res,405,{error:'不支援的操作。'});
      }
      if(url.pathname==='/api/summary'){
        const allowAI=await admin(req);
        if(method==='GET')return json(res,200,{aiConfigured:allowAI&&!!process.env.OPENAI_API_KEY});
        if(method==='POST'){limit('summary:'+actor(req),20);const result=await summarizeReviews(store,await readBody(req),{allowAI});return json(res,result.status,result.data);}
        return json(res,405,{error:'不支援的操作。'});
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:'找不到資料介面。'});
      if(!['GET','HEAD'].includes(method))return json(res,405,{error:'不支援的操作。'});
      if(vite)return vite.middlewares(req,res);
      const dist=path.join(cloudProjectRoot,'dist'),decoded=decodeURIComponent(url.pathname),target=path.resolve(dist,'.'+decoded);
      if(target!==dist&&!target.startsWith(dist+path.sep))throw new InputError('無法存取此路徑。',403);
      const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(dist,'index.html');
      if(!fs.existsSync(file))return json(res,503,{error:'請先執行 npm run build。'});
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600'});if(method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    }catch(error){if(res.headersSent){res.destroy();return;}if(!(error instanceof InputError))console.error('Request failed:',error.code||'internal_error');json(res,error instanceof InputError?error.status:500,{error:error instanceof InputError?error.message:'資料處理失敗，請稍後再試。'});}
  });
  if(development){const {createServer:createViteServer}=await import('vite');vite=await createViteServer({root:cloudProjectRoot,server:{middlewareMode:true,hmr:{server}},appType:'spa'});}
  return {server,store,async close(){await vite?.close();await new Promise(resolve=>server.close(resolve));await store.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const isDemo=process.argv.includes('--demo'),development=process.argv.includes('--dev');
  const origin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||undefined;
  const adminPassword=process.env.ADMIN_PASSWORD||(isDemo?'local-demo-admin-only':'');
  if(!isDemo&&adminPassword.length<16)throw new Error('請在主機設定 ADMIN_PASSWORD，至少 16 字元。');
  const driver=isDemo?await createDemoDriver(path.join(cloudProjectRoot,'data','postgres-demo')):createPostgresDriver();
  let store;try{store=await openSharedStore(driver);}catch(error){await driver.close();console.error('資料庫初始化失敗：',error.code||'請檢查連線與資料表。');process.exit(1);}
  const app=await createSharedServer({store,origin:isDemo?undefined:origin,isDemo,adminPassword,development,projectRef:process.env.SUPABASE_PROJECT_REF||''});
  const port=Number(process.env.PORT||(development?5173:3000));
  app.server.listen(port,isDemo?'127.0.0.1':'0.0.0.0',()=>{console.log(`旅評小站 ${isDemo?`http://127.0.0.1:${port}`:origin}`);console.log(`資料庫模式：${isDemo?'本機 PGlite 驗證，並非雲端資料庫':'共用 PostgreSQL'}`);if(isDemo)console.log(`本機驗證管理頁 /admin，預設密碼：${process.env.ADMIN_PASSWORD?'使用 .env 設定值':'local-demo-admin-only'}`);});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
