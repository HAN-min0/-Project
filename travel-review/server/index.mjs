import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore,projectRoot,InputError} from './database.mjs';
import {summarizeReviews} from './summary.mjs';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function readBody(req){let text='';for await(const chunk of req){text+=chunk.toString();if(Buffer.byteLength(text)>12000)throw new InputError('資料過長',413);}try{return JSON.parse(text)}catch{throw new InputError('輸入格式錯誤')}}
export async function createTravelServer({store=openStore(),development=false}={}){
  let vite;
  const server=createServer(async(req,res)=>{
    try{
      const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return json(res,403,{error:'請從本機網址開啟網站'});
      const url=new URL(req.url||'/',`http://${host}`),method=req.method||'GET';
      if(!['GET','HEAD'].includes(method)){
        if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==url.origin))return json(res,403,{error:'請從本機網站送出資料'});
        if(Number(req.headers['content-length']||0)>12000)return json(res,413,{error:'資料過長'});
      }
      if(url.pathname==='/api/places'){
        if(method==='GET')return json(res,200,{places:store.listPlaces(),webSnapshots:store.webSnapshots(),canWrite:true,storage:'sqlite'});
        if(method==='POST')return json(res,201,{place:store.createPlace(await readBody(req)),storage:'sqlite'});
        return json(res,405,{error:'不支援的操作'});
      }
      if(url.pathname==='/api/reviews'){
        if(method==='GET')return json(res,200,{reviews:store.listReviews(),canWrite:true,storage:'sqlite'});
        if(method==='POST')return json(res,200,store.saveReview(await readBody(req)));
        if(method==='DELETE'){const placeId=url.searchParams.get('placeId');if(!placeId)throw new InputError('缺少景點');store.deleteReview(placeId);return json(res,200,{ok:true});}
        return json(res,405,{error:'不支援的操作'});
      }
      if(url.pathname==='/api/summary'){
        if(method==='GET')return json(res,200,{aiConfigured:!!process.env.OPENAI_API_KEY});
        if(method==='POST'){const result=await summarizeReviews(store,await readBody(req));return json(res,result.status,result.data);}
        return json(res,405,{error:'不支援的操作'});
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:'找不到此資料介面'});
      if(!['GET','HEAD'].includes(method))return json(res,405,{error:'不支援的操作'});
      if(vite)return vite.middlewares(req,res);
      const dist=path.join(projectRoot,'dist'),decoded=decodeURIComponent(url.pathname),target=path.resolve(dist,'.'+decoded);
      if(target!==dist&&!target.startsWith(dist+path.sep))return json(res,403,{error:'無法存取此路徑'});
      const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(dist,'index.html');
      if(!fs.existsSync(file))return json(res,503,{error:'請先執行 npm run build，再執行 npm start。'});
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff'});if(method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
    }catch(e){json(res,e instanceof InputError?e.status:500,{error:e instanceof InputError?e.message:'資料處理失敗，請稍後重試。'});}
  });
  if(development){const {createServer:createViteServer}=await import('vite');vite=await createViteServer({root:projectRoot,server:{middlewareMode:true,hmr:{server}},appType:'spa'});}
  return {server,store,async close(){await vite?.close();await new Promise(resolve=>server.close(resolve));store.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const development=process.argv.includes('--dev'),app=await createTravelServer({development});const port=Number(process.env.PORT||(development?5173:3000));
  app.server.listen(port,'127.0.0.1',()=>{console.log(`旅評小站 http://127.0.0.1:${port}`);console.log(`SQLite database: ${app.store.filename}`);});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
}
